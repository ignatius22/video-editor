const { query } = require('../database/db');

/**
 * Outbox Repository
 * Handles persistence and state management for durable events.
 */
class OutboxRepo {
  /**
   * Insert a new event into the outbox.
   * Typically called within an existing transaction.
   * 
   * @param {object} client - Database client (for transaction context)
   * @param {object} event - Event data
   * @param {string} event.eventType - Type of event (e.g., 'billing.captured')
   * @param {string} event.aggregateType - Type of aggregate (e.g., 'reservation', 'job')
   * @param {string} event.aggregateId - ID of the associated aggregate
   * @param {string} event.idempotencyKey - Unique key to prevent duplicates
   * @param {object} event.payload - JSON payload
   */
  async insertEvent(client, { eventType, aggregateType, aggregateId, idempotencyKey, payload }) {
    const sql = `
      INSERT INTO outbox_events (
        event_type, aggregate_type, aggregate_id, idempotency_key, payload
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id;
    `;
    const result = await client.query(sql, [
      eventType,
      aggregateType,
      aggregateId,
      idempotencyKey,
      JSON.stringify(payload)
    ]);
    return result.rows[0]?.id || null;
  }

  /**
   * Claim a batch of events to be processed.
   * Uses SELECT FOR UPDATE SKIP LOCKED for safe concurrent polling.
   * 
   * @param {number} batchSize - Number of events to claim
   * @param {string} lockedBy - Identifier for the dispatcher (UUID)
   * @param {number} lockDurationSeconds - How long to lock the events
   * @returns {Promise<Array>} Batch of claimed events
   */
  async claimBatch(batchSize, lockedBy, lockDurationSeconds = 60) {
    return await query(`
      UPDATE outbox_events
      SET 
        status = 'processing',
        locked_at = CURRENT_TIMESTAMP,
        locked_by = $2
      WHERE id IN (
        SELECT id FROM outbox_events
        WHERE status IN ('pending', 'failed')
          AND next_attempt_at <= CURRENT_TIMESTAMP
          AND (locked_at IS NULL OR locked_at < CURRENT_TIMESTAMP - interval '1 second' * $3)
        ORDER BY created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, event_type, aggregate_type, aggregate_id, idempotency_key, payload, attempts;
    `, [batchSize, lockedBy, lockDurationSeconds]).then(res => res.rows);
  }

  /**
   * Mark an event as successfully published.
   * 
   * @param {string} id - Event UUID
   */
  async markPublished(id) {
    await query(`
      UPDATE outbox_events
      SET status = 'published', locked_at = NULL, locked_by = NULL
      WHERE id = $1;
    `, [id]);
  }

  /**
   * Record a failure and schedule a retry.
   * 
   * @param {string} id - Event UUID
   * @param {number} currentAttempts - Number of attempts so far
   * @param {number} maxAttempts - Maximum allowed attempts
   */
  async markFailed(id, currentAttempts, maxAttempts = 5) {
    const attempts = currentAttempts + 1;
    let status = 'failed';
    let nextAttemptAt = null;

    if (attempts >= maxAttempts) {
      status = 'dead';
    } else {
      // Exponential backoff: 5s, 10s, 20s, 40s...
      const backoffSeconds = Math.pow(2, attempts) * 2.5;
      nextAttemptAt = new Date(Date.now() + backoffSeconds * 1000);
    }

    await query(`
      UPDATE outbox_events
      SET 
        status = $2,
        attempts = $3,
        next_attempt_at = $4,
        locked_at = NULL,
        locked_by = NULL
      WHERE id = $1;
    `, [id, status, attempts, nextAttemptAt]);
  }

  /**
   * Cleanup published events older than N days.
   * 
   * @param {number} days - Retain published events for this many days
   */
  async cleanup(days = 7) {
    await query(`
      DELETE FROM outbox_events
      WHERE status = 'published' AND updated_at < CURRENT_TIMESTAMP - interval '1 day' * $1;
    `, [days]);
  }
}

module.exports = new OutboxRepo();
