const userService = require('@video-editor/shared/database/services/userService');
const createLogger = require("@video-editor/shared/lib/logger");
const logger = createLogger('api');

/**
 * Get user credit transactions
 * GET /api/billing/transactions
 */
const getTransactions = async (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  
  try {
    const transactions = await userService.getCreditTransactions(
      req.userId, 
      parseInt(limit), 
      parseInt(offset)
    );
    
    res.status(200).json({ transactions });
  } catch (error) {
    logger.error({ err: error.message, stack: error.stack, userId: req.userId }, 'Get transactions error');
    res.status(500).json({ error: "Failed to fetch transactions." });
  }
};

/**
 * Purchase credits (Simulated)
 * POST /api/billing/buy-credits
 */
const buyCredits = async (req, res) => {
  const { amount, description = 'Credit purchase', requestId: bodyRequestId } = req.body;
  const requestId = req.headers['x-request-id'] || bodyRequestId;
  
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Valid credit amount is required.' });
  }

  if (!requestId) {
    return res.status(400).json({ error: 'requestId is required for idempotent purchases.' });
  }

  try {
    const updatedUser = await userService.addCredits(req.userId, amount, description, requestId);
    
    res.status(200).json({
      message: `Successfully processed credit purchase.`,
      credits: updatedUser.credits
    });
  } catch (error) {
    if (error.message.includes('Collision')) {
      return res.status(409).json({ error: error.message });
    }
    logger.error({ err: error.message, stack: error.stack, userId: req.userId }, 'Buy credits error');
    res.status(500).json({ error: "Failed to process transaction." });
  }
};

/**
 * Upgrade user tier (Simulated)
 * POST /api/billing/upgrade
 */
const upgradeTier = async (req, res) => {
  const { tier = 'pro', requestId: bodyRequestId } = req.body;
  const requestId = req.headers['x-request-id'] || bodyRequestId;

  if (!requestId) {
    return res.status(400).json({ error: 'requestId is required for idempotent upgrades.' });
  }
  
  try {
    const updatedUser = await userService.updateTier(req.userId, tier);
    
    // Add some bonus credits for upgrading (using the same requestId for idempotency)
    // In a real system, the bonus might have its own request_id or be job-linked
    if (tier === 'pro') {
      await userService.addCredits(req.userId, 50, 'Pro upgrade bonus', `upgrade-${requestId}`);
    }

    res.status(200).json({
      message: `Successfully upgraded to ${tier} tier!`,
      user: updatedUser
    });
  } catch (error) {
    logger.error({ err: error.message, stack: error.stack, userId: req.userId }, 'Upgrade tier error');
    res.status(500).json({ error: "Failed to upgrade tier." });
  }
};

module.exports = {
  getTransactions,
  buyCredits,
  upgradeTier
};
