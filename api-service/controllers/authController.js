const userService = require("../../shared/database/services/userService");
const sessionService = require("../../shared/database/services/sessionService");

/**
 * Authentication Controller
 * Handles user login, logout, profile management
 */

/**
 * User login
 * POST /api/auth/login
 */
const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: "Username and password are required."
    });
  }

  try {
    // Verify username and password
    const user = await userService.verifyPassword(username, password);

    if (!user) {
      return res.status(401).json({
        error: "Invalid username or password."
      });
    }

    // Create session with 7-day expiration
    const session = await sessionService.createSession(user.id, 7);

    res.setHeader("Set-Cookie", `token=${session.token}; Path=/; HttpOnly; SameSite=Strict`);
    res.status(200).json({
      message: "Logged in successfully!",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        tier: user.tier
      }
    });
  } catch (error) {
    console.error("[API] Login error:", error);
    res.status(500).json({
      error: "Login failed. Please try again."
    });
  }
};

/**
 * User logout
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    // Delete all sessions for this user
    await sessionService.deleteAllUserSessions(req.userId);

    res.setHeader(
      "Set-Cookie",
      `token=deleted; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly`
    );
    res.status(200).json({ message: "Logged out successfully!" });
  } catch (error) {
    console.error("[API] Logout error:", error);
    res.status(500).json({
      error: "Logout failed. Please try again."
    });
  }
};

/**
 * Get user info
 * GET /api/auth/user
 */
const getUserInfo = async (req, res) => {
  try {
    const user = await userService.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      tier: user.tier,
      created_at: user.created_at
    });
  } catch (error) {
    console.error("[API] Get user info error:", error);
    res.status(500).json({
      error: "Failed to retrieve user info."
    });
  }
};

/**
 * Update user
 * PUT /api/auth/user
 */
const updateUser = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Update username and email if provided
    const updates = {};
    if (username) updates.username = username;
    if (email) updates.email = email;

    // Update user details
    if (Object.keys(updates).length > 0) {
      await userService.updateUser(req.userId, updates);
    }

    // Update password separately if provided
    if (password) {
      await userService.changePassword(req.userId, password);
    }

    // Fetch updated user
    const user = await userService.findById(req.userId);

    res.status(200).json({
      message: "User updated successfully",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        tier: user.tier
      },
      password_updated: !!password
    });
  } catch (error) {
    console.error("[API] Update user error:", error);
    res.status(500).json({
      error: "Failed to update user."
    });
  }
};

module.exports = {
  login,
  logout,
  getUserInfo,
  updateUser
};
