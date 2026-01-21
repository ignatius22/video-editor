const { query } = require('../db');
const crypto = require('crypto');

/**
 * Session Service
 * Handles user session management
 */
class SessionService {
  /**
   * Create a new session
   * @param {number} userId - User ID
   * @param {number} expiresInDays - Session expiry in days (default: 7)
   * @returns {Promise<object>} Session with token
   */
  async createSession(userId, expiresInDays = 7) {
    // Generate secure random token
    const token = crypto.randomBytes(32).toString('hex');

    const result = await query(
      `INSERT INTO sessions (user_id, token, expires_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '${expiresInDays} days')
       RETURNING id, user_id, token, created_at, expires_at`,
      [userId, token]
    );

    return result.rows[0];
  }

  /**
   * Find session by token
   * @param {string} token - Session token
   * @returns {Promise<object|null>} Session object or null
   */
  async findByToken(token) {
    const result = await query(
      `SELECT s.id, s.user_id, s.token, s.created_at, s.expires_at,
              u.username, u.email, u.tier
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = $1 AND s.expires_at > CURRENT_TIMESTAMP`,
      [token]
    );

    return result.rows[0] || null;
  }

  /**
   * Validate session token
   * @param {string} token - Session token
   * @returns {Promise<object|null>} User object if valid, null otherwise
   */
  async validateToken(token) {
    const session = await this.findByToken(token);

    if (!session) {
      return null;
    }

    // Return user data
    return {
      id: session.user_id,
      username: session.username,
      email: session.email,
      tier: session.tier
    };
  }

  /**
   * Delete session (logout)
   * @param {string} token - Session token
   * @returns {Promise<boolean>} Success status
   */
  async deleteSession(token) {
    await query('DELETE FROM sessions WHERE token = $1', [token]);
    return true;
  }

  /**
   * Delete all sessions for a user
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteAllUserSessions(userId) {
    await query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    return true;
  }

  /**
   * Clean up expired sessions
   * @returns {Promise<number>} Number of deleted sessions
   */
  async cleanupExpiredSessions() {
    const result = await query(
      'DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP RETURNING id'
    );

    return result.rowCount;
  }

  /**
   * Extend session expiry
   * @param {string} token - Session token
   * @param {number} days - Days to extend
   * @returns {Promise<object>} Updated session
   */
  async extendSession(token, days = 7) {
    const result = await query(
      `UPDATE sessions
       SET expires_at = CURRENT_TIMESTAMP + INTERVAL '${days} days'
       WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP
       RETURNING id, user_id, token, created_at, expires_at`,
      [token]
    );

    return result.rows[0] || null;
  }

  /**
   * Get all active sessions for a user
   * @param {number} userId - User ID
   * @returns {Promise<array>} List of active sessions
   */
  async getUserSessions(userId) {
    const result = await query(
      `SELECT id, token, created_at, expires_at
       FROM sessions
       WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows;
  }
}

module.exports = new SessionService();
