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
 * GET USER IMAGES
 * ----------------------------------------
 */
const getImages = async (req, res) => {
  try {
    const images = await videoService.getUserVideos(req.userId, {
      limit: 100,
      offset: 0,
      orderBy: "created_at",
      order: "DESC",
      filter: { metadata: { type: "image" } },
    });

    res.status(200).json(images);
  } catch (error) {
    console.error("[Image Service] Get images error:", error);
    res.status(500).json({ error: "Failed to retrieve images." });
  }
};

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
      metrics.appImageUploads.labels('image-service').inc();
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
    console.error("[Image Service] Image upload error:", e);

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

  try {
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
      metrics.appJobsCreated.labels('image-service', 'crop', 'image').inc();
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
  } catch (error) {
    console.error("[Image Service] Crop error:", error);
    res.status(500).json({ error: "Failed to start crop job." });
  }
};

/**
 * ----------------------------------------
 * RESIZE IMAGE
 * ----------------------------------------
 */
const resizeImage = async (req, res) => {
  const { imageId, width, height } = req.body;

  if (!imageId || !width || !height) {
    return res.status(400).json({ error: "imageId, width, height required" });
  }

  try {
    const image = await videoService.findByVideoId(imageId);
    if (!image) return res.status(404).json({ error: "Image not found." });
    if (image.metadata?.type !== "image") {
      return res.status(400).json({ error: "This endpoint is for images only" });
    }

    const parameters = { width, height };

    await videoService.addOperation(imageId, {
      type: "resize-image",
      status: "pending",
      parameters,
    });

    // Instrumentation: job created
    try {
      metrics.appJobsCreated.labels('image-service', 'resize-image', 'image').inc();
    } catch (e) {}

    await req.app.locals.eventBus.publish(EventTypes.IMAGE_PROCESSING_REQUESTED, {
      imageId,
      userId: req.userId,
      operation: "resize-image",
      parameters,
    });

    res.status(200).json({
      status: "success",
      message: "Image resizing started.",
    });
  } catch (error) {
    console.error("[Image Service] Resize error:", error);
    res.status(500).json({ error: "Failed to start resize job." });
  }
};

/**
 * ----------------------------------------
 * CONVERT IMAGE FORMAT
 * ----------------------------------------
 */
const convertImage = async (req, res) => {
  const { imageId, targetFormat } = req.body;

  if (!imageId || !targetFormat) {
    return res.status(400).json({ error: "imageId and targetFormat required" });
  }

  const supported = ["jpg", "jpeg", "png", "gif", "webp"];
  if (!supported.includes(targetFormat.toLowerCase())) {
    return res.status(400).json({
      error: `Unsupported format. Supported: ${supported.join(", ")}`,
    });
  }

  try {
    const image = await videoService.findByVideoId(imageId);
    if (!image) return res.status(404).json({ error: "Image not found." });
    if (image.metadata?.type !== "image") {
      return res.status(400).json({ error: "This endpoint is for images only" });
    }

    if (image.extension === targetFormat) {
      return res.status(400).json({
        error: `Already in ${targetFormat.toUpperCase()} format.`,
      });
    }

    const parameters = {
      targetFormat: targetFormat.toLowerCase(),
      originalFormat: image.extension.toLowerCase(),
    };

    await videoService.addOperation(imageId, {
      type: "convert-image",
      status: "pending",
      parameters,
    });

    // Instrumentation: job created
    try {
      metrics.appJobsCreated.labels('image-service', 'convert-image', 'image').inc();
    } catch (e) {}

    await req.app.locals.eventBus.publish(EventTypes.IMAGE_PROCESSING_REQUESTED, {
      imageId,
      userId: req.userId,
      operation: "convert-image",
      parameters,
    });

    res.status(200).json({
      status: "success",
      message: `Conversion to ${targetFormat.toUpperCase()} started.`,
    });
  } catch (error) {
    console.error("[Image Service] Convert error:", error);
    res.status(500).json({ error: "Failed to start convert job." });
  }
};

/**
 * ----------------------------------------
 * GET IMAGE ASSET
 * ----------------------------------------
 */
const getImageAsset = async (req, res) => {
  const { imageId, type, dimensions, format } = req.query;

  try {
    const image = await videoService.findByVideoId(imageId);
    if (!image) return res.status(404).json({ error: "Image not found." });
    if (image.metadata?.type !== "image") {
      return res.status(400).json({ error: "Not an image resource" });
    }

    let filePath;
    let extension;

    switch (type) {
      case "original":
        extension = image.extension;
        filePath = path.join(
          __dirname,
          `../../../storage/${imageId}/original.${extension}`
        );
        break;

      case "cropped":
        extension = image.extension;
        if (!dimensions) {
          return res.status(400).json({
            error: "dimensions parameter required for cropped images (format: WxHxXxY)",
          });
        }
        filePath = path.join(
          __dirname,
          `../../../storage/${imageId}/cropped_${dimensions}.${extension}`
        );

        const cropOp = await videoService.findOperation(imageId, "crop");
        if (!cropOp || cropOp.status !== "completed") {
          return res.status(400).json({
            error: "Image crop not complete.",
          });
        }
        break;

      case "resized":
        extension = image.extension;
        if (!dimensions) {
          return res.status(400).json({
            error: "dimensions parameter required for resized images (format: WxH)",
          });
        }
        filePath = path.join(
          __dirname,
          `../../../storage/${imageId}/resized_${dimensions}.${extension}`
        );

        const resizeOp = await videoService.findOperation(imageId, "resize-image");
        if (!resizeOp || resizeOp.status !== "completed") {
          return res.status(400).json({
            error: "Image resize not complete.",
          });
        }
        break;

      case "converted":
        if (!format) {
          return res.status(400).json({
            error: "format parameter required for converted images",
          });
        }
        extension = format.toLowerCase();
        filePath = path.join(
          __dirname,
          `../../../storage/${imageId}/converted.${extension}`
        );

        const convertOp = await videoService.findOperation(imageId, "convert-image", {
          targetFormat: extension
        });
        if (!convertOp || convertOp.status !== "completed") {
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

    // Create read stream
    const readStream = fsSync.createReadStream(filePath, {
      highWaterMark: 64 * 1024
    });

    // Handle stream errors
    readStream.on("error", (err) => {
      console.error("[Image Service] Stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error streaming asset." });
      }
      readStream.destroy();
    });

    // Close stream if client disconnects
    res.on("close", () => {
      if (readStream && !readStream.destroyed) {
        readStream.destroy();
      }
    });

    // Set content headers
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
  } catch (e) {
    console.error("[Image Service] Asset error:", e);
    res.status(404).json({ error: "Asset not found." });
  }
};

module.exports = {
  getImages,
  uploadImage,
  cropImage,
  resizeImage,
  convertImage,
  getImageAsset,
};
