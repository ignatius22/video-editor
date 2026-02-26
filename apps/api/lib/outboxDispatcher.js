const { v4: uuidv4 } = require('uuid');
const outboxRepo = require('@convertix/shared/outbox/outboxRepo');
const createLogger = require('@convertix/shared/lib/logger');
const logger = createLogger('outbox-dispatcher');

/**
 * Outbox Dispatcher
 * Polls the outbox_events table and publishes pending events to the EventBus.
 */
class OutboxDispatcher {
  /**
   * @param {object} eventBus - The EventBus instance to publish events to
   * @param {object} options - Configuration options
   */
  constructor(eventBus, options = {}) {
    this.eventBus = eventBus;
    this.batchSize = options.batchSize || 10;
    this.pollingInterval = options.pollingInterval || 1000; // 1 second
    this.lockDuration = options.lockDuration || 60; // 60 seconds
    this.maxAttempts = options.maxAttempts || 5;
    
    this.instanceId = uuidv4();
    this.isRunning = false;
    this.timer = null;

    logger.info({ 
      instanceId: this.instanceId, 
      batchSize: this.batchSize, 
      pollingInterval: this.pollingInterval 
    }, 'OutboxDispatcher initialized');
  }

  /**
   * Start the dispatcher loop
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.tick();
    logger.info('OutboxDispatcher started');
  }

  /**
   * Stop the dispatcher loop
   */
  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    logger.info('OutboxDispatcher stopped');
  }

  /**
   * Single polling tick
   */
  async tick() {
    if (!this.isRunning) return;

    try {
      await this.processBatch();
    } catch (err) {
      logger.error({ err: err.message }, 'Error in OutboxDispatcher tick');
    } finally {
      if (this.isRunning) {
        this.timer = setTimeout(() => this.tick(), this.pollingInterval);
      }
    }
  }

  /**
   * Claim and process a batch of events
   */
  async processBatch() {
    // 1. Claim pending/failed events using SKIP LOCKED
    const events = await outboxRepo.claimBatch(this.batchSize, this.instanceId, this.lockDuration);
    
    if (events.length === 0) return;

    logger.debug({ count: events.length }, 'Claimed outbox events');

    // 2. Process each event
    const results = await Promise.allSettled(events.map(event => this.processEvent(event)));

    const successes = results.filter(r => r.status === 'fulfilled').length;
    const failures = results.filter(r => r.status === 'rejected').length;

    if (failures > 0) {
      logger.warn({ successes, failures }, 'Batch processed with some failures');
    } else {
      logger.debug({ successes }, 'Batch processed successfully');
    }
  }

  /**
   * Process a single event
   */
  async processEvent(event) {
    try {
      // 1. Publish to EventBus
      // The routing key is the event type (e.g., job.started, billing.reservation.captured)
      await this.eventBus.publish(event.event_type, event.payload, {
        metadata: {
          aggregateType: event.aggregate_type,
          aggregateId: event.aggregate_id,
          idempotencyKey: event.idempotency_key,
          outboxId: event.id
        }
      });

      // 2. Mark as published
      await outboxRepo.markPublished(event.id);
      
      logger.info({ 
        eventId: event.id, 
        type: event.event_type, 
        aggregateId: event.aggregate_id 
      }, 'Successfully published outbox event');

    } catch (err) {
      logger.error({ 
        err: err.message, 
        eventId: event.id, 
        type: event.event_type 
      }, 'Failed to publish outbox event');

      // 3. Mark as failed (with exponential backoff)
      await outboxRepo.markFailed(event.id, event.attempts, this.maxAttempts);
      throw err;
    }
  }
}

module.exports = OutboxDispatcher;
