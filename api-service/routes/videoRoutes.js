const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');

/**
 * Video Routes
 * /api/videos/*
 * All routes require authentication (handled by server.js)
 */

router.get('/', videoController.getVideos);
router.post('/upload', videoController.uploadVideo);
router.post('/extract-audio', videoController.extractAudio);
router.post('/resize', videoController.resizeVideo);
router.post('/convert', videoController.convertVideo);
router.get('/asset', videoController.getVideoAsset);

module.exports = router;
