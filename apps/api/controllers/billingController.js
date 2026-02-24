const userService = require('@video-editor/shared/database/services/userService');

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
    console.error('[API] Get transactions error:', error);
    res.status(500).json({ error: 'Failed to retrieve transactions.' });
  }
};

/**
 * Purchase credits (Simulated)
 * POST /api/billing/buy-credits
 */
const buyCredits = async (req, res) => {
  const { amount, description = 'Credit purchase' } = req.body;
  
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Valid credit amount is required.' });
  }

  try {
    const updatedUser = await userService.addCredits(req.userId, amount, description);
    
    res.status(200).json({
      message: `Successfully purchased ${amount} credits.`,
      credits: updatedUser.credits
    });
  } catch (error) {
    console.error('[API] Buy credits error:', error);
    res.status(500).json({ error: 'Failed to purchase credits.' });
  }
};

/**
 * Upgrade user tier (Simulated)
 * POST /api/billing/upgrade
 */
const upgradeTier = async (req, res) => {
  const { tier = 'pro' } = req.body;
  
  try {
    const updatedUser = await userService.updateTier(req.userId, tier);
    
    // Add some bonus credits for upgrading
    if (tier === 'pro') {
      await userService.addCredits(req.userId, 50, 'Pro upgrade bonus');
    }

    res.status(200).json({
      message: `Successfully upgraded to ${tier} tier!`,
      user: updatedUser
    });
  } catch (error) {
    console.error('[API] Upgrade tier error:', error);
    res.status(500).json({ error: 'Failed to upgrade tier.' });
  }
};

module.exports = {
  getTransactions,
  buyCredits,
  upgradeTier
};
