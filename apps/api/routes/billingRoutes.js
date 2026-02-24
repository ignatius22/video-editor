const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const { authenticate } = require('../middleware/auth');

/**
 * Billing Routes
 * /api/billing/*
 * All routes require authentication
 */

router.get('/transactions', authenticate, billingController.getTransactions);
router.post('/buy-credits', authenticate, billingController.buyCredits);
router.post('/upgrade', authenticate, billingController.upgradeTier);

module.exports = router;
