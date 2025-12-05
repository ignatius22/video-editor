const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');
const authMiddleware = require('../middleware/auth');

/**
 * All video routes require authentication
 */

// Get user's videos
router.get('/videos', authMiddleware.authenticate, videoController.getVideos);

// Upload video
router.post('/upload', authMiddleware.authenticate, videoController.uploadVideo);

// Extract audio
router.post('/extract-audio', authMiddleware.authenticate, videoController.extractAudio);

// Resize video (queue job)
router.post('/resize', authMiddleware.authenticate, videoController.resizeVideo);

// Convert video format (queue job)
router.post('/convert', authMiddleware.authenticate, videoController.convertVideo);

// Add watermark to video (queue job)
router.post('/watermark', authMiddleware.authenticate, videoController.watermarkVideo);
// Trim video (queue job)
router.post('/trim', authMiddleware.authenticate, videoController.trimVideo);

// Get video asset (original, thumbnail, resized, etc.)
router.get('/asset', authMiddleware.authenticate, videoController.getVideoAsset);

// Upload image
router.post('/upload-image', authMiddleware.authenticate, videoController.uploadImage);

// Crop image (queue job)
router.post('/crop-image', authMiddleware.authenticate, videoController.cropImage);

// Resize image (queue job)
router.post('/resize-image', authMiddleware.authenticate, videoController.resizeImage);

module.exports = router;
