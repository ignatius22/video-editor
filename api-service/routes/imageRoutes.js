const express = require('express');
const router = express.Router();
const imageController = require('../controllers/imageController');

/**
 * Image Routes
 * /api/images/*
 * All routes require authentication (handled by server.js)
 */

router.get('/', imageController.getImages);
router.post('/upload', imageController.uploadImage);
router.post('/crop', imageController.cropImage);
router.post('/resize', imageController.resizeImage);
router.post('/convert', imageController.convertImage);
router.get('/asset', imageController.getImageAsset);

module.exports = router;
