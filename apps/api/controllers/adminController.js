const userService = require('@convertix/shared/database/services/userService');
const jobHistoryService = require("@convertix/shared/database/services/jobHistoryService");
const createLogger = require("@convertix/shared/lib/logger");
const logger = createLogger('api');
const { query } = require('@convertix/database/db');

/**
 * Admin Controller
 * Handles administrative operations for user management and platform stats
 */
const getAllUsers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const users = await userService.listUsers(limit, offset);
    
    // Get total count for pagination
    const countResult = await query('SELECT COUNT(*) FROM users');
    const total = parseInt(countResult.rows[0].count);
    
    res.json({
      users,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    logger.error({ err: error.message, stack: error.stack, adminId: req.userId }, 'Error fetching users');
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { tier, credits, is_admin } = req.body;
    
    const updates = {};
    if (tier !== undefined) updates.tier = tier;
    if (credits !== undefined) updates.credits = credits;
    if (is_admin !== undefined) updates.is_admin = is_admin;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No update fields provided' });
    }
    
    const updatedUser = await userService.updateUser(userId, updates);
    
    res.json({
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    logger.error({ err: error.message, stack: error.stack, adminId: req.userId, targetUserId: id }, 'Error updating user');
    res.status(500).json({ error: 'Failed to update user' });
  }
};

const getPlatformStats = async (req, res) => {
  try {
    // 1. Total Users by Tier
    const userStats = await query(`
      SELECT tier, COUNT(*) as count 
      FROM users 
      GROUP BY tier
    `);
    
    // 2. Total Credit Consumption (last 30 days)
    const creditStats = await query(`
      SELECT 
        SUM(CASE WHEN type = 'deduction' THEN amount ELSE 0 END) as total_spent,
        SUM(CASE WHEN type = 'addition' THEN amount ELSE 0 END) as total_added
      FROM credit_transactions
      WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
    `);

    // 3. Daily credit consumption (last 7 days) for the bar chart
    const dailyCredits = await query(`
      SELECT 
        TO_CHAR(created_at, 'Dy') as label,
        created_at::date as day,
        SUM(CASE WHEN type = 'deduction' THEN amount ELSE 0 END) as spent,
        SUM(CASE WHEN type = 'addition' THEN amount ELSE 0 END) as added
      FROM credit_transactions
      WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
      GROUP BY created_at::date, TO_CHAR(created_at, 'Dy')
      ORDER BY day ASC
    `);
    
    // 4. Job Success Rate (overall)
    const jobStats = await query(`
      SELECT 
        status, 
        COUNT(*) as count 
      FROM job_history 
      WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
      GROUP BY status
    `);

    // 5. Per-operation success rates
    const operationStats = await query(`
      SELECT 
        type as operation,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as succeeded,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM job_history
      WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
      GROUP BY type
      ORDER BY total DESC
    `);
    
    // 6. Storage Usage (Estimated from DB records)
    const mediaStats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM videos) as total_videos,
        (SELECT COUNT(*) FROM images) as total_images
    `);

    res.json({
      users: userStats.rows,
      credits: creditStats.rows[0],
      dailyCredits: dailyCredits.rows,
      jobs: jobStats.rows,
      operations: operationStats.rows,
      media: mediaStats.rows[0],
      timestamp: new Date()
    });
  } catch (error) {
    logger.error({ err: error.message, stack: error.stack, adminId: req.userId }, 'Error fetching platform stats');
    res.status(500).json({ error: 'Failed to fetch platform statistics' });
  }
};

module.exports = {
  getAllUsers,
  updateUserStatus,
  getPlatformStats
};
