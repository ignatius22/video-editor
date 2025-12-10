const express = require("express");
const router = express.Router();
const imageController = require("../controllers/imageController");
const authMiddleware = require("../middleware/auth");

/**
 * All image routes require authentication
 */

// Get user's images
router.get("/images", authMiddleware.authenticate, imageController.getImages);

// Upload image
router.post(
  "/upload",
  authMiddleware.authenticate,
  imageController.uploadImage
);

// Crop image (queue job)
router.post(
  "/crop",
  authMiddleware.authenticate,
  imageController.cropImage
);

// Resize image (queue job)
router.post(
  "/resize",
  authMiddleware.authenticate,
  imageController.resizeImage
);

// Convert image format (queue job)
router.post(
  "/convert",
  authMiddleware.authenticate,
  imageController.convertImage
);

// Get image asset (original, cropped, resized, converted)
router.get(
  "/asset",
  authMiddleware.authenticate,
  imageController.getImageAsset
);

module.exports = router;
