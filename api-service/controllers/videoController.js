const path = require("path");
const crypto = require("crypto");
const fsSync = require("fs");
const fs = require("fs").promises;
const { promisify } = require("util");
const stream = require("stream");
const pipeline = promisify(stream.pipeline);

const videoService = require("../../shared/database/services/videoService");
const FFOriginal = require("../../shared/lib/FF");
const util = require("../../shared/lib/util");
const telemetry = require("../../shared/telemetry");

// Use instrumented FF module if telemetry is enabled
const FF = telemetry.config.enabled
  ? telemetry.createInstrumentedFF(FFOriginal)
  : FFOriginal;

// BullQueue will be injected by server.js
let queue = null;

const setQueue = (bullQueue) => {
  queue = bullQueue;
};

/**
 * Get user videos
 * GET /api/videos
 */
const getVideos = async (req, res) => {
  try {
    const videos = await videoService.getUserVideos(req.userId, {
      limit: 100,
      offset: 0,
      orderBy: 'created_at',
      order: 'DESC'
    });

    res.status(200).json(videos);
  } catch (error) {
    console.error("[API] Get videos error:", error);
    res.status(500).json({ error: "Failed to retrieve videos." });
  }
};

/**
 * Upload video
 * POST /api/videos/upload
 */
const uploadVideo = async (req, res) => {
  const specifiedFileName = req.headers.filename;

  if (!specifiedFileName) {
    return res.status(400).json({ error: "Filename header is required." });
  }

  const extension = path.extname(specifiedFileName).substring(1).toLowerCase();
  const name = path.parse(specifiedFileName).name;
  const videoId = crypto.randomBytes(4).toString("hex");

  const FORMATS_SUPPORTED = ["mov", "mp4"];
  if (!FORMATS_SUPPORTED.includes(extension)) {
    return res.status(400).json({
      error: "Only these formats are allowed: mov, mp4"
    });
  }

  try {
    const videoDir = path.join(process.cwd(), 'storage', videoId);
    await fs.mkdir(videoDir, { recursive: true });

    const fullPath = path.join(videoDir, `original.${extension}`);

    // Write buffer to file (req.body is Buffer from express.raw middleware)
    await fs.writeFile(fullPath, req.body);

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
      message: "Video uploaded successfully!",
      videoId,
      name,
      dimensions
    });
  } catch (error) {
    console.error("[API] Upload failed:", error);

    // Cleanup on failure
    try {
      await fs.rm(`./storage/${videoId}`, { recursive: true, force: true });
    } catch {}

    res.status(500).json({
      error: "Failed to upload video.",
      details: error.message
    });
  }
};

/**
 * Extract audio from video
 * POST /api/videos/extract-audio
 */
const extractAudio = async (req, res) => {
  const { videoId } = req.body;

  if (!videoId) {
    return res.status(400).json({ error: "videoId is required." });
  }

  try {
    const video = await videoService.findByVideoId(videoId);

    if (!video) {
      return res.status(404).json({ error: "Video not found." });
    }

    if (video.user_id !== req.userId) {
      return res.status(403).json({ error: "Access denied." });
    }

    if (video.metadata && video.metadata.extractedAudio) {
      return res.status(400).json({
        error: "Audio has already been extracted for this video."
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
      message: "Audio extracted successfully!"
    });
  } catch (error) {
    console.error("[API] Extract audio error:", error);
    res.status(500).json({
      error: "Failed to extract audio.",
      details: error.message
    });
  }
};

/**
 * Resize video
 * POST /api/videos/resize
 */
const resizeVideo = async (req, res) => {
  const { videoId, width, height } = req.body;

  if (!videoId || !width || !height) {
    return res.status(400).json({ error: "videoId, width, and height are required." });
  }

  try {
    const video = await videoService.findByVideoId(videoId);

    if (!video) {
      return res.status(404).json({ error: "Video not found." });
    }

    if (video.user_id !== req.userId) {
      return res.status(403).json({ error: "Access denied." });
    }

    // Add resize operation to database
    await videoService.addOperation(videoId, {
      type: 'resize',
      status: 'pending',
      parameters: { width: parseInt(width), height: parseInt(height) }
    });

    // Enqueue job
    if (queue) {
      await queue.enqueue({
        type: "resize",
        videoId,
        width: parseInt(width),
        height: parseInt(height),
        userId: req.userId
      });
    }

    res.status(200).json({
      status: "success",
      message: "Video resize job queued!"
    });
  } catch (error) {
    console.error("[API] Resize video error:", error);
    res.status(500).json({ error: "Failed to start video resize." });
  }
};

/**
 * Convert video format
 * POST /api/videos/convert
 */
const convertVideo = async (req, res) => {
  const { videoId, targetFormat } = req.body;

  const supportedFormats = ["mp4", "mov", "avi", "webm", "mkv", "flv"];

  if (!videoId || !targetFormat) {
    return res.status(400).json({ error: "videoId and targetFormat are required." });
  }

  if (!supportedFormats.includes(targetFormat.toLowerCase())) {
    return res.status(400).json({
      error: `Unsupported format. Supported: ${supportedFormats.join(", ")}`
    });
  }

  try {
    const video = await videoService.findByVideoId(videoId);

    if (!video) {
      return res.status(404).json({ error: "Video not found." });
    }

    if (video.user_id !== req.userId) {
      return res.status(403).json({ error: "Access denied." });
    }

    if (video.extension.toLowerCase() === targetFormat.toLowerCase()) {
      return res.status(400).json({
        error: `Video is already in ${targetFormat.toUpperCase()} format.`
      });
    }

    // Add conversion operation to database
    await videoService.addOperation(videoId, {
      type: 'convert',
      status: 'pending',
      parameters: {
        targetFormat: targetFormat.toLowerCase(),
        originalFormat: video.extension.toLowerCase()
      }
    });

    // Enqueue job
    if (queue) {
      await queue.enqueue({
        type: "convert",
        videoId,
        targetFormat: targetFormat.toLowerCase(),
        originalFormat: video.extension.toLowerCase(),
        userId: req.userId
      });
    }

    res.status(200).json({
      status: "success",
      message: `Video conversion to ${targetFormat.toUpperCase()} queued!`
    });
  } catch (error) {
    console.error("[API] Convert video error:", error);
    res.status(500).json({
      error: "Failed to start video conversion.",
      details: error.message
    });
  }
};

/**
 * Get video asset
 * GET /api/videos/asset
 */
const getVideoAsset = async (req, res) => {
  const { videoId, type, format, dimensions } = req.query;

  if (!videoId || !type) {
    return res.status(400).json({ error: "videoId and type are required." });
  }

  try {
    const video = await videoService.findByVideoId(videoId);

    if (!video) {
      return res.status(404).json({ error: "Video not found." });
    }

    if (video.user_id !== req.userId) {
      return res.status(403).json({ error: "Access denied." });
    }

    let filePath;
    let filename;
    let extension;

    switch (type) {
      case "thumbnail":
        extension = "jpg";
        filename = `${video.name}-thumbnail.${extension}`;
        filePath = `./storage/${videoId}/thumbnail.${extension}`;
        break;

      case "audio":
        extension = "aac";
        filename = `${video.name}-audio.${extension}`;
        filePath = `./storage/${videoId}/audio.${extension}`;
        break;

      case "resize":
        if (!dimensions) {
          return res.status(400).json({ error: "dimensions parameter required (format: WIDTHxHEIGHT)" });
        }
        extension = video.extension;
        filename = `${video.name}-${dimensions}.${extension}`;
        filePath = `./storage/${videoId}/${dimensions}.${extension}`;
        break;

      case "original":
        extension = video.extension;
        filename = `${video.name}.${extension}`;
        filePath = `./storage/${videoId}/original.${extension}`;
        break;

      case "converted":
        if (!format) {
          return res.status(400).json({ error: "format parameter required" });
        }
        extension = format.toLowerCase();
        filename = `${video.name}-converted.${extension}`;
        filePath = `./storage/${videoId}/converted.${extension}`;
        break;

      default:
        return res.status(400).json({ error: "Invalid asset type." });
    }

    // Check if file exists
    await fs.access(filePath);
    const stat = await fs.stat(filePath);
    const mimeType = util.getMimeFromExtension(extension);

    // Create read stream
    const fileStream = fsSync.createReadStream(filePath, {
      highWaterMark: 64 * 1024 // 64KB chunks
    });

    // Handle stream errors
    fileStream.on("error", (err) => {
      console.error("[API] Stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error streaming asset." });
      }
      fileStream.destroy();
    });

    // Close stream if client disconnects
    res.on("close", () => {
      if (fileStream && !fileStream.destroyed) {
        fileStream.destroy();
      }
    });

    // Set headers
    if (type !== "thumbnail") {
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    } else {
      res.setHeader("Cache-Control", "public, max-age=86400, immutable");
      res.setHeader("ETag", `"${videoId}-${stat.size}-${stat.mtimeMs}"`);
    }

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Accept-Ranges", "bytes");

    // Pipe stream to response
    fileStream.pipe(res);

    fileStream.on("end", () => {
      if (!res.writableEnded) {
        res.end();
      }
    });
  } catch (error) {
    console.error("[API] Get video asset error:", error);

    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: "Asset not found." });
    }

    if (!res.headersSent) {
      res.status(500).json({ error: "Error retrieving video asset." });
    }
  }
};

module.exports = {
  setQueue,
  getVideos,
  uploadVideo,
  extractAudio,
  resizeVideo,
  convertVideo,
  getVideoAsset
};
