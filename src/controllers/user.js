const userService = require("../../database/services/userService");
const sessionService = require("../../database/services/sessionService");

const logUserIn = async (req, res, handleErr) => {
  const username = req.body.username;
  const password = req.body.password;

  try {
    // Verify username and password
    const user = await userService.verifyPassword(username, password);

    if (!user) {
      return handleErr({ status: 401, message: "Invalid username or password." });
    }

    // Create session with 7-day expiration
    const session = await sessionService.createSession(user.id, 7);

    res.setHeader("Set-Cookie", `token=${session.token}; Path=/;`);
    res.status(200).json({ message: "Logged in successfully!" });
  } catch (error) {
    console.error("Login error:", error);
    return handleErr({ status: 500, message: "Login failed. Please try again." });
  }
};

const logUserOut = async (req, res, handleErr) => {
  try {
    // Delete all sessions for this user
    await sessionService.deleteAllUserSessions(req.userId);

    res.setHeader(
      "Set-Cookie",
      `token=deleted; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
    );
    res.status(200).json({ message: "Logged out successfully!" });
  } catch (error) {
    console.error("Logout error:", error);
    return handleErr({ status: 500, message: "Logout failed. Please try again." });
  }
};

const sendUserInfo = async (req, res, handleErr) => {
  try {
    const user = await userService.findById(req.userId);

    if (!user) {
      return handleErr({ status: 404, message: "User not found." });
    }

    res.json({ username: user.username, name: user.username });
  } catch (error) {
    console.error("Get user info error:", error);
    return handleErr({ status: 500, message: "Failed to retrieve user info." });
  }
};

const updateUser = async (req, res, handleErr) => {
  const username = req.body.username;
  const password = req.body.password;

  try {
    // Update username and email if provided
    const updates = {};
    if (username) {
      updates.username = username;
    }

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
      username: user.username,
      name: user.username,
      password_status: password ? "updated" : "not updated",
    });
  } catch (error) {
    console.error("Update user error:", error);
    return handleErr({ status: 500, message: "Failed to update user." });
  }
};

const controller = {
  logUserIn,
  logUserOut,
  sendUserInfo,
  updateUser,
};

module.exports = controller;
