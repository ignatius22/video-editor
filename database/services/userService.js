const { query, transaction } = require('../db');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

/**
 * User Service
 * Handles all user-related database operations
 */
class UserService {
  /**
   * Create a new user
   * @param {object} userData - User data
   * @returns {Promise<object>} Created user
   */
  async createUser({ username, email, password, tier = 'free' }) {
    // Hash password
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await query(
      `INSERT INTO users (username, email, password_hash, tier)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, tier, created_at`,
      [username, email, password_hash, tier]
    );

    return result.rows[0];
  }

  /**
   * Find user by ID
   * @param {number} id - User ID
   * @returns {Promise<object|null>} User object or null
   */
  async findById(id) {
    const result = await query(
      'SELECT id, username, email, tier, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Find user by username
   * @param {string} username - Username
   * @returns {Promise<object|null>} User object or null
   */
  async findByUsername(username) {
    const result = await query(
      'SELECT id, username, email, tier, created_at, updated_at FROM users WHERE username = $1',
      [username]
    );

    return result.rows[0] || null;
  }

  /**
   * Find user by email
   * @param {string} email - Email address
   * @returns {Promise<object|null>} User object or null
   */
  async findByEmail(email) {
    const result = await query(
      'SELECT id, username, email, tier, created_at, updated_at FROM users WHERE email = $1',
      [email]
    );

    return result.rows[0] || null;
  }

  /**
   * Verify user password
   * @param {string} username - Username
   * @param {string} password - Plain text password
   * @returns {Promise<object|null>} User object if valid, null otherwise
   */
  async verifyPassword(username, password) {
    const result = await query(
      'SELECT id, username, email, tier, password_hash, created_at FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return null;
    }

    // Don't return password hash
    delete user.password_hash;
    return user;
  }

  /**
   * Update user
   * @param {number} id - User ID
   * @param {object} updates - Fields to update
   * @returns {Promise<object>} Updated user
   */
  async updateUser(id, updates) {
    const allowedFields = ['username', 'email', 'tier'];
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id); // Add ID as last parameter

    const result = await query(
      `UPDATE users SET ${fields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, username, email, tier, created_at, updated_at`,
      values
    );

    return result.rows[0];
  }

  /**
   * Change user password
   * @param {number} id - User ID
   * @param {string} newPassword - New plain text password
   * @returns {Promise<boolean>} Success status
   */
  async changePassword(id, newPassword) {
    const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [password_hash, id]
    );

    return true;
  }

  /**
   * Delete user
   * @param {number} id - User ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteUser(id) {
    await query('DELETE FROM users WHERE id = $1', [id]);
    return true;
  }

  /**
   * Get user statistics
   * @param {number} userId - User ID
   * @returns {Promise<object>} User statistics
   */
  async getUserStats(userId) {
    const result = await query(
      'SELECT * FROM get_user_stats($1)',
      [userId]
    );

    return result.rows[0] || {
      total_videos: 0,
      total_jobs: 0,
      completed_jobs: 0,
      failed_jobs: 0,
      avg_job_duration: 0
    };
  }

  /**
   * List all users (admin)
   * @param {number} limit - Number of users to return
   * @param {number} offset - Offset for pagination
   * @returns {Promise<array>} List of users
   */
  async listUsers(limit = 50, offset = 0) {
    const result = await query(
      `SELECT id, username, email, tier, created_at, updated_at
       FROM users
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return result.rows;
  }
}

module.exports = new UserService();
