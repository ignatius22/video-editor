const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');
const { checkCredits } = require('../middleware/creditMiddleware');

/**
 * Video Routes
 * /api/videos/*
 * All routes require authentication (handled by server.js)
 */

router.get('/', videoController.getVideos);
router.post('/upload', videoController.uploadVideo);
router.post('/extract-audio', checkCredits(1), videoController.extractAudio);
router.post('/resize', checkCredits(1), videoController.resizeVideo);
router.post('/convert', checkCredits(1), videoController.convertVideo);
router.get('/asset', videoController.getVideoAsset);

module.exports = router;
