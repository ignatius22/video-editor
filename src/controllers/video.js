const path = require("path");
const cluster = require("cluster");
const crypto = require("crypto");
const fsSync = require("fs");
const fs = require("fs").promises;
const { promisify } = require("util");
const stream = require("stream");
const pipeline = promisify(stream.pipeline);
const util = require("../../lib/util");
const videoService = require("../../database/services/videoService");
const FF = require("../../lib/FF");

let jobs;
if (cluster.isPrimary) {
  const JobQueue = require("../../lib/JobQueue");
  jobs = new JobQueue();
}

// Return the list of all the videos that a logged in user has uploaded
const getVideos = async (req, res, handleErr) => {
  try {
    const videos = await videoService.getUserVideos(req.userId, {
      limit: 100,
      offset: 0,
      orderBy: 'created_at',
      order: 'DESC'
    });

    res.status(200).json(videos);
  } catch (error) {
    console.error("Get videos error:", error);
    return handleErr({ status: 500, message: "Failed to retrieve videos." });
  }
};

// Upload a video file
const uploadVideo = async (req, res, handleErr) => {
  const specifiedFileName = req.headers.filename;
  if (!specifiedFileName) {
    return handleErr({ status: 400, message: "Filename header is required." });
  }

  const extension = path.extname(specifiedFileName).substring(1).toLowerCase();
  const name = path.parse(specifiedFileName).name;
  const videoId = crypto.randomBytes(4).toString("hex");

  const FORMATS_SUPPORTED = ["mov", "mp4"];
  if (!FORMATS_SUPPORTED.includes(extension)) {
    return handleErr({
      status: 400,
      message: "Only these formats are allowed: mov, mp4",
    });
  }

  try {
    const videoDir = `./storage/${videoId}`;
    await fs.mkdir(videoDir, { recursive: true });

    const fullPath = path.join(videoDir, `original.${extension}`);
    const fileStream = fsSync.createWriteStream(fullPath);

    // Pipe request to file safely
    await pipeline(req, fileStream);

    // Generate thumbnail
    const thumbnailPath = path.join(videoDir, "thumbnail.jpg");
    await FF.makeThumbnail(fullPath, thumbnailPath);

    // Get video dimensions
    const dimensions = await FF.getDimensions(fullPath);

    // Save to database
    await videoService.createVideo({
      videoId,
      userId: req.userId,
      name,
      extension,
      dimensions,
      metadata: { extractedAudio: false }
    });

    return res.status(201).json({
      status: "success",
      message: "The file was uploaded successfully!",
      videoId,
    });
  } catch (e) {
    console.error("Upload failed:", e);
    // Cleanup
    try {
      await fs.rm(`./storage/${videoId}`, { recursive: true, force: true });
    } catch {}

    if (!res.headersSent) {
      return handleErr({
        status: 500,
        message: "Failed to upload video.",
        details: e.message,
      });
    }
  }
};

// Extract the audio for a video file (can only be done once per video)
const extractAudio = async (req, res, handleErr) => {
  const videoId = req.query.videoId;

  try {
    const video = await videoService.findByVideoId(videoId);

    if (!video) {
      return handleErr({ status: 404, message: "Video not found." });
    }

    if (video.metadata && video.metadata.extractedAudio) {
      return handleErr({
        status: 400,
        message: "The audio has already been extracted for this video.",
      });
    }

    const originalVideoPath = `./storage/${videoId}/original.${video.extension}`;
    const targetAudioPath = `./storage/${videoId}/audio.aac`;

    await FF.extractAudio(originalVideoPath, targetAudioPath);

    // Update metadata
    await videoService.updateVideo(videoId, {
      metadata: { ...video.metadata, extractedAudio: true }
    });

    res.status(200).json({
      status: "success",
      message: "The audio was extracted successfully!",
    });
  } catch (e) {
    console.error("Extract audio error:", e);
    return handleErr({
      status: 500,
      message: "Failed to extract audio.",
      details: e.message
    });
  }
};

// Resize a video file (creates a new video file)
const resizeVideo = async (req, res, handleErr) => {
  const videoId = req.body.videoId;
  const width = Number(req.body.width);
  const height = Number(req.body.height);

  try {
    // Check if video exists
    const video = await videoService.findByVideoId(videoId);
    if (!video) {
      return handleErr({ status: 404, message: "Video not found." });
    }

    // Add resize operation to database
    await videoService.addOperation(videoId, {
      type: 'resize',
      status: 'pending',
      parameters: { width, height }
    });

    // Enqueue job in Bull queue
    if (jobs) {
      jobs.enqueue({
        type: "resize",
        videoId,
        width,
        height,
      });
    } else if (process.send) {
      process.send({
        messageType: "new-resize",
        data: { videoId, width, height },
      });
    }

    res.status(200).json({
      status: "success",
      message: "The video is now being processed!",
    });
  } catch (error) {
    console.error("Resize video error:", error);
    return handleErr({ status: 500, message: "Failed to start video resize." });
  }
};

// Return a video asset to the client
const getVideoAsset = async (req, res, handleErr) => {
  const { videoId, type, format, dimensions } = req.query;

  try {
    const video = await videoService.findByVideoId(videoId);
    if (!video) return handleErr({ status: 404, message: "Video not found!" });

  let filePath;
  let filename;
  let extension;

  switch (type) {
    case "thumbnail":
      extension = "jpg";
      filename = `${video.name}-thumbnail.${extension}`;
      filePath = `../../storage/${videoId}/thumbnail.${extension}`;
      break;
    case "audio":
      extension = "aac";
      filename = `${video.name}-audio.${extension}`;
      filePath = `../../storage/${videoId}/audio.${extension}`;
      break;
    case "resize":
      extension = video.extension;
      filename = `${video.name}-${dimensions}.${extension}`;
      filePath = `../../storage/${videoId}/${dimensions}.${extension}`;
      break;
    case "original":
      extension = video.extension;
      filename = `${video.name}.${extension}`;
      filePath = `../../storage/${videoId}/original.${extension}`;
      break;
    case "face-screenshot":
      extension = "jpg";
      filename = `${video.name}-face-detection.${extension}`;
      filePath = `../../storage/${videoId}/face-detection.${extension}`;
      break;
    case "converted":
      extension = format || "mp4";
      filename = `${video.name}-converted.${extension}`;
      filePath = `../../storage/${videoId}/converted.${extension}`;

      // Check conversion status from operations table
      const convertOperation = await videoService.findOperation(
        videoId,
        'convert',
        { targetFormat: extension, originalFormat: video.extension.toLowerCase() }
      );

      if (!convertOperation || convertOperation.status !== 'completed') {
        return handleErr({
          status: 400,
          message: `Conversion to ${extension.toUpperCase()} not finished yet.`,
        });
      }
      break;
    default:
      return handleErr({
        status: 400,
        message: "Invalid asset type requested.",
      });
  }

  const absolutePath = path.join(__dirname, filePath);

  let fileStream;
  try {
    await fs.access(absolutePath);
    const stat = await fs.stat(absolutePath);
    const mimeType = util.getMimeFromExtension(extension);

    fileStream = fsSync.createReadStream(absolutePath);

    // Close the stream if client disconnects
    res.on("close", () => {
      fileStream.destroy();
    });

    if (type !== "thumbnail") {
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
    }
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", stat.size);

    // Pipe the stream and catch errors
    fileStream.pipe(res);
    fileStream.on("error", (err) => {
      console.error("Stream error:", err);
      if (!res.headersSent)
        handleErr({ status: 500, message: "Error streaming asset." });
      res.destroy(); // Close the response if stream fails
    });
  } catch (err) {
    console.error("Asset access error:", err);
    if (!res.headersSent)
      return handleErr({ status: 500, message: "Error loading video asset." });
    res.destroy();
  }
  } catch (error) {
    console.error("Get video asset error:", error);
    if (!res.headersSent)
      return handleErr({ status: 500, message: "Error retrieving video asset." });
  }
};

// Convert video format
const convertVideoFormat = async (req, res, handleErr) => {
  const videoId = req.query.videoId;
  const targetFormat = req.body.format?.toLowerCase();

  const supportedFormats = ["mp4", "mov", "avi", "webm", "mkv", "flv"];

  // --- Validate input ---
  if (!targetFormat) {
    return handleErr({
      status: 400,
      message: "Target format is required!",
    });
  }

  if (!supportedFormats.includes(targetFormat)) {
    return handleErr({
      status: 400,
      message: `Unsupported format. Supported formats: ${supportedFormats.join(
        ", "
      )}`,
    });
  }

  // Retrieve video
  try {
    const video = await videoService.findByVideoId(videoId);

    if (!video) {
      return handleErr({
        status: 404,
        message: "Video not found!",
      });
    }

    // Already same format?
    if (video.extension.toLowerCase() === targetFormat) {
      return handleErr({
        status: 400,
        message: `Video is already in ${targetFormat.toUpperCase()} format!`,
      });
    }

  const originalPath = path.join(
    __dirname,
    `../../storage/${videoId}/original.${video.extension}`
  );

  const convertedPath = path.join(
    __dirname,
    `../../storage/${videoId}/converted.${targetFormat}`
  );

    console.log(`🔄 Starting conversion: ${videoId} → ${targetFormat}`);

    // Add conversion operation to database
    await videoService.addOperation(videoId, {
      type: 'convert',
      status: 'pending',
      parameters: {
        targetFormat,
        originalFormat: video.extension.toLowerCase()
      }
    });

    // Payload used by both job queue and child process
    const jobPayload = {
      type: "convert",
      videoId,
      originalFormat: video.extension.toLowerCase(),
      targetFormat: targetFormat.toLowerCase(),
      originalPath,
      convertedPath,
    };

    // Send to queue OR worker process
    if (jobs) {
      jobs.enqueue(jobPayload);
    } else if (process.send) {
      process.send({
        messageType: "new-convert",
        data: jobPayload,
      });
    }

    return res.status(200).json({
      status: "success",
      message: `Video conversion to ${targetFormat.toUpperCase()} has started.`,
    });
  } catch (e) {
    console.error("❌ Conversion error:", e);
    return handleErr({
      status: 500,
      message: `Video conversion failed: ${e.message}`,
    });
  }
};

const controller = {
  getVideos,
  uploadVideo,
  extractAudio,
  resizeVideo,
  getVideoAsset,
  convertVideoFormat,
};

module.exports = controller;
