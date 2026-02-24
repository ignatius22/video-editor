const userService = require('@video-editor/shared/database/services/userService');

/**
 * Credit Check Middleware
 * Ensures a user has enough credits before performing a processing operation.
 * 
 * Cost is currently fixed at 1 credit per operation.
 */
const checkCredits = (amount = 1) => {
  return async (req, res, next) => {
    try {
      // req.user is attached by the authenticate middleware
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required." });
      }

      // 1. Double check current balance from DB (to avoid stale data from token/req object)
      const user = await userService.findById(req.userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }

      if (user.credits < amount) {
        return res.status(403).json({
          error: "Insufficient credits.",
          required: amount,
          available: user.credits,
          message: "Please upgrade your plan or purchase more credits to continue."
        });
      }

      // Attach the verified user with credits to the request
      req.user = user;
      
      next();
    } catch (error) {
      console.error("[API] Credit check error:", error);
      res.status(500).json({ error: "Failed to verify credits." });
    }
  };
};

module.exports = { checkCredits };
