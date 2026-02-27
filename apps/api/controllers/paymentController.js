const stripeService = require('@convertix/shared/database/services/stripeService');
const userService = require('@convertix/shared/database/services/userService');
const createLogger = require('@convertix/shared/lib/logger');
const logger = createLogger('api');

/**
 * Handle checkout session creation for credits
 */
const createCheckoutSession = async (req, res) => {
  const { amount } = req.body;
  const user = await userService.getUserById(req.userId);

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Valid credit amount is required.' });
  }

  try {
    // Pricing: $0.10 per credit
    const priceInCents = amount * 10;
    const session = await stripeService.createCreditPurchaseSession(
      req.userId,
      user.email,
      amount,
      priceInCents
    );

    res.status(200).json({ url: session.url });
  } catch (error) {
    logger.error({ err: error.message, userId: req.userId }, 'Failed to create checkout session');
    res.status(500).json({ error: 'Failed to initiate payment.' });
  }
};

/**
 * Handle checkout session creation for Pro upgrade
 */
const createUpgradeSession = async (req, res) => {
  const user = await userService.getUserById(req.userId);

  try {
    const session = await stripeService.createSubscriptionSession(req.userId, user.email);
    res.status(200).json({ url: session.url });
  } catch (error) {
    logger.error({ err: error.message, userId: req.userId }, 'Failed to create upgrade session');
    res.status(500).json({ error: 'Failed to initiate upgrade.' });
  }
};

/**
 * Stripe Webhook Handler
 */
const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Note: rawBody is required for Stripe signature verification
    const payload = req.rawBody || JSON.stringify(req.body);
    event = stripeService.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error({ err: err.message }, 'Webhook signature verification failed');
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      await fulfillOrder(session);
      break;
    default:
      logger.debug(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
};

/**
 * Fulfill the order after successful payment
 */
async function fulfillOrder(session) {
  const { userId, type, amount, tier } = session.metadata;

  logger.info({ userId, type, amount, tier }, 'Fulfilling Stripe order');

  if (type === 'credits') {
    await userService.addCredits(
      parseInt(userId),
      parseInt(amount),
      `Stripe Purchase (Session: ${session.id})`,
      `stripe-${session.id}`
    );
  } else if (type === 'subscription' && tier === 'pro') {
    await userService.updateTier(parseInt(userId), 'pro');
    // Also give the 50 bonus credits for pro upgrade
    await userService.addCredits(
      parseInt(userId),
      50,
      'Pro upgrade bonus',
      `stripe-upgrade-${session.id}`
    );
  }
}

module.exports = {
  createCheckoutSession,
  createUpgradeSession,
  handleWebhook,
};
