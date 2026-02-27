const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');

/**
 * Payment Routes
 * /api/payments/*
 */

// Webhook endpoint (should NOT use authentication)
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleWebhook);

// Protected routes for initiating checkout
router.post('/create-session', authenticate, paymentController.createCheckoutSession);
router.post('/create-upgrade-session', authenticate, paymentController.createUpgradeSession);

module.exports = router;
