const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Create a Stripe Checkout Session for credit purchase
 */
async function createCreditPurchaseSession(userId, userEmail, amount, priceInCents) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${amount} Credits Pack`,
            description: 'Convertix processing power credits',
          },
          unit_amount: priceInCents,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
    metadata: {
      userId: userId.toString(),
      type: 'credits',
      amount: amount.toString(),
    },
    customer_email: userEmail,
  });

  return session;
}

/**
 * Create a Stripe Checkout Session for Pro subscription
 */
async function createSubscriptionSession(userId, userEmail) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Convertix Pro Subscription',
            description: 'Monthly unlimited high-speed processing',
          },
          unit_amount: 2900, // $29.00
          recurring: {
            interval: 'month',
          },
        },
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
    metadata: {
      userId: userId.toString(),
      type: 'subscription',
      tier: 'pro',
    },
    customer_email: userEmail,
  });

  return session;
}

/**
 * Verify Stripe webhook signature
 */
function constructEvent(payload, sig, endpointSecret) {
  return stripe.webhooks.constructEvent(payload, sig, endpointSecret);
}

module.exports = {
  createCreditPurchaseSession,
  createSubscriptionSession,
  constructEvent,
};
