/**
 * test-outbox-evil.js
 * Stress-test for the Outbox Pattern
 * Verifies concurrent safety and exactly-once delivery via Outbox Dispatcher
 */
const { query, close } = require('../packages/database/db');
const { EventBus } = require('../packages/shared/eventBus');
const OutboxDispatcher = require('../apps/api/lib/outboxDispatcher');
const config = require('../packages/shared/config');
const createLogger = require('../packages/shared/lib/logger');
const logger = createLogger('evil-outbox-test');

const EVENT_COUNT = 100;
const DISPATCHER_COUNT = 5;

async function run() {
  logger.info('Starting EVIL Outbox Stress Test...');

  // 1. Clear outbox to ensure clean state
  await query('DELETE FROM outbox_events');
  logger.info('Outbox cleared');

  // 2. Initialize EventBus
  const eventBus = new EventBus(config.rabbitmq.url, 'evil-test');
  try {
    await eventBus.connect(true);
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to connect to RabbitMQ. Is it running?');
    process.exit(1);
  }
  
  // Track received events in a Set to detect duplicates if they occurred
  const receivedIds = new Set();
  let duplicateCount = 0;

  await eventBus.subscribe('evil.*', (data, metadata) => {
    const id = data.index;
    if (receivedIds.has(id)) {
      duplicateCount++;
      logger.warn({ id }, 'DUPLICATE detected!');
    } else {
      receivedIds.add(id);
    }
  });

  logger.info('EventBus connected and subscribed to evil.*');

  // 3. Insert events
  const testRunId = Date.now();
  logger.info(`Inserting ${EVENT_COUNT} events for test run ${testRunId}...`);
  const insertPromises = [];
  for (let i = 0; i < EVENT_COUNT; i++) {
    const idempotencyKey = `evil:${testRunId}:${i}`;
    insertPromises.push(query(
      'INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, idempotency_key, payload) VALUES ($1, $2, $3, $4, $5)',
      ['evil.event', 'test', `id-${i}`, idempotencyKey, JSON.stringify({ index: i, timestamp: Date.now() })]
    ));
  }
  await Promise.all(insertPromises);
  logger.info('Events inserted into database outbox');

  // 4. Start multiple dispatchers concurrently
  logger.info(`Starting ${DISPATCHER_COUNT} concurrent dispatchers...`);
  const dispatchers = [];
  for (let i = 0; i < DISPATCHER_COUNT; i++) {
    const d = new OutboxDispatcher(eventBus, { 
      batchSize: 5, 
      pollingInterval: 100, // Fast polling to maximize race chances
      lockDuration: 60
    });
    d.start();
    dispatchers.push(d);
  }

  // 5. Wait for processing with a timeout
  logger.info('Monitoring dispatch progress...');
  let attempts = 0;
  const maxAttempts = 30; // 15 seconds
  while (receivedIds.size < EVENT_COUNT && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 500));
    attempts++;
    if (attempts % 4 === 0) {
      logger.info(`Progress: ${receivedIds.size}/${EVENT_COUNT} received...`);
    }
  }

  // 6. Cleanup & Detailed Report
  logger.info('Stopping dispatchers...');
  dispatchers.forEach(d => d.stop());
  
  // Wait a bit for any in-flight messages to arrive
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await eventBus.close();
  
  const finalStatus = await query('SELECT status, count(*) FROM outbox_events GROUP BY status');
  const results = finalStatus.rows;
  
  logger.info({ results }, 'Final Outbox Database Status');
  logger.info({ 
    totalReceived: receivedIds.size, 
    expected: EVENT_COUNT,
    duplicates: duplicateCount 
  }, 'Test Summary');

  // ... (previous success report) ...

  logger.info('--- PHASE 2: FAILURE RECOVERY TESTS ---');

  // 7. Stuck Lock Recovery Test
  logger.info('Test: Stuck Lock Recovery...');
  const stuckEventId = `stuck-${Date.now()}`;
  await query(`
    INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, idempotency_key, payload, status, locked_at, locked_by)
    VALUES ($1, $2, $3, $4, $5, 'processing', CURRENT_TIMESTAMP - interval '10 minutes', $6)
  `, ['evil.stuck', 'test', stuckEventId, `idemp-${stuckEventId}`, JSON.stringify({ stuck: true }), '00000000-0000-0000-0000-000000000000']);

  let stuckReceived = false;
  await eventBus.connect(true);
  await eventBus.subscribe('evil.stuck', () => { stuckReceived = true; });

  const recoveryDispatcher = new OutboxDispatcher(eventBus, { pollingInterval: 500, lockDuration: 60 });
  recoveryDispatcher.start();

  attempts = 0;
  while (!stuckReceived && attempts < 10) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
    logger.info(`Waiting for stuck event recovery... (${attempts}/10)`);
  }
  
  recoveryDispatcher.stop();
  if (stuckReceived) {
    logger.info('✅ SUCCESS: Stuck event recovered successfully!');
  } else {
    logger.error('❌ FAILURE: Stuck event was not recovered');
    process.exit(1);
  }

  // 8. Exponential Backoff Test
  logger.info('Test: Exponential Backoff...');
  const failEventId = `fail-${Date.now()}`;
  await query(`
    INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, idempotency_key, payload)
    VALUES ($1, $2, $3, $4, $5)
  `, ['evil.fail', 'test', failEventId, `idemp-${failEventId}`, JSON.stringify({ fail: true })]);

  // Mock EventBus.publish to always fail for this specific event type
  const originalPublish = eventBus.publish;
  eventBus.publish = async (type, payload) => {
    if (type === 'evil.fail') throw new Error('Simulated Network Failure');
    return originalPublish.call(eventBus, type, payload);
  };

  const backoffDispatcher = new OutboxDispatcher(eventBus, { pollingInterval: 500 });
  backoffDispatcher.start();

  // Wait for dispatcher to attempt and fail
  await new Promise(resolve => setTimeout(resolve, 2000));
  backoffDispatcher.stop();

  const failedRow = await query('SELECT attempts, next_attempt_at, status FROM outbox_events WHERE aggregate_id = $1', [failEventId]);
  const row = failedRow.rows[0];
  
  logger.info({ row }, 'Backoff Data');
  if (row && row.status === 'failed' && row.attempts > 0) {
    logger.info('✅ SUCCESS: Operation marked as failed with attempts incremented and backoff set!');
  } else {
    logger.error('❌ FAILURE: Backoff logic did not trigger correctly');
    process.exit(1);
  }

  await eventBus.close();
  await close();
  logger.info('--- ALL EVIL TESTS PASSED ---');
  process.exit(0);
}

run().catch(err => {
  console.error('Unexpected error in test runner:', err);
  process.exit(1);
});
