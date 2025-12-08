const path = require("path");
const crypto = require("crypto");
const fsSync = require("fs");
const fs = require("fs").promises;
const { promisify } = require("util");
const stream = require("stream");
const pipeline = promisify(stream.pipeline);

const videoService = require("../../shared/database/services/videoService");
const FF = require("../../../lib/FF");
const util = require("../../../lib/util");
const { EventTypes } = require("../../shared/eventBus");
const { metrics } = require("../../shared/middleware/metrics");

/**
 * ----------------------------------------
 * GET USER VIDEOS
 * ----------------------------------------
 */
const getVideos = async (req, res) => {
  try {
    const videos = await videoService.getUserVideos(req.userId, {
      limit: 100,
      offset: 0,
      orderBy: "created_at",
      order: "DESC",
    });

    res.status(200).json(videos);
  } catch (error) {
    console.error("[Video Service] Get videos error:", error);
    res.status(500).json({ error: "Failed to retrieve videos." });
  }
};

/**
 * ----------------------------------------
 * UPLOAD VIDEO
 * ----------------------------------------
 */
const uploadVideo = async (req, res) => {
  const specifiedFileName = req.headers.filename;

  if (!specifiedFileName) {
    return res.status(400).json({ error: "Filename header is required." });
  }

  const extension = path.extname(specifiedFileName).substring(1).toLowerCase();
  const name = path.parse(specifiedFileName).name;
  const videoId = crypto.randomBytes(4).toString("hex");

  if (!["mp4", "mov"].includes(extension)) {
    return res.status(400).json({
      error: "Only these formats are allowed: mov, mp4",
    });
  }

  try {
    const videoDir = path.join(__dirname, `../../../storage/${videoId}`);
    await fs.mkdir(videoDir, { recursive: true });

    const fullPath = path.join(videoDir, `original.${extension}`);
    const fileStream = fsSync.createWriteStream(fullPath);

    await pipeline(req, fileStream);

    // Thumbnail + dimensions
    const thumbnailPath = path.join(videoDir, "thumbnail.jpg");
    await FF.makeThumbnail(fullPath, thumbnailPath);
    const dimensions = await FF.getDimensions(fullPath);

    // DB entry
    await videoService.createVideo({
      videoId,
      userId: req.userId,
      name,
      extension,
      dimensions,
      metadata: { extractedAudio: false },
    });

    // Publish event
    try {
      await req.app.locals.eventBus.publish(EventTypes.VIDEO_UPLOADED, {
        videoId,
        userId: req.userId,
        name,
        extension,
        dimensions,
      });
    } catch (e) {
      console.error("[Video Service] Failed publishing event:", e.message);
    }

    // Instrumentation: increment video uploads counter
    try {
      metrics.appVideoUploads.labels('video-service').inc();
    } catch (e) {
      // ignore metric errors
    }

    res.status(201).json({
      status: "success",
      message: "Video uploaded successfully!",
      videoId,
      name,
      dimensions,
    });
  } catch (e) {
    console.error("[Video Service] Upload failed:", e);

    // Cleanup
    try {
      await fs.rm(path.join(__dirname, `../../../storage/${videoId}`), {
        recursive: true,
        force: true,
      });
    } catch {}

    res.status(500).json({
      error: "Failed to upload video.",
      details: e.message,
    });
  }
};

/**
 * ----------------------------------------
 * EXTRACT AUDIO
 * ----------------------------------------
 */
const extractAudio = async (req, res) => {
  const { videoId } = req.body;

  try {
    const video = await videoService.findByVideoId(videoId);
    if (!video) return res.status(404).json({ error: "Video not found." });

    if (video.metadata?.extractedAudio) {
      return res.status(400).json({
        error: "Audio already extracted for this video.",
      });
    }

    const source = path.join(
      __dirname,
      `../../../storage/${videoId}/original.${video.extension}`
    );
    const target = path.join(
      __dirname,
      `../../../storage/${videoId}/audio.aac`
    );

    await FF.extractAudio(source, target);

    await videoService.updateVideo(videoId, {
      metadata: { ...video.metadata, extractedAudio: true },
    });

    res.status(200).json({
      status: "success",
      message: "Audio extracted successfully!",
    });
  } catch (e) {
    console.error("[Video Service] Extract audio error:", e);
    res.status(500).json({
      error: "Failed to extract audio.",
      details: e.message,
    });
  }
};

/**
 * ----------------------------------------
 * RESIZE VIDEO
 * ----------------------------------------
 */
const resizeVideo = async (req, res) => {
  const { videoId, width, height } = req.body;

  try {
    const video = await videoService.findByVideoId(videoId);
    if (!video) return res.status(404).json({ error: "Video not found." });

    await videoService.addOperation(videoId, {
      type: "resize",
      status: "pending",
      parameters: { width, height },
    });

    // Instrumentation: job created
    try {
      metrics.appJobsCreated.labels('video-service', 'resize', 'video').inc();
    } catch (e) {}

    await req.app.locals.eventBus.publish(
      EventTypes.VIDEO_PROCESSING_REQUESTED,
      {
        videoId,
        userId: req.userId,
        operation: "resize",
        parameters: { width, height },
      }
    );

    res.status(200).json({
      status: "success",
      message: "Video resize started.",
    });
  } catch (error) {
    console.error("[Video Service] Resize error:", error);
    res.status(500).json({ error: "Failed to start resize job." });
  }
};

/**
 * ----------------------------------------
 * CONVERT VIDEO FORMAT
 * ----------------------------------------
 */
const convertVideo = async (req, res) => {
  const { videoId, targetFormat } = req.body;

  if (!targetFormat)
    return res.status(400).json({ error: "targetFormat is required." });

  const supported = ["mp4", "mov", "avi", "webm", "mkv", "flv"];
  if (!supported.includes(targetFormat.toLowerCase())) {
    return res.status(400).json({
      error: `Unsupported format. Supported: ${supported.join(", ")}`,
    });
  }

  try {
    const video = await videoService.findByVideoId(videoId);
    if (!video) return res.status(404).json({ error: "Video not found." });

    if (video.extension === targetFormat) {
      return res.status(400).json({
        error: `Already in ${targetFormat.toUpperCase()} format.`,
      });
    }

    const parameters = {
      targetFormat: targetFormat.toLowerCase(),
      originalFormat: video.extension.toLowerCase(),
    };

    await videoService.addOperation(videoId, {
      type: "convert",
      status: "pending",
      parameters,
    });

    // Instrumentation: job created
    try {
      metrics.appJobsCreated.labels('video-service', 'convert', 'video').inc();
    } catch (e) {}

    await req.app.locals.eventBus.publish(
      EventTypes.VIDEO_PROCESSING_REQUESTED,
      {
        videoId,
        userId: req.userId,
        operation: "convert",
        parameters,
      }
    );

    res.status(200).json({
      status: "success",
      message: `Conversion to ${targetFormat.toUpperCase()} started.`,
    });
  } catch (e) {
    console.error("[Video Service] Convert error:", e);
    res.status(500).json({
      error: "Video conversion failed.",
      details: e.message,
    });
  }
};

/**
 * ----------------------------------------
 * GET ASSET (THUMBNAIL, AUDIO, ORIGINAL, RESIZED, CONVERTED)
 * ----------------------------------------
 */
const getVideoAsset = async (req, res) => {
  const { videoId, type, format, dimensions } = req.query;

  try {
    const video = await videoService.findByVideoId(videoId);
    if (!video) return res.status(404).json({ error: "Video not found." });

    let filePath;
    let extension;

    switch (type) {
      case "thumbnail":
        extension = "jpg";
        filePath = path.join(
          __dirname,
          `../../../storage/${videoId}/thumbnail.jpg`
        );
        break;

      case "audio":
        extension = "aac";
        filePath = path.join(
          __dirname,
          `../../../storage/${videoId}/audio.aac`
        );
        break;

      case "resize":
        extension = video.extension;
        filePath = path.join(
          __dirname,
          `../../../storage/${videoId}/${dimensions}.${extension}`
        );
        break;

      case "original":
        extension = video.extension;
        filePath = path.join(
          __dirname,
          `../../../storage/${videoId}/original.${extension}`
        );
        break;

      case "converted":
        extension = format || "mp4";
        filePath = path.join(
          __dirname,
          `../../../storage/${videoId}/converted.${extension}`
        );

        const op = await videoService.findOperation(videoId, "convert", {
          targetFormat: extension.toLowerCase(),
        });

        if (!op || op.status !== "completed") {
          return res.status(400).json({
            error: `Conversion to ${extension.toUpperCase()} not complete.`,
          });
        }
        break;

      default:
        return res.status(400).json({ error: "Invalid asset type." });
    }

    await fs.access(filePath);
    const stat = await fs.stat(filePath);
    const readStream = fsSync.createReadStream(filePath);

    res.setHeader("Content-Type", util.getMimeFromExtension(extension));
    res.setHeader("Content-Length", stat.size);

    readStream.pipe(res);
  } catch (e) {
    console.error("[Video Service] Asset error:", e);
    res.status(404).json({ error: "Asset not found." });
  }
};

/**
 * ----------------------------------------
 * WATERMARK VIDEO
 * ----------------------------------------
 */

/**
 * ----------------------------------------
 * TRIM VIDEO
 * ----------------------------------------
 */

/**
 * ----------------------------------------
 * UPLOAD IMAGE
 * ----------------------------------------
 */
const uploadImage = async (req, res) => {
  const specifiedFileName = req.headers.filename;
  if (!specifiedFileName)
    return res.status(400).json({ error: "Filename header is required." });

  const extension = path.extname(specifiedFileName).substring(1).toLowerCase();
  const name = path.parse(specifiedFileName).name;
  const imageId = crypto.randomBytes(4).toString("hex");

  if (!["jpg", "jpeg", "png", "gif", "webp"].includes(extension)) {
    return res.status(400).json({ error: "Unsupported image format" });
  }

  try {
    const imageDir = path.join(__dirname, `../../../storage/${imageId}`);
    await fs.mkdir(imageDir, { recursive: true });

    const fullPath = path.join(imageDir, `original.${extension}`);
    const fileStream = fsSync.createWriteStream(fullPath);

    await pipeline(req, fileStream);

    const dimensions = await FF.getDimensions(fullPath);

    await videoService.createVideo({
      videoId: imageId,
      userId: req.userId,
      name,
      extension,
      dimensions,
      metadata: { type: "image" },
    });

    await req.app.locals.eventBus.publish(EventTypes.IMAGE_UPLOADED, {
      imageId,
      userId: req.userId,
      name,
      extension,
      dimensions,
    });

    // Instrumentation: increment image uploads
    try {
      metrics.appImageUploads.labels('video-service').inc();
    } catch (e) {
      // ignore metric errors
    }

    res.status(201).json({
      status: "success",
      message: "Image uploaded!",
      imageId,
      name,
      dimensions,
    });
  } catch (e) {
    console.error("[Video Service] Image upload error:", e);

    try {
      await fs.rm(path.join(__dirname, `../../../storage/${imageId}`), {
        recursive: true,
        force: true,
      });
    } catch {}

    res.status(500).json({
      error: "Failed to upload image.",
      details: e.message,
    });
  }
};

/**
 * ----------------------------------------
 * CROP IMAGE
 * ----------------------------------------
 */
const cropImage = async (req, res) => {
  const { imageId, width, height, x, y } = req.body;

  if (!imageId || !width || !height) {
    return res.status(400).json({ error: "imageId, width, height required" });
  }

  const image = await videoService.findByVideoId(imageId);
  if (!image) return res.status(404).json({ error: "Image not found." });
  if (image.metadata?.type !== "image") {
    return res.status(400).json({ error: "This endpoint is for images only" });
  }

  const cropX = x || 0;
  const cropY = y || 0;

  if (
    cropX + width > image.dimensions.width ||
    cropY + height > image.dimensions.height
  ) {
    return res.status(400).json({
      error: "Crop area exceeds image bounds.",
    });
  }

  const parameters = { width, height, x: cropX, y: cropY };

  await videoService.addOperation(imageId, {
    type: "crop",
    status: "pending",
    parameters,
  });

  // Instrumentation: job created
  try {
    metrics.appJobsCreated.labels('video-service', 'crop', 'image').inc();
  } catch (e) {}

  await req.app.locals.eventBus.publish(EventTypes.IMAGE_PROCESSING_REQUESTED, {
    imageId,
    userId: req.userId,
    operation: "crop",
    parameters,
  });

  res.status(200).json({
    status: "success",
    message: "Image cropping started.",
  });
};

/**
 * ----------------------------------------
 * CREATE GIF
 * ----------------------------------------
 */

/**
 * Trim video (queue job)
 * POST /trim
 */
const trimVideo = async (req, res) => {
  const { videoId, startTime, endTime } = req.body;

  // Validate required fields
  if (!videoId || startTime === undefined || endTime === undefined) {
    return res.status(400).json({
      error: "videoId, startTime, and endTime are required!",
    });
  }

  // Validate time values
  if (startTime < 0 || endTime < 0) {
    return res.status(400).json({
      error: "Start time and end time must be non-negative.",
    });
  }

  if (endTime <= startTime) {
    return res.status(400).json({
      error: "End time must be greater than start time.",
    });
  }

  try {
    // Check if video exists
    const video = await videoService.findByVideoId(videoId);
    if (!video) {
      return res.status(404).json({ error: "Video not found." });
    }

    // Add trim operation to database
    await videoService.addOperation(videoId, {
      type: "trim",
      status: "pending",
      parameters: { startTime, endTime },
    });

    // Instrumentation: job created
    try {
      metrics.appJobsCreated.labels('video-service', 'trim', 'video').inc();
    } catch (e) {}

    // Publish VIDEO_PROCESSING_REQUESTED event
    try {
      await req.app.locals.eventBus.publish(
        EventTypes.VIDEO_PROCESSING_REQUESTED,
        {
          videoId,
          userId: req.userId,
          operation: "trim",
          parameters: { startTime, endTime },
        }
      );
      console.log(
        `[Video Service] Published VIDEO_PROCESSING_REQUESTED event for videoId: ${videoId}`
      );

      res.status(200).json({
        status: "success",
        message: "The video is now being trimmed!",
      });
    } catch (error) {
      console.error("[Video Service] Failed to publish event:", error.message);
      res.status(500).json({
        error: "Failed to start video trim.",
        details: "Event bus unavailable",
      });
    }
  } catch (error) {
    console.error("[Video Service] Trim video error:", error);
    res.status(500).json({
      error: "Failed to start video trim.",
    });
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
      error: "videoId and text are required!",
    });
  }

  // Validate text length
  if (text.length > 100) {
    return res.status(400).json({
      error: "Watermark text must be 100 characters or less.",
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
      type: "watermark",
      status: "pending",
      parameters: { text, ...options },
    });

    // Instrumentation: job created
    try {
      metrics.appJobsCreated.labels('video-service', 'watermark', 'video').inc();
    } catch (e) {}

    // Publish VIDEO_PROCESSING_REQUESTED event
    try {
      await req.app.locals.eventBus.publish(
        EventTypes.VIDEO_PROCESSING_REQUESTED,
        {
          videoId,
          userId: req.userId,
          operation: "watermark",
          parameters: { text, ...options },
        }
      );
      console.log(
        `[Video Service] Published VIDEO_PROCESSING_REQUESTED event for videoId: ${videoId}`
      );

      res.status(200).json({
        status: "success",
        message: "The video is now being watermarked!",
      });
    } catch (error) {
      console.error("[Video Service] Failed to publish event:", error.message);
      res.status(500).json({
        error: "Failed to start video watermarking.",
        details: "Event bus unavailable",
      });
    }
  } catch (error) {
    console.error("[Video Service] Watermark video error:", error);
    res.status(500).json({
      error: "Failed to start video watermarking.",
    });
  }
};

/**
 * Create GIF from video (queue job)
 * POST /create-gif
 */
const createGif = async (req, res) => {
  const { videoId, fps, width, startTime, duration } = req.body;

  // Validate required field
  if (!videoId) {
    return res.status(400).json({
      error: "videoId is required!",
    });
  }

  // Validate optional parameters
  if (fps !== undefined && (fps < 1 || fps > 30)) {
    return res.status(400).json({
      error: "FPS must be between 1 and 30.",
    });
  }

  if (width !== undefined && (width < 100 || width > 1920)) {
    return res.status(400).json({
      error: "Width must be between 100 and 1920 pixels.",
    });
  }

  if (startTime !== undefined && startTime < 0) {
    return res.status(400).json({
      error: "Start time must be non-negative.",
    });
  }

  if (duration !== undefined && duration <= 0) {
    return res.status(400).json({
      error: "Duration must be positive.",
    });
  }

  try {
    // Check if video exists
    const video = await videoService.findByVideoId(videoId);
    if (!video) {
      return res.status(404).json({ error: "Video not found." });
    }

    // Build GIF options
    const options = {};
    if (fps !== undefined) options.fps = fps;
    if (width !== undefined) options.width = width;
    if (startTime !== undefined) options.startTime = startTime;
    if (duration !== undefined) options.duration = duration;

    // Add create-gif operation to database
    await videoService.addOperation(videoId, {
      type: "create-gif",
      status: "pending",
      parameters: options,
    });

    // Instrumentation: job created
    try {
      metrics.appJobsCreated.labels('video-service', 'create-gif', 'video').inc();
    } catch (e) {}

    // Publish VIDEO_PROCESSING_REQUESTED event
    try {
      await req.app.locals.eventBus.publish(
        EventTypes.VIDEO_PROCESSING_REQUESTED,
        {
          videoId,
          userId: req.userId,
          operation: "create-gif",
          parameters: options,
        }
      );
      console.log(
        `[Video Service] Published VIDEO_PROCESSING_REQUESTED event for videoId: ${videoId}`
      );

      res.status(200).json({
        status: "success",
        message: "The GIF is now being created!",
      });
    } catch (error) {
      console.error("[Video Service] Failed to publish event:", error.message);
      res.status(500).json({
        error: "Failed to start GIF creation.",
        details: "Event bus unavailable",
      });
    }
  } catch (error) {
    console.error("[Video Service] Create GIF error:", error);
    res.status(500).json({
      error: "Failed to start GIF creation.",
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
  watermarkVideo,
  trimVideo,
  uploadImage,
  cropImage,
  createGif,
};
