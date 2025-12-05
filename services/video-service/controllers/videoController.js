const path = require("path");
const crypto = require("crypto");
const fsSync = require("fs");
const fs = require("fs").promises;
const { promisify } = require("util");
const stream = require("stream");
const pipeline = promisify(stream.pipeline);
const axios = require("axios");

const videoService = require("../../shared/database/services/videoService");
const FF = require("../../../lib/FF");
const util = require("../../../lib/util");
const { EventTypes } = require("../../shared/eventBus");

// Job Service URL (can be configured via env - kept for backward compatibility)
const JOB_SERVICE_URL = process.env.JOB_SERVICE_URL || 'http://localhost:3003';

/**
 * Get all videos for logged-in user
 * GET /videos
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
    console.error("[Video Service] Get videos error:", error);
    res.status(500).json({
      error: "Failed to retrieve videos."
    });
  }
};

/**
 * Upload a video file
 * POST /upload
 */
const uploadVideo = async (req, res) => {
  const specifiedFileName = req.headers.filename;

  if (!specifiedFileName) {
    return res.status(400).json({
      error: "Filename header is required."
    });
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
    const videoDir = path.join(__dirname, `../../../storage/${videoId}`);
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

    // Publish VIDEO_UPLOADED event
    try {
      await req.app.locals.eventBus.publish(EventTypes.VIDEO_UPLOADED, {
        videoId,
        userId: req.userId,
        name,
        extension,
        dimensions
      });
      console.log(`[Video Service] Published VIDEO_UPLOADED event for videoId: ${videoId}`);
    } catch (eventError) {
      console.error('[Video Service] Failed to publish VIDEO_UPLOADED event:', eventError.message);
      // Don't fail the request if event publishing fails
    }

    res.status(201).json({
      status: "success",
      message: "The file was uploaded successfully!",
      videoId,
      name,
      dimensions
    });
  } catch (e) {
    console.error("[Video Service] Upload failed:", e);

    // Cleanup
    try {
      await fs.rm(path.join(__dirname, `../../../storage/${videoId}`), {
        recursive: true,
        force: true
      });
    } catch {}

    res.status(500).json({
      error: "Failed to upload video.",
      details: e.message
    });
  }
};

/**
 * Extract audio from video
 * POST /extract-audio
 */
const extractAudio = async (req, res) => {
  const { videoId } = req.body;

  try {
    const video = await videoService.findByVideoId(videoId);

    if (!video) {
      return res.status(404).json({ error: "Video not found." });
    }

    if (video.metadata && video.metadata.extractedAudio) {
      return res.status(400).json({
        error: "The audio has already been extracted for this video."
      });
    }

    const originalVideoPath = path.join(
      __dirname,
      `../../../storage/${videoId}/original.${video.extension}`
    );
    const targetAudioPath = path.join(
      __dirname,
      `../../../storage/${videoId}/audio.aac`
    );

    await FF.extractAudio(originalVideoPath, targetAudioPath);

    // Update metadata
    await videoService.updateVideo(videoId, {
      metadata: { ...video.metadata, extractedAudio: true }
    });

    res.status(200).json({
      status: "success",
      message: "The audio was extracted successfully!"
    });
  } catch (e) {
    console.error("[Video Service] Extract audio error:", e);
    res.status(500).json({
      error: "Failed to extract audio.",
      details: e.message
    });
  }
};

/**
 * Resize video (queue job)
 * POST /resize
 */
const resizeVideo = async (req, res) => {
  const { videoId, width, height } = req.body;

  try {
    // Check if video exists
    const video = await videoService.findByVideoId(videoId);
    if (!video) {
      return res.status(404).json({ error: "Video not found." });
    }

    // Add resize operation to database
    await videoService.addOperation(videoId, {
      type: 'resize',
      status: 'pending',
      parameters: { width, height }
    });

    // Publish VIDEO_PROCESSING_REQUESTED event (replaces HTTP call)
    try {
      await req.app.locals.eventBus.publish(EventTypes.VIDEO_PROCESSING_REQUESTED, {
        videoId,
        userId: req.userId,
        operation: 'resize',
        parameters: { width, height }
      });
      console.log(`[Video Service] Published VIDEO_PROCESSING_REQUESTED event for videoId: ${videoId}`);

      res.status(200).json({
        status: "success",
        message: "The video is now being processed!"
      });
    } catch (error) {
      console.error("[Video Service] Failed to publish event:", error.message);
      res.status(500).json({
        error: "Failed to start video resize.",
        details: "Event bus unavailable"
      });
    }
  } catch (error) {
    console.error("[Video Service] Resize video error:", error);
    res.status(500).json({
      error: "Failed to start video resize."
    });
  }
};

/**
 * Convert video format (queue job)
 * POST /convert
 */
const convertVideo = async (req, res) => {
  const { videoId, targetFormat } = req.body;

  const supportedFormats = ["mp4", "mov", "avi", "webm", "mkv", "flv"];

  if (!targetFormat) {
    return res.status(400).json({ error: "Target format is required!" });
  }

  if (!supportedFormats.includes(targetFormat.toLowerCase())) {
    return res.status(400).json({
      error: `Unsupported format. Supported formats: ${supportedFormats.join(", ")}`
    });
  }

  try {
    const video = await videoService.findByVideoId(videoId);

    if (!video) {
      return res.status(404).json({ error: "Video not found!" });
    }

    // Already same format?
    if (video.extension.toLowerCase() === targetFormat.toLowerCase()) {
      return res.status(400).json({
        error: `Video is already in ${targetFormat.toUpperCase()} format!`
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

    // Publish VIDEO_PROCESSING_REQUESTED event (replaces HTTP call)
    try {
      await req.app.locals.eventBus.publish(EventTypes.VIDEO_PROCESSING_REQUESTED, {
        videoId,
        userId: req.userId,
        operation: 'convert',
        parameters: {
          targetFormat: targetFormat.toLowerCase(),
          originalFormat: video.extension.toLowerCase()
        }
      });
      console.log(`[Video Service] Published VIDEO_PROCESSING_REQUESTED event for videoId: ${videoId}`);

      res.status(200).json({
        status: "success",
        message: `Video conversion to ${targetFormat.toUpperCase()} has started.`
      });
    } catch (error) {
      console.error("[Video Service] Failed to publish event:", error.message);
      res.status(500).json({
        error: "Failed to start video conversion.",
        details: "Event bus unavailable"
      });
    }
  } catch (e) {
    console.error("[Video Service] Convert video error:", e);
    res.status(500).json({
      error: "Video conversion failed.",
      details: e.message
    });
  }
};

/**
 * Get video asset (original, thumbnail, resized, converted, audio)
 * GET /asset
 */
const getVideoAsset = async (req, res) => {
  const { videoId, type, format, dimensions } = req.query;

  try {
    const video = await videoService.findByVideoId(videoId);
    if (!video) {
      return res.status(404).json({ error: "Video not found!" });
    }

    let filePath;
    let filename;
    let extension;

    switch (type) {
      case "thumbnail":
        extension = "jpg";
        filename = `${video.name}-thumbnail.${extension}`;
        filePath = path.join(__dirname, `../../../storage/${videoId}/thumbnail.${extension}`);
        break;

      case "audio":
        extension = "aac";
        filename = `${video.name}-audio.${extension}`;
        filePath = path.join(__dirname, `../../../storage/${videoId}/audio.${extension}`);
        break;

      case "resize":
        extension = video.extension;
        filename = `${video.name}-${dimensions}.${extension}`;
        filePath = path.join(__dirname, `../../../storage/${videoId}/${dimensions}.${extension}`);
        break;

      case "original":
        extension = video.extension;
        filename = `${video.name}.${extension}`;
        filePath = path.join(__dirname, `../../../storage/${videoId}/original.${extension}`);
        break;

      case "converted":
        extension = format || "mp4";
        filename = `${video.name}-converted.${extension}`;
        filePath = path.join(__dirname, `../../../storage/${videoId}/converted.${extension}`);

        // Check conversion status from operations table
        const convertOperation = await videoService.findOperation(
          videoId,
          'convert',
          { targetFormat: extension, originalFormat: video.extension.toLowerCase() }
        );

        if (!convertOperation || convertOperation.status !== 'completed') {
          return res.status(400).json({
            error: `Conversion to ${extension.toUpperCase()} not finished yet.`
          });
        }
        break;

      default:
        return res.status(400).json({
          error: "Invalid asset type requested."
        });
    }

    try {
      await fs.access(filePath);
      const stat = await fs.stat(filePath);
      const mimeType = util.getMimeFromExtension(extension);

      const fileStream = fsSync.createReadStream(filePath);

      // Close the stream if client disconnects
      res.on("close", () => {
        fileStream.destroy();
      });

      if (type !== "thumbnail") {
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      }
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Content-Length", stat.size);

      // Pipe the stream
      fileStream.pipe(res);
      fileStream.on("error", (err) => {
        console.error("[Video Service] Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming asset." });
        }
        res.destroy();
      });
    } catch (err) {
      console.error("[Video Service] Asset access error:", err);
      res.status(404).json({ error: "Asset not found." });
    }
  } catch (error) {
    console.error("[Video Service] Get video asset error:", error);
    res.status(500).json({ error: "Error retrieving video asset." });
  }
};

/**
 * Add watermark to video (queue job)
 * POST /watermark
 */
const watermarkVideo = async (req, res) => {
  const { videoId, text, x, y, fontSize, fontColor, opacity } = req.body;

  // Validate required fields
  if (!videoId || !text) {
    return res.status(400).json({
      error: "videoId and text are required!"
    });
  }

  // Validate text length
  if (text.length > 100) {
    return res.status(400).json({
      error: "Watermark text must be 100 characters or less."
    });
  }

  try {
    // Check if video exists
    const video = await videoService.findByVideoId(videoId);
    if (!video) {
      return res.status(404).json({ error: "Video not found." });
    }

    // Build watermark options
    const options = {};
    if (x !== undefined) options.x = x;
    if (y !== undefined) options.y = y;
    if (fontSize !== undefined) options.fontSize = fontSize;
    if (fontColor !== undefined) options.fontColor = fontColor;
    if (opacity !== undefined) options.opacity = opacity;

    // Add watermark operation to database
    await videoService.addOperation(videoId, {
      type: 'watermark',
      status: 'pending',
      parameters: { text, ...options }
    });

    // Publish VIDEO_PROCESSING_REQUESTED event
    try {
      await req.app.locals.eventBus.publish(EventTypes.VIDEO_PROCESSING_REQUESTED, {
        videoId,
        userId: req.userId,
        operation: 'watermark',
        parameters: { text, ...options }
      });
      console.log(`[Video Service] Published VIDEO_PROCESSING_REQUESTED event for videoId: ${videoId}`);

      res.status(200).json({
        status: "success",
        message: "The video is now being watermarked!"
      });
    } catch (error) {
      console.error("[Video Service] Failed to publish event:", error.message);
      res.status(500).json({
        error: "Failed to start video watermarking.",
        details: "Event bus unavailable"
      });
    }
  } catch (error) {
    console.error("[Video Service] Watermark video error:", error);
    res.status(500).json({
      error: "Failed to start video watermarking."
    });
  }
};

module.exports = {
  getVideos,
  uploadVideo,
  extractAudio,
  resizeVideo,
  convertVideo,
  getVideoAsset,
  watermarkVideo
};
