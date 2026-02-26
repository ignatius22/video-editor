const { query } = require('@convertix/shared/database/db');
const userService = require('@convertix/shared/database/services/userService');
const createLogger = require('@convertix/shared/lib/logger');
const logger = createLogger('billing-janitor');

class ReservationJanitor {
  constructor(bullQueue, options = {}) {
    this.queue = bullQueue;
    this.ttlMinutes = options.ttlMinutes || 30;
    this.metrics = {
      reservations_checked: 0,
      released_count: 0,
      skipped_count: 0,
      suspicious_count: 0
    };
  }

  async run() {
    logger.info({ ttl: this.ttlMinutes }, 'Starting reservation janitor run');
    
    // Reset metrics for this run
    this.metrics = {
      reservations_checked: 0,
      released_count: 0,
      skipped_count: 0,
      suspicious_count: 0
    };

    try {
      // 1. Find reservations older than TTL that are not captured or refunded
      // We use a LEFT JOIN to find reservations without matching terminal states
      const stuckReservations = await query(`
        SELECT r.* 
        FROM credit_transactions r
        LEFT JOIN credit_transactions t ON r.operation_id = t.operation_id 
          AND t.type IN ('debit_capture', 'refund')
        WHERE r.type = 'reservation'
          AND r.created_at < NOW() - ($1 || ' minutes')::INTERVAL
          AND t.id IS NULL
        ORDER BY r.created_at ASC
      `, [this.ttlMinutes]);

      this.metrics.reservations_checked = stuckReservations.rows.length;
      logger.info({ count: stuckReservations.rows.length }, 'Found potential stuck reservations');

      for (const res of stuckReservations.rows) {
        await this.inspectAndRelease(res);
      }

      logger.info(this.metrics, 'Reservation janitor run complete');
      return this.metrics;
    } catch (err) {
      logger.error({ err: err.message }, 'Reservation janitor run failed');
      throw err;
    }
  }

  async inspectAndRelease(reservation) {
    const { operation_id, user_id } = reservation;
    
    try {
      // 2. Check Bull Queue for the job
      // Note: operation_id in DB corresponds to the 'operationId' property in job data
      // We don't have a direct map to Bull jobId usually, so we might need to search or 
      // rely on the fact that if it's old, it SHOULD be finished.
      
      // However, we can use the 'operation_id' to look up in our database's video_operations
      const opStatusRes = await query(
        'SELECT status FROM video_operations WHERE id = $1',
        [operation_id.replace('op-', '')] // Remove the prefix we add inuserService
      );

      // Also check image operations
      const imgOpStatusRes = await query(
        'SELECT status FROM image_operations WHERE id = $1',
        [operation_id.replace('op-', '')]
      );

      const opStatus = opStatusRes.rows[0]?.status || imgOpStatusRes.rows[0]?.status;

      if (!opStatus) {
        logger.warn({ operation_id, user_id }, 'No operation record found for reservation. Releasing.');
        await this.releaseStuck(operation_id);
        return;
      }

      // 3. Safety Rules
      if (opStatus === 'completed') {
        // This is SUSPICIOUS: Job says completed but credits never captured!
        this.metrics.suspicious_count++;
        logger.error({ operation_id, user_id, opStatus }, 'SUSPICIOUS: Operation completed but credits not captured. Human intervention may be needed.');
        // We might capture here, but let's release to be safe for the user unless instructed otherwise
        // Actually, capturing is better for revenue, but release is safer for PR.
        // Let's release since the "janitor" is about safety.
        await this.releaseStuck(operation_id);
      } else if (opStatus === 'failed') {
        logger.info({ operation_id, opStatus }, 'Operation failed. Releasing stuck reservation.');
        await this.releaseStuck(operation_id);
      } else if (opStatus === 'processing' || opStatus === 'pending') {
        // If it's been in 'processing' for > 30m, it might be hanging.
        // We should check if the Bull job is actually active.
        this.metrics.skipped_count++;
        logger.warn({ operation_id, opStatus }, 'Reservation is old but operation is still marked as active. Skipping for now.');
      }
    } catch (err) {
      logger.error({ err: err.message, operation_id }, 'Failed to inspect reservation');
    }
  }

  async releaseStuck(operationId) {
    try {
      const released = await userService.releaseCredits(operationId);
      if (released) {
        this.metrics.released_count++;
        logger.info({ operationId }, 'Successfully released stuck reservation');
      } else {
        this.metrics.skipped_count++;
      }
    } catch (err) {
      logger.error({ err: err.message, operationId }, 'Failed to release stuck reservation');
    }
  }
}

module.exports = ReservationJanitor;
