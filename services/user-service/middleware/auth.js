const sessionService = require("../../shared/database/services/sessionService");

/**
 * Authentication middleware
 * Validates session token and attaches userId to request
 */
exports.authenticate = async (req, res, next) => {
  // Extract token from cookie header
  let token = null;

  if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(';');
    const tokenCookie = cookies.find(c => c.trim().startsWith('token='));
    if (tokenCookie) {
      token = tokenCookie.split('=')[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: "Unauthorized - No token provided" });
  }

  try {
    const user = await sessionService.validateToken(token);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized - Invalid token" });
    }

    // Attach user ID to request
    req.userId = user.id;
    req.username = user.username;

    next();
  } catch (error) {
    console.error("[User Service] Authentication error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
};
