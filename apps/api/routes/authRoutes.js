const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

/**
 * Auth Routes
 * /api/auth/*
 */

// Public routes
router.post('/login', authController.login);
router.post('/register', authController.register);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.get('/user', authenticate, authController.getUserInfo);
router.put('/user', authenticate, authController.updateUser);

module.exports = router;
