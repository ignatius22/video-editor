const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, adminOnly } = require('../middleware/auth');

// Apply auth and admin check to ALL routes in this file
router.use(authenticate);
router.use(adminOnly);

/**
 * @route GET /api/admin/users
 * @desc Get all users
 */
router.get('/users', adminController.getAllUsers);

/**
 * @route PATCH /api/admin/users/:userId
 * @desc Update user status (tier, credits, etc)
 */
router.patch('/users/:userId', adminController.updateUserStatus);

/**
 * @route GET /api/admin/stats
 * @desc Get platform-wide statistics
 */
router.get('/stats', adminController.getPlatformStats);

module.exports = router;
