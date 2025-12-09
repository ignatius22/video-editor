const path = require("path");
const cluster = require("cluster");
const crypto = require("crypto");
const fsSync = require("fs");
const fs = require("fs").promises;
const { promisify } = require("util");
const stream = require("stream");
const pipeline = promisify(stream.pipeline);
const util = require("../../lib/util");
const imageService = require("../../database/services/imageService");
const FF = require("../../lib/FF");

let jobs;
if (cluster.isPrimary) {
  const BullQueue = require("../../lib/BullQueue");
  jobs = new BullQueue();
}

/**
 * Get all images for the logged-in user
 */
const getImages = async (req, res, handleErr) => {
  try {
    const images = await imageService.getUserImages(req.userId, {
      limit: 100,
      offset: 0,
      orderBy: 'created_at',
      order: 'DESC'
    });

    res.status(200).json(images);
  } catch (error) {
    console.error("Get images error:", error);
    return handleErr({ status: 500, message: "Failed to retrieve images." });
  }
};

/**
 * Upload an image file
 */
const uploadImage = async (req, res, handleErr) => {
  const specifiedFileName = req.headers.filename;
  if (!specifiedFileName) {
    return handleErr({ status: 400, message: "Filename header is required." });
  }

  const extension = path.extname(specifiedFileName).substring(1).toLowerCase();
  const name = path.parse(specifiedFileName).name;
  const imageId = crypto.randomBytes(4).toString("hex");

  const FORMATS_SUPPORTED = ["jpg", "jpeg", "png", "webp", "gif"];
  if (!FORMATS_SUPPORTED.includes(extension)) {
    return handleErr({
      status: 400,
      message: "Only these formats are allowed: jpg, jpeg, png, webp, gif",
    });
  }

  try {
    const imageDir = `./storage/${imageId}`;
    await fs.mkdir(imageDir, { recursive: true });

    const normalizedExt = extension === "jpeg" ? "jpg" : extension;
    const fullPath = path.join(imageDir, `original.${normalizedExt}`);
    const fileStream = fsSync.createWriteStream(fullPath);

    // Pipe request to file safely
    await pipeline(req, fileStream);

    // Get image dimensions using FFmpeg
    const dimensions = await FF.getDimensions(fullPath);

    // Generate thumbnail
    const thumbnailPath = path.join(imageDir, "thumbnail.jpg");
    const thumbWidth = Math.min(dimensions.width, 300);
    const thumbHeight = Math.min(dimensions.height, 300);
    await FF.resizeImage(fullPath, thumbnailPath, thumbWidth, thumbHeight);

    // Save to database
    await imageService.createImage({
      imageId,
      userId: req.userId,
      name,
      extension: normalizedExt,
      dimensions,
      metadata: {}
    });

    return res.status(201).json({
      status: "success",
      message: "The image was uploaded successfully!",
      imageId,
    });
  } catch (e) {
    console.error("Upload failed:", e);
    // Cleanup
    try {
      await fs.rm(`./storage/${imageId}`, { recursive: true, force: true });
    } catch {}

    if (!res.headersSent) {
      return handleErr({
        status: 500,
        message: "Failed to upload image.",
        details: e.message,
      });
    }
  }
};

/**
 * Crop an image
 */
const cropImage = async (req, res, handleErr) => {
  const { imageId, width, height, x = 0, y = 0 } = req.body;

  if (!imageId || !width || !height) {
    return handleErr({
      status: 400,
      message: "imageId, width, and height are required.",
    });
  }

  try {
    // Verify image exists and belongs to user
    const image = await imageService.findByImageId(imageId);
    if (!image) {
      return handleErr({ status: 404, message: "Image not found." });
    }

    if (image.user_id !== req.userId) {
      return handleErr({ status: 403, message: "Unauthorized access to image." });
    }

    const parameters = {
      width: parseInt(width),
      height: parseInt(height),
      x: parseInt(x),
      y: parseInt(y)
    };

    // Check if this operation already exists
    const existingOp = await imageService.findOperation(imageId, 'crop', parameters);
    if (existingOp && (existingOp.status === 'completed' || existingOp.status === 'processing')) {
      return res.status(200).json({
        status: "success",
        message: existingOp.status === 'completed' ? "Crop already completed" : "Crop already in progress",
        operation: existingOp
      });
    }

    // Create operation record
    const operation = await imageService.addOperation(imageId, {
      type: 'crop',
      status: 'pending',
      parameters
    });

    // Queue the job
    if (cluster.isPrimary && jobs) {
      await jobs.createJob('cropImage', {
        imageId,
        operation_id: operation.id,
        ...parameters
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Crop job queued successfully.",
      operation
    });
  } catch (e) {
    console.error("Crop image error:", e);
    return handleErr({
      status: 500,
      message: "Failed to queue crop operation.",
      details: e.message,
    });
  }
};

/**
 * Resize an image
 */
const resizeImage = async (req, res, handleErr) => {
  const { imageId, width, height } = req.body;

  if (!imageId || !width || !height) {
    return handleErr({
      status: 400,
      message: "imageId, width, and height are required.",
    });
  }

  try {
    // Verify image exists and belongs to user
    const image = await imageService.findByImageId(imageId);
    if (!image) {
      return handleErr({ status: 404, message: "Image not found." });
    }

    if (image.user_id !== req.userId) {
      return handleErr({ status: 403, message: "Unauthorized access to image." });
    }

    const parameters = {
      width: parseInt(width),
      height: parseInt(height)
    };

    // Check if this operation already exists
    const existingOp = await imageService.findOperation(imageId, 'resize', parameters);
    if (existingOp && (existingOp.status === 'completed' || existingOp.status === 'processing')) {
      return res.status(200).json({
        status: "success",
        message: existingOp.status === 'completed' ? "Resize already completed" : "Resize already in progress",
        operation: existingOp
      });
    }

    // Create operation record
    const operation = await imageService.addOperation(imageId, {
      type: 'resize',
      status: 'pending',
      parameters
    });

    // Queue the job
    if (cluster.isPrimary && jobs) {
      await jobs.createJob('resizeImage', {
        imageId,
        operation_id: operation.id,
        ...parameters
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Resize job queued successfully.",
      operation
    });
  } catch (e) {
    console.error("Resize image error:", e);
    return handleErr({
      status: 500,
      message: "Failed to queue resize operation.",
      details: e.message,
    });
  }
};

/**
 * Get an image asset (original, thumbnail, cropped, or resized)
 */
const getImageAsset = async (req, res, handleErr) => {
  const { imageId, type } = req.query;

  if (!imageId) {
    return handleErr({ status: 400, message: "imageId is required." });
  }

  try {
    const image = await imageService.findByImageId(imageId);
    if (!image) {
      return handleErr({ status: 404, message: "Image not found." });
    }

    // Verify ownership
    if (image.user_id !== req.userId) {
      return handleErr({ status: 403, message: "Unauthorized access to image." });
    }

    const imageDir = `./storage/${imageId}`;
    let filePath;

    switch (type) {
      case "thumbnail":
        filePath = path.join(imageDir, "thumbnail.jpg");
        break;

      case "crop": {
        const { dimensions } = req.query; // format: "widthxheight_x_y"
        if (!dimensions) {
          return handleErr({ status: 400, message: "dimensions required for crop type." });
        }
        filePath = path.join(imageDir, `crop_${dimensions}.jpg`);
        break;
      }

      case "resize": {
        const { dimensions } = req.query; // format: "widthxheight"
        if (!dimensions) {
          return handleErr({ status: 400, message: "dimensions required for resize type." });
        }
        filePath = path.join(imageDir, `${dimensions}.jpg`);
        break;
      }

      case "original":
      default:
        filePath = path.join(imageDir, `original.${image.extension}`);
        break;
    }

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return handleErr({ status: 404, message: "Image asset not found." });
    }

    // Set appropriate headers
    const mimeType = util.getMimeType(path.extname(filePath).substring(1));
    res.setHeader("Content-Type", mimeType || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=86400"); // 24 hours

    // Stream the file
    const fileStream = fsSync.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on("error", (error) => {
      console.error("Stream error:", error);
      if (!res.headersSent) {
        return handleErr({ status: 500, message: "Failed to stream image." });
      }
    });
  } catch (e) {
    console.error("Get image asset error:", e);
    if (!res.headersSent) {
      return handleErr({
        status: 500,
        message: "Failed to retrieve image asset.",
        details: e.message,
      });
    }
  }
};

/**
 * Get a specific image by ID (returns the image blob)
 */
const getImageById = async (req, res, handleErr) => {
  const { imageId } = req.params;

  if (!imageId) {
    return handleErr({ status: 400, message: "imageId is required." });
  }

  try {
    const image = await imageService.findByImageId(imageId);
    if (!image) {
      return handleErr({ status: 404, message: "Image not found." });
    }

    // Verify ownership
    if (image.user_id !== req.userId) {
      return handleErr({ status: 403, message: "Unauthorized access to image." });
    }

    const imageDir = `./storage/${imageId}`;
    const filePath = path.join(imageDir, `original.${image.extension}`);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return handleErr({ status: 404, message: "Image file not found." });
    }

    // Set appropriate headers
    const mimeType = util.getMimeType(image.extension);
    res.setHeader("Content-Type", mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${image.name}.${image.extension}"`);

    // Stream the file
    const fileStream = fsSync.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on("error", (error) => {
      console.error("Stream error:", error);
      if (!res.headersSent) {
        return handleErr({ status: 500, message: "Failed to stream image." });
      }
    });
  } catch (e) {
    console.error("Get image by ID error:", e);
    if (!res.headersSent) {
      return handleErr({
        status: 500,
        message: "Failed to retrieve image.",
        details: e.message,
      });
    }
  }
};

module.exports = {
  getImages,
  uploadImage,
  cropImage,
  resizeImage,
  getImageAsset,
  getImageById
};
