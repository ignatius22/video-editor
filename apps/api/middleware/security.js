const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

/**
 * Global Rate Limiter
 * Limits each IP to 100 requests per 15 minutes
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});

/**
 * Authentication Rate Limiter
 * Stricter limit for login/register: 10 attempts per 15 minutes
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again after 15 minutes.' }
});

/**
 * Processing Rate Limiter
 * Limits heavy video/image processing requests to 20 per 15 minutes
 */
const processingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Processing limit exceeded. Please wait before starting more jobs.' }
});

/**
 * CSRF Protection Middleware
 * Checks for X-CSRF-Protection header on all state-changing requests (POST, PUT, DELETE, PATCH)
 */
const csrfProtection = (req, res, next) => {
  const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  
  if (stateChangingMethods.includes(req.method)) {
    const csrfHeader = req.headers['x-csrf-protection'];
    
    if (csrfHeader !== '1') {
      return res.status(403).json({ 
        error: 'Forbidden: Missing or invalid CSRF protection header (X-CSRF-Protection: 1 required).' 
      });
    }
  }
  
  next();
};

/**
 * Configure Helmet
 */
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "blob:"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
});

module.exports = {
  helmetConfig,
  globalLimiter,
  authLimiter,
  processingLimiter,
  csrfProtection
};
