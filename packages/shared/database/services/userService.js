const { query, transaction } = require('../db');
const bcrypt = require('bcrypt');
const outboxRepo = require('../../outbox/outboxRepo');

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

    return await transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO users (username, email, password_hash, tier, credits)
         VALUES ($1, $2, $3, $4, 10)
         RETURNING id, username, email, tier, credits, is_admin, created_at`,
        [username, email, password_hash, tier]
      );

      const user = result.rows[0];

      // Record initial sign-up bonus in ledger
      await client.query(
        'INSERT INTO credit_transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
        [user.id, 10, 'addition', 'Sign-up bonus']
      );

      return user;
    });
  }

  /**
   * Find user by ID
   * @param {number} id - User ID
   * @returns {Promise<object|null>} User object or null
   */
  async findById(id) {
    const result = await query(
      'SELECT id, username, email, tier, credits, is_admin, created_at, updated_at FROM users WHERE id = $1',
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
      'SELECT id, username, email, tier, credits, is_admin, created_at, updated_at FROM users WHERE username = $1',
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
      'SELECT id, username, email, tier, credits, is_admin, created_at, updated_at FROM users WHERE email = $1',
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
    const allowedFields = ['username', 'email', 'tier', 'credits', 'is_admin'];
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
       RETURNING id, username, email, tier, credits, is_admin, created_at, updated_at`,
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
   * Deduct credits from user
   * @param {number} userId - User ID
   * @param {number} amount - Amount to deduct
   * @param {string} description - Transaction description
   * @returns {Promise<object>} Updated user
   */
  async deductCredits(userId, amount, description = 'Operation deduction', operationId = null, requestId = null) {
    return await transaction(async (client) => {
      // 1. Get current credits
      const userRes = await client.query('SELECT credits FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const user = userRes.rows[0];

      if (!user) throw new Error('User not found');
      if (user.credits < amount) throw new Error('Insufficient credits');

      // 2. Deduct credits
      const result = await client.query(
        'UPDATE users SET credits = credits - $1 WHERE id = $2 RETURNING id, credits',
        [amount, userId]
      );

      // 3. Record transaction with optional operational/request links
      await client.query(
        'INSERT INTO credit_transactions (user_id, amount, type, description, operation_id, request_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [userId, -amount, 'deduction', description, operationId, requestId]
      );

      return result.rows[0];
    });
  }

  /**
   * Add credits to user
   * @param {number} userId - User ID
   * @param {number} amount - Amount to add
   * @param {string} description - Transaction description
   * @returns {Promise<object>} Updated user
   */
  async addCredits(userId, amount, description = 'Credit top-up', requestId = null) {
    return await transaction(async (client) => {
      try {
        // Idempotency check: If a requestId is provided, check if it already exists
        if (requestId) {
          const existing = await client.query(
            'SELECT user_id, amount FROM credit_transactions WHERE request_id = $1',
            [requestId]
          );
          if (existing.rows.length > 0) {
            // Validate that the request belongs to the same user
            if (existing.rows[0].user_id !== userId) {
              throw new Error('Collision: Request ID already used by another user');
            }
            // Return current balance without double-crediting
            const current = await client.query('SELECT id, credits FROM users WHERE id = $1', [userId]);
            return current.rows[0];
          }
        }

        const result = await client.query(
          'UPDATE users SET credits = credits + $1 WHERE id = $2 RETURNING id, credits',
          [amount, userId]
        );

        await client.query(
          'INSERT INTO credit_transactions (user_id, amount, type, description, request_id) VALUES ($1, $2, $3, $4, $5)',
          [userId, amount, 'addition', description, requestId]
        );

        return result.rows[0];
      } catch (err) {
        // Postgres unique violation code 23505
        if (err.code === '23505' && requestId) {
          const current = await client.query('SELECT id, credits FROM users WHERE id = $1', [userId]);
          return current.rows[0];
        }
        throw err;
      }
    });
  }

  /**
   * Get user credit transactions
   * @param {number} userId - User ID
   * @returns {Promise<array>} List of transactions
   */
  async getCreditTransactions(userId, limit = 50, offset = 0) {
    const result = await query(
      'SELECT * FROM credit_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );
    return result.rows;
  }

  /**
   * Reserve credits for an operation
   * @param {number} userId - User ID
   * @param {number} amount - Amount to reserve
   * @param {string} operationId - Linked operation ID
   * @returns {Promise<object>} Updated user
   */
  async reserveCredits(userId, amount, operationId) {
    if (!operationId) throw new Error('operationId is required for reservations');
    
    return await transaction(async (client) => {
      // 1. Idempotency check: Has this operation already been reserved/captured?
      const existing = await client.query(
        'SELECT type FROM credit_transactions WHERE operation_id = $1 AND type IN (\'reservation\', \'debit_capture\')',
        [operationId]
      );
      if (existing.rows.length > 0) {
        const current = await client.query('SELECT credits FROM users WHERE id = $1', [userId]);
        return current.rows[0];
      }

      // 2. Resource check & Lock
      const userRes = await client.query('SELECT credits FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const user = userRes.rows[0];
      if (!user) throw new Error('User not found');
      if (user.credits < amount) throw new Error('Insufficient credits');

      // 3. Deduct available balance
      const result = await client.query(
        'UPDATE users SET credits = credits - $1 WHERE id = $2 RETURNING id, credits',
        [amount, userId]
      );

      // 4. Create reservation ledger entry
      await client.query(
        'INSERT INTO credit_transactions (user_id, amount, type, description, operation_id) VALUES ($1, $2, $3, $4, $5)',
        [userId, -amount, 'reservation', `Reserved for operation ${operationId}`, operationId]
      );

      // 5. Emit outbox event
      await outboxRepo.insertEvent(client, {
        eventType: 'billing.reservation.reserved',
        aggregateType: 'reservation',
        aggregateId: operationId,
        idempotencyKey: `reservation:${operationId}:reserved`,
        payload: { userId, amount, operationId, status: 'reserved' }
      });

      return result.rows[0];
    });
  }

  /**
   * Capture reserved credits on success
   * @param {string} operationId - Linked operation ID
   * @returns {Promise<boolean>} Success status
   */
  async captureCredits(operationId) {
    return await transaction(async (client) => {
      // 1. Check if already captured (idempotency)
      const existing = await client.query(
        'SELECT id FROM credit_transactions WHERE operation_id = $1 AND type = \'debit_capture\'',
        [operationId]
      );
      if (existing.rows.length > 0) return true;

      // 2. Find the reservation
      const res = await client.query(
        'SELECT id, user_id, amount, description FROM credit_transactions WHERE operation_id = $1 AND type = \'reservation\'',
        [operationId]
      );
      if (res.rows.length === 0) {
        throw new Error(`Capture failure: No reservation found for operation ${operationId}`);
      }

      const reservation = res.rows[0];

      // 3. Create capture entry (Balance not updated, it was lowered at reservation)
      // Amount is 0 because the deduction happened at the reservation step.
      await client.query(
        'INSERT INTO credit_transactions (user_id, amount, type, description, operation_id) VALUES ($1, $2, $3, $4, $5)',
        [reservation.user_id, 0, 'debit_capture', `Captured for operation ${operationId}`, operationId]
      );

      // 4. Emit outbox event
      await outboxRepo.insertEvent(client, {
        eventType: 'billing.reservation.captured',
        aggregateType: 'reservation',
        aggregateId: operationId,
        idempotencyKey: `reservation:${operationId}:captured`,
        payload: { userId: reservation.user_id, amount: reservation.amount, operationId, status: 'captured' }
      });

      return true;
    });
  }

  /**
   * Release reserved credits on failure
   * @param {string} operationId - Linked operation ID
   * @returns {Promise<object|null>} Updated user or null if nothing to release
   */
  async releaseCredits(operationId) {
    return await transaction(async (client) => {
      // 1. Double-release check: Has it already been captured or released?
      const existing = await client.query(
        'SELECT type FROM credit_transactions WHERE operation_id = $1 AND type IN (\'debit_capture\', \'refund\')',
        [operationId]
      );
      if (existing.rows.length > 0) return null;

      // 2. Find the reservation
      const res = await client.query(
        'SELECT user_id, amount FROM credit_transactions WHERE operation_id = $1 AND type = \'reservation\'',
        [operationId]
      );
      if (res.rows.length === 0) return null;

      const reservation = res.rows[0];
      const refundAmount = Math.abs(reservation.amount);

      // 3. Restore balance
      const result = await client.query(
        'UPDATE users SET credits = credits + $1 WHERE id = $2 RETURNING id, credits',
        [refundAmount, reservation.user_id]
      );

      // 4. Record refund
      await client.query(
        'INSERT INTO credit_transactions (user_id, amount, type, description, operation_id) VALUES ($1, $2, $3, $4, $5)',
        [reservation.user_id, refundAmount, 'refund', `Refunded for failed operation ${operationId}`, operationId]
      );

      // 5. Emit outbox event
      await outboxRepo.insertEvent(client, {
        eventType: 'billing.reservation.released',
        aggregateType: 'reservation',
        aggregateId: operationId,
        idempotencyKey: `reservation:${operationId}:released`,
        payload: { userId: reservation.user_id, amount: refundAmount, operationId, status: 'released' }
      });

      return result.rows[0];
    });
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

  /**
   * Update user tier
   * @param {number} userId - User ID
   * @param {string} tier - New tier ('free', 'pro')
   * @returns {Promise<object>} Updated user
   */
  async updateTier(userId, tier) {
    const allowedTiers = ['free', 'pro'];
    if (!allowedTiers.includes(tier)) {
      throw new Error(`Invalid tier: ${tier}. Allowed: ${allowedTiers.join(', ')}`);
    }

    const result = await query(
      'UPDATE users SET tier = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, username, email, tier, credits, is_admin, updated_at',
      [tier, userId]
    );

    return result.rows[0];
  }
}

module.exports = new UserService();
