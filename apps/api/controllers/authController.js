const userService = require("@convertix/shared/database/services/userService");
const sessionService = require("@convertix/shared/database/services/sessionService");
const createLogger = require("@convertix/shared/lib/logger");
const logger = createLogger('api');

/**
 * Authentication Controller
 * Handles user login, logout, profile management
 */

/**
 * User registration
 * POST /api/auth/register
 */
const register = async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({
      error: "Username, email, and password are required."
    });
  }

  try {
    // Check if user already exists
    const existingUser = await userService.findByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: "Username already taken." });
    }

    const existingEmail = await userService.findByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ error: "Email already registered." });
    }

    // Create user
    const user = await userService.createUser({ username, email, password });

    // Create session
    const session = await sessionService.createSession(user.id, 7);

    res.setHeader("Set-Cookie", `token=${session.token}; Path=/; HttpOnly; SameSite=Strict`);
    res.status(201).json({
      message: "User registered successfully!",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        tier: user.tier,
        credits: user.credits
      }
    });
  } catch (error) {
    logger.error({ err: error.message, stack: error.stack }, "Registration error");
    res.status(500).json({
      error: "Registration failed. Please try again."
    });
  }
};

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
        tier: user.tier,
        credits: user.credits
      }
    });
  } catch (error) {
    logger.error({ err: error.message, stack: error.stack }, "Login error");
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
    logger.error({ err: error.message, stack: error.stack }, "Logout error");
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
      credits: user.credits,
      is_admin: user.is_admin,
      created_at: user.created_at
    });
  } catch (error) {
    logger.error({ err: error.message, stack: error.stack, userId: req.userId }, "Get user info error");
    res.status(500).json({
      error: "Failed to fetch user profiles."
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
    logger.error({ err: error.message, stack: error.stack, userId: req.userId }, "Update user error");
    res.status(500).json({
      error: "Failed to update profile."
    });
  }
};

module.exports = {
  login,
  register,
  logout,
  getUserInfo,
  updateUser
};
