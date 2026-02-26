const sessionService = require("@convertix/shared/database/services/sessionService");

/**
 * Authentication Middleware
 * Validates session token from cookies and attaches userId to request
 */
const authenticate = async (req, res, next) => {
  try {
    // Extract token from cookie
    const cookieHeader = req.headers.cookie;
    console.log('[Auth] Cookie Header:', cookieHeader ? 'Present' : 'Missing');

    if (!cookieHeader) {
      return res.status(401).json({ error: "Authentication required. Please log in." });
    }

    // Parse cookies
    const cookies = {};
    cookieHeader.split(';').forEach(cookie => {
      const parts = cookie.trim().split('=');
      if (parts.length === 2) {
        cookies[parts[0]] = parts[1];
      }
    });

    const token = cookies.token;
    console.log('[Auth] Token extracted:', token ? 'Yes' : 'No');

    if (!token) {
      return res.status(401).json({ error: "Authentication token missing." });
    }

    // Validate token
    try {
      const user = await sessionService.validateToken(token);
      console.log('[Auth] Token validation result:', user ? 'Valid' : 'Invalid');

      if (!user) {
        return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
      }

      // Attach user ID to request
      req.userId = user.id;
      req.user = user;

      next();
    } catch (validateError) {
      console.error("[Auth] validateToken failed:", validateError.message);
      throw validateError;
    }
  } catch (error) {
    console.error("[API] Authentication error:", error.message, error.stack);
    return res.status(500).json({ error: "Authentication failed." });
  }
};

/**
 * Admin Only Middleware
 * Ensures the authenticated user has admin privileges
 */
const adminOnly = (req, res, next) => {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: "Forbidden: Administrative access required." });
  }
  next();
};

module.exports = { authenticate, adminOnly };
