const axios = require("axios");

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';

/**
 * Authentication middleware
 * Validates token via User Service
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
    // Validate token via User Service
    const response = await axios.post(`${USER_SERVICE_URL}/validate`, {
      token
    });

    if (!response.data.valid) {
      return res.status(401).json({ error: "Unauthorized - Invalid token" });
    }

    // Attach user info to request
    req.userId = response.data.user.id;
    req.username = response.data.user.username;

    next();
  } catch (error) {
    console.error("[Image Service] Authentication error:", error.message);
    res.status(500).json({ error: "Authentication failed" });
  }
};
