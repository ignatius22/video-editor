const path = require("path");
const cluster = require("cluster");
const crypto = require("crypto");
const fsSync = require("fs");
const fs = require("fs").promises;
const Busboy = require("busboy");
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

    // Parse multipart form data using busboy
    const busboy = Busboy({ headers: req.headers });
    let fileReceived = false;

    await new Promise((resolve, reject) => {
      busboy.on("file", (_fieldname, file, _info) => {
        fileReceived = true;
        const fileStream = fsSync.createWriteStream(fullPath);

        file.pipe(fileStream);

        fileStream.on("finish", resolve);
        fileStream.on("error", reject);
        file.on("error", reject);
      });

      busboy.on("error", reject);

      req.pipe(busboy);
    });

    if (!fileReceived) {
      throw new Error("No file received in upload");
    }

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
      await jobs.enqueue({
        type: 'cropImage',
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
      await jobs.enqueue({
        type: 'resizeImage',
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
 * Convert an image to a different format
 */
const convertImage = async (req, res, handleErr) => {
  const { imageId, targetFormat } = req.body;

  if (!imageId || !targetFormat) {
    return handleErr({
      status: 400,
      message: "imageId and targetFormat are required.",
    });
  }

  const FORMATS_SUPPORTED = ["jpg", "jpeg", "png", "webp"];
  if (!FORMATS_SUPPORTED.includes(targetFormat.toLowerCase())) {
    return handleErr({
      status: 400,
      message: "Only these formats are allowed: jpg, jpeg, png, webp",
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

    const normalizedFormat = targetFormat.toLowerCase() === "jpeg" ? "jpg" : targetFormat.toLowerCase();

    const parameters = {
      targetFormat: normalizedFormat,
      originalFormat: image.extension
    };

    // Check if this operation already exists
    const existingOp = await imageService.findOperation(imageId, 'convert', parameters);
    if (existingOp && (existingOp.status === 'completed' || existingOp.status === 'processing')) {
      return res.status(200).json({
        status: "success",
        message: existingOp.status === 'completed' ? "Conversion already completed" : "Conversion already in progress",
        operation: existingOp
      });
    }

    // Create operation record
    const operation = await imageService.addOperation(imageId, {
      type: 'convert',
      status: 'pending',
      parameters
    });

    // Queue the job
    if (cluster.isPrimary && jobs) {
      await jobs.enqueue({
        type: 'convertImage',
        imageId,
        operation_id: operation.id,
        ...parameters
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Convert job queued successfully.",
      operation
    });
  } catch (e) {
    console.error("Convert image error:", e);
    return handleErr({
      status: 500,
      message: "Failed to queue convert operation.",
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

    const imageDir = `./storage/${imageId}`;
    let filePath;
    let filename;
    let extension;

    switch (type) {
      case "thumbnail":
        extension = "jpg";
        filename = `${image.name}-thumbnail.${extension}`;
        filePath = path.join(imageDir, "thumbnail.jpg");
        break;

      case "crop": {
        const { dimensions } = req.query; // format: "widthxheight_x_y"
        if (!dimensions) {
          return handleErr({ status: 400, message: "dimensions required for crop type." });
        }
        extension = "jpg";
        filename = `${image.name}-crop-${dimensions}.${extension}`;
        filePath = path.join(imageDir, `crop_${dimensions}.jpg`);
        break;
      }

      case "resize": {
        const { dimensions } = req.query; // format: "widthxheight"
        if (!dimensions) {
          return handleErr({ status: 400, message: "dimensions required for resize type." });
        }
        extension = "jpg";
        filename = `${image.name}-${dimensions}.${extension}`;
        filePath = path.join(imageDir, `${dimensions}.jpg`);
        break;
      }

      case "convert": {
        const { format } = req.query;
        if (!format) {
          return handleErr({ status: 400, message: "format required for convert type." });
        }
        extension = format.toLowerCase();
        filename = `${image.name}-converted.${extension}`;
        filePath = path.join(imageDir, `converted.${extension}`);
        break;
      }

      case "original":
      default:
        extension = image.extension;
        filename = `${image.name}.${extension}`;
        filePath = path.join(imageDir, `original.${image.extension}`);
        break;
    }

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return handleErr({ status: 404, message: "Image asset not found." });
    }

    // Check if download is requested
    const { download } = req.query;

    // Set appropriate headers
    const mimeType = util.getMimeFromExtension(extension);
    res.setHeader("Content-Type", mimeType || "application/octet-stream");

    if (download === 'true') {
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    } else {
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    }

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
    const mimeType = util.getMimeFromExtension(image.extension);
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
  convertImage,
  getImageAsset,
  getImageById
};
