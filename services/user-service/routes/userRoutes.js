const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');

/**
 * Public Routes (no authentication required)
 */
router.post('/login', userController.login);
router.post('/validate', userController.validateToken);

/**
 * Protected Routes (authentication required)
 */
router.post('/logout', authMiddleware.authenticate, userController.logout);
router.get('/user', authMiddleware.authenticate, userController.getUserInfo);
router.put('/user', authMiddleware.authenticate, userController.updateUser);

module.exports = router;
