const sessionService = require("@video-editor/shared/database/services/sessionService");

/**
 * Authentication Middleware
 * Validates session token from cookies and attaches userId to request
 */
const authenticate = async (req, res, next) => {
  try {
    // Extract token from cookie
    const cookieHeader = req.headers.cookie;

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

    if (!token) {
      return res.status(401).json({ error: "Authentication token missing." });
    }

    // Validate token
    const user = await sessionService.validateToken(token);

    if (!user) {
      return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
    }

    // Attach user ID to request
    req.userId = user.id;
    req.user = user;

    next();
  } catch (error) {
    console.error("[API] Authentication error:", error);
    return res.status(500).json({ error: "Authentication failed." });
  }
};

module.exports = { authenticate };
