const path = require("path");
const crypto = require("crypto");
const fsSync = require("fs");
const fs = require("fs").promises;
const { promisify } = require("util");
const stream = require("stream");
const pipeline = promisify(stream.pipeline);

const videoService = require("@convertix/shared/database/services/videoService");
const { transaction } = require("@convertix/shared/database/db");
const FFOriginal = require("@convertix/shared/lib/FF");
const util = require("@convertix/shared/lib/util");
const createLogger = require("@convertix/shared/lib/logger");
const logger = createLogger('api');
const telemetry = require("@convertix/shared/telemetry");
const userService = require("@convertix/shared/database/services/userService");

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
    logger.error({ err: error.message, stack: error.stack, userId: req.userId }, "Get videos error");
    res.status(500).json({ error: "Failed to fetch videos." });
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

  // Tier-based size limits
  const isPro = req.user && req.user.tier === 'pro';
  const sizeLimit = isPro ? 500 * 1024 * 1024 : 50 * 1024 * 1024; // 500MB for Pro, 50MB for Free

  // Quick check on Content-Length header if available
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > sizeLimit) {
    return res.status(400).json({
      error: `File size too large for your ${req.user.tier} plan (based on Content-Length). Max: ${isPro ? '500MB' : '50MB'}.`,
      limit: sizeLimit,
      actual: contentLength
    });
  }

  const FORMATS_SUPPORTED = ["mov", "mp4"];
  if (!FORMATS_SUPPORTED.includes(extension)) {
    return res.status(400).json({
      error: "Only these formats are allowed: mov, mp4"
    });
  }

  let fullPath = '';
  try {
    const videoDir = path.join(process.cwd(), 'storage', videoId);
    await fs.mkdir(videoDir, { recursive: true });

    fullPath = path.join(videoDir, `original.${extension}`);

    // Streaming Logic: Count bytes and validate content (magic numbers)
    let bytesRead = 0;
    let headerBuffer = Buffer.alloc(0);
    let validated = false;

    const validationWatcher = new stream.Transform({
      transform(chunk, encoding, callback) {
        bytesRead += chunk.length;
        
        // 1. Size Limit Check
        if (bytesRead > sizeLimit) {
          const err = new Error('LIMIT_EXCEEDED');
          err.limit = sizeLimit;
          return callback(err);
        }

        // 2. Magic Number Validation (first 16 bytes)
        if (!validated) {
          headerBuffer = Buffer.concat([headerBuffer, chunk]);
          if (headerBuffer.length >= 16) {
            if (!util.validateMagicNumbers(headerBuffer, extension)) {
              return callback(new Error('INVALID_CONTENT'));
            }
            validated = true;
          }
        }

        callback(null, chunk);
      },
      flush(callback) {
        // Final check if file was too small to be validated but finished
        if (!validated && headerBuffer.length > 0) {
          if (!util.validateMagicNumbers(headerBuffer, extension)) {
            return callback(new Error('INVALID_CONTENT'));
          }
        }
        callback();
      }
    });

    const fileStream = fsSync.createWriteStream(fullPath);

    try {
      await pipeline(req, validationWatcher, fileStream);
    } catch (err) {
      if (err.message === 'LIMIT_EXCEEDED') {
        return res.status(400).json({
          error: `File size too large for your ${req.user.tier} plan. Max: ${isPro ? '500MB' : '50MB'}.`,
          limit: sizeLimit,
          actual: bytesRead
        });
      }
      if (err.message === 'INVALID_CONTENT') {
        return res.status(400).json({
          error: `File content mismatch. The uploaded file does not appear to be a valid ${extension.toUpperCase()} file.`
        });
      }
      throw err; 
    }

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
    logger.error({ err: error.message, stack: error.stack, userId: req.userId, videoId }, "Upload video error");

    // Cleanup on failure
    try {
      await fs.rm(path.join(process.cwd(), 'storage', videoId), { recursive: true, force: true });
    } catch {}

    if (!res.headersSent) {
      res.status(500).json({
        error: "Failed to upload video.",
        details: error.message
      });
    }
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

    // 1. Reserve credit (Synchronous operations capture immediately after)
    const requestId = `sync-audio-${videoId}-${Date.now()}`;
    await userService.reserveCredits(req.userId, 1, requestId);

    try {
      await FF.extractAudio(originalVideoPath, targetAudioPath);

      // Update metadata
      await videoService.updateVideo(videoId, {
        metadata: { ...video.metadata, extractedAudio: true }
      });

      // 2. Capture credit on success
      await userService.captureCredits(requestId);

      res.status(200).json({
        status: "success",
        message: "Audio extracted successfully!"
      });
    } catch (err) {
      // 3. Release on failure
      await userService.releaseCredits(requestId);
      throw err;
    }
  } catch (error) {
    logger.error({ err: error.message, stack: error.stack, userId: req.userId, videoId }, "Extract audio error");
    res.status(500).json({ error: "Audio extraction failed." });
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

    // Atomic job submission: Operation record + Credit reservation + Outbox events
    const operation = await transaction(async (client) => {
      const op = await videoService.addOperation(videoId, {
        type: 'resize',
        status: 'pending',
        parameters: { width: parseInt(width), height: parseInt(height) }
      }, client);

      await userService.reserveCredits(req.userId, 1, `op-${op.id}`, client);
      return op;
    });

    // Enqueue job after DB success

    // Enqueue job
    if (queue) {
      await queue.enqueue({
        type: "resize",
        videoId,
        width: parseInt(width),
        height: parseInt(height),
        userId: req.userId,
        operationId: operation.id
      });
    }

    res.status(200).json({
      status: "success",
      message: "Video resize job queued!"
    });
  } catch (error) {
    logger.error({ err: error.message, stack: error.stack, userId: req.userId, videoId }, "Resize video error");
    res.status(500).json({ error: "Resize operation failed." });
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

    // Atomic job submission: Operation record + Credit reservation + Outbox events
    const operation = await transaction(async (client) => {
      const op = await videoService.addOperation(videoId, {
        type: 'convert',
        status: 'pending',
        parameters: { targetFormat, originalFormat: video.extension }
      }, client);

      await userService.reserveCredits(req.userId, 1, `op-${op.id}`, client);
      return op;
    });

    // Enqueue job after DB success

    // Enqueue job
    if (queue) {
      await queue.enqueue({
        type: "convert",
        videoId,
        targetFormat,
        originalFormat: video.extension,
        userId: req.userId,
        operationId: operation.id
      });
    }

    res.status(200).json({
      status: "success",
      message: `Video conversion to ${targetFormat.toUpperCase()} queued!`
    });
  } catch (error) {
    logger.error({ err: error.message, stack: error.stack, userId: req.userId, videoId }, "Convert video error");
    res.status(500).json({
      error: "Video conversion failed.",
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
      logger.error({ err: err.message, stack: err.stack, videoId }, "Stream error during asset retrieval");
      if (!res.headersSent) {
        res.status(500).json({ error: "Error streaming video" });
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
    const disposition = req.query.download === 'true' ? 'attachment' : 'inline';
    res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);

    if (type === "thumbnail") {
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
