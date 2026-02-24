const path = require("path");
const crypto = require("crypto");
const fsSync = require("fs");
const fs = require("fs").promises;
const { promisify } = require("util");
const stream = require("stream");
const pipeline = promisify(stream.pipeline);

const imageService = require("@video-editor/shared/database/services/imageService");
const FFOriginal = require("@video-editor/shared/lib/FF");
const util = require("@video-editor/shared/lib/util");
const telemetry = require("@video-editor/shared/telemetry");
const userService = require("@video-editor/shared/database/services/userService");

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
 * Get user images
 * GET /api/images
 */
const getImages = async (req, res) => {
  try {
    const images = await imageService.getUserImages(req.userId, {
      limit: 100,
      offset: 0,
      orderBy: "created_at",
      order: "DESC"
    });

    res.status(200).json(images);
  } catch (error) {
    console.error("[API] Get images error:", error);
    res.status(500).json({ error: "Failed to retrieve images." });
  }
};

/**
 * Upload image
 * POST /api/images/upload
 */
const uploadImage = async (req, res) => {
  const specifiedFileName = req.headers.filename;

  if (!specifiedFileName) {
    return res.status(400).json({ error: "Filename header is required." });
  }

  const extension = path.extname(specifiedFileName).substring(1).toLowerCase();
  const name = path.parse(specifiedFileName).name;
  const imageId = crypto.randomBytes(4).toString("hex");

  // Tier-based size limits
  const isPro = req.user && req.user.tier === 'pro';
  const sizeLimit = isPro ? 50 * 1024 * 1024 : 10 * 1024 * 1024; // 50MB for Pro, 10MB for Free
  
  if (req.body.length > sizeLimit) {
    return res.status(400).json({
      error: `File size too large for your ${req.user.tier} plan. Max: ${isPro ? '50MB' : '10MB'}.`,
      limit: sizeLimit,
      actual: req.body.length
    });
  }

  if (!["jpg", "jpeg", "png", "gif", "webp"].includes(extension)) {
    return res.status(400).json({ error: "Unsupported image format" });
  }

  try {
    const imageDir = path.join(process.cwd(), 'storage', imageId);
    await fs.mkdir(imageDir, { recursive: true });

    const fullPath = path.join(imageDir, `original.${extension}`);

    // Write buffer to file (req.body is Buffer from express.raw middleware)
    await fs.writeFile(fullPath, req.body);

    const dimensions = await FF.getDimensions(fullPath);

    await imageService.createImage({
      imageId,
      userId: req.userId,
      name,
      extension,
      dimensions,
      metadata: { type: "image" }
    });

    res.status(201).json({
      status: "success",
      message: "Image uploaded!",
      imageId,
      name,
      dimensions
    });
  } catch (error) {
    console.error("[API] Image upload error:", error);

    try {
      await fs.rm(`./storage/${imageId}`, { recursive: true, force: true });
    } catch {}

    res.status(500).json({
      error: "Failed to upload image.",
      details: error.message
    });
  }
};

/**
 * Crop image
 * POST /api/images/crop
 */
const cropImage = async (req, res) => {
  const { imageId, width, height, x, y } = req.body;

  if (!imageId || !width || !height) {
    return res.status(400).json({ error: "imageId, width, and height are required" });
  }

  try {
    const image = await imageService.findByImageId(imageId);

    if (!image) {
      return res.status(404).json({ error: "Image not found." });
    }

    if (image.user_id !== req.userId) {
      return res.status(403).json({ error: "Access denied." });
    }

    const cropX = x || 0;
    const cropY = y || 0;

    if (cropX + width > image.dimensions.width || cropY + height > image.dimensions.height) {
      return res.status(400).json({ error: "Crop area exceeds image bounds." });
    }

    const parameters = {
      width: parseInt(width),
      height: parseInt(height),
      x: parseInt(cropX),
      y: parseInt(cropY)
    };

    await imageService.addOperation(imageId, {
      type: "crop",
      status: "pending",
      parameters
    });

    if (queue) {
      await queue.enqueue({
        type: "crop",
        imageId,
        ...parameters,
        userId: req.userId
      });
    }

    // Deduct credit
    await userService.deductCredits(req.userId, 1, `Cropped image ${imageId} to ${width}x${height}`);

    res.status(200).json({
      status: "success",
      message: "Image cropping queued!"
    });
  } catch (error) {
    console.error("[API] Crop error:", error);
    res.status(500).json({ error: "Failed to start crop job." });
  }
};

/**
 * Resize image
 * POST /api/images/resize
 */
const resizeImage = async (req, res) => {
  const { imageId, width, height } = req.body;

  if (!imageId || !width || !height) {
    return res.status(400).json({ error: "imageId, width, and height are required" });
  }

  try {
    const image = await imageService.findByImageId(imageId);

    if (!image) {
      return res.status(404).json({ error: "Image not found." });
    }

    if (image.user_id !== req.userId) {
      return res.status(403).json({ error: "Access denied." });
    }

    const parameters = { width: parseInt(width), height: parseInt(height) };

    await imageService.addOperation(imageId, {
      type: "resize",
      status: "pending",
      parameters
    });

    if (queue) {
      await queue.enqueue({
        type: "resize-image",
        imageId,
        ...parameters,
        userId: req.userId
      });
    }

    // Deduct credit
    await userService.deductCredits(req.userId, 1, `Resized image ${imageId} to ${width}x${height}`);

    res.status(200).json({
      status: "success",
      message: "Image resizing queued!"
    });
  } catch (error) {
    console.error("[API] Resize error:", error);
    res.status(500).json({ error: "Failed to start resize job." });
  }
};

/**
 * Convert image format
 * POST /api/images/convert
 */
const convertImage = async (req, res) => {
  const { imageId, targetFormat } = req.body;

  if (!imageId || !targetFormat) {
    return res.status(400).json({ error: "imageId and targetFormat required" });
  }

  const supported = ["jpg", "jpeg", "png", "gif", "webp"];
  if (!supported.includes(targetFormat.toLowerCase())) {
    return res.status(400).json({
      error: `Unsupported format. Supported: ${supported.join(", ")}`
    });
  }

  try {
    const image = await imageService.findByImageId(imageId);

    if (!image) {
      return res.status(404).json({ error: "Image not found." });
    }

    if (image.user_id !== req.userId) {
      return res.status(403).json({ error: "Access denied." });
    }

    if (image.extension === targetFormat) {
      return res.status(400).json({
        error: `Already in ${targetFormat.toUpperCase()} format.`
      });
    }

    const parameters = {
      targetFormat: targetFormat.toLowerCase(),
      originalFormat: image.extension.toLowerCase()
    };

    await imageService.addOperation(imageId, {
      type: "convert-image",
      status: "pending",
      parameters
    });

    if (queue) {
      await queue.enqueue({
        type: "convert-image",
        imageId,
        ...parameters,
        userId: req.userId
      });
    }

    // Deduct credit
    await userService.deductCredits(req.userId, 1, `Converted image ${imageId} to ${targetFormat.toUpperCase()}`);

    res.status(200).json({
      status: "success",
      message: `Conversion to ${targetFormat.toUpperCase()} queued!`
    });
  } catch (error) {
    console.error("[API] Convert error:", error);
    res.status(500).json({ error: "Failed to start convert job." });
  }
};

/**
 * Get image asset
 * GET /api/images/asset
 */
const getImageAsset = async (req, res) => {
  const { imageId, type, dimensions, format } = req.query;

  if (!imageId || !type) {
    return res.status(400).json({ error: "imageId and type are required." });
  }

  try {
    const image = await imageService.findByImageId(imageId);

    if (!image) {
      return res.status(404).json({ error: "Image not found." });
    }

    if (image.user_id !== req.userId) {
      return res.status(403).json({ error: "Access denied." });
    }

    let filePath;
    let extension;

    switch (type) {
      case "original":
        extension = image.extension;
        filePath = `./storage/${imageId}/original.${extension}`;
        break;

      case "cropped":
        if (!dimensions) {
          return res.status(400).json({
            error: "dimensions parameter required (format: WxHxXxY)"
          });
        }
        extension = image.extension;
        filePath = `./storage/${imageId}/cropped_${dimensions}.${extension}`;
        break;

      case "resized":
        if (!dimensions) {
          return res.status(400).json({
            error: "dimensions parameter required (format: WxH)"
          });
        }
        extension = image.extension;
        filePath = `./storage/${imageId}/resized_${dimensions}.${extension}`;
        break;

      case "converted":
        if (!format) {
          return res.status(400).json({
            error: "format parameter required"
          });
        }
        extension = format.toLowerCase();
        filePath = `./storage/${imageId}/converted.${extension}`;
        break;

      default:
        return res.status(400).json({ error: "Invalid asset type." });
    }

    await fs.access(filePath);
    const stat = await fs.stat(filePath);

    const readStream = fsSync.createReadStream(filePath, {
      highWaterMark: 64 * 1024
    });

    readStream.on("error", (err) => {
      console.error("[API] Stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error streaming asset." });
      }
      readStream.destroy();
    });

    res.on("close", () => {
      if (readStream && !readStream.destroyed) {
        readStream.destroy();
      }
    });

    res.setHeader("Content-Type", util.getMimeFromExtension(extension));
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    res.setHeader("ETag", `"${imageId}-${stat.size}-${stat.mtimeMs}"`);

    readStream.pipe(res);

    readStream.on("end", () => {
      if (!res.writableEnded) {
        res.end();
      }
    });
  } catch (error) {
    console.error("[API] Asset error:", error);

    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: "Asset not found." });
    }

    if (!res.headersSent) {
      res.status(404).json({ error: "Asset not found." });
    }
  }
};

module.exports = {
  setQueue,
  getImages,
  uploadImage,
  cropImage,
  resizeImage,
  convertImage,
  getImageAsset
};
