const express = require('express');
const router = express.Router();
const imageController = require('../controllers/imageController');
const { checkCredits } = require('../middleware/creditMiddleware');

/**
 * Image Routes
 * /api/images/*
 * All routes require authentication (handled by server.js)
 */

router.get('/', imageController.getImages);
router.post('/upload', imageController.uploadImage);
router.post('/crop', checkCredits(1), imageController.cropImage);
router.post('/resize', checkCredits(1), imageController.resizeImage);
router.post('/convert', checkCredits(1), imageController.convertImage);
router.get('/asset', imageController.getImageAsset);

module.exports = router;
