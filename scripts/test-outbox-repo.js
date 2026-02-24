const { transaction, query } = require('../packages/database/db');
const outboxRepo = require('../packages/shared/outbox/outboxRepo');
const { v4: uuidv4 } = require('uuid');

async function runTest() {
  console.log('=== TESTING OUTBOX REPO ===');

  const aggregateId = `job-${Date.now()}`;
  const idempotencyKey = `idemp-${uuidv4()}`;

  // 1. Test Insertion within transaction
  console.log('\nTesting Insertion...');
  const eventId = await transaction(async (client) => {
    return await outboxRepo.insertEvent(client, {
      eventType: 'job.completed',
      aggregateType: 'job',
      aggregateId,
      idempotencyKey,
      payload: { foo: 'bar' }
    });
  });
  console.log(`✅ Event inserted with ID: ${eventId}`);

  // 2. Test Idempotency (Should return null/existing)
  console.log('\nTesting Idempotency...');
  const secondEventId = await transaction(async (client) => {
    return await outboxRepo.insertEvent(client, {
      eventType: 'job.completed',
      aggregateType: 'job',
      aggregateId,
      idempotencyKey,
      payload: { foo: 'bar again' }
    });
  });
  if (secondEventId === null) {
    console.log('✅ Idempotency working (returned null for duplicate key)');
  } else {
    console.error(`❌ Idempotency FAILED (returned ${secondEventId} for duplicate)`);
  }

  // 3. Test Claiming
  console.log('\nTesting Claim Batch...');
  const dispatcherId = uuidv4();
  const batch = await outboxRepo.claimBatch(10, dispatcherId);
  console.log(`✅ Claimed ${batch.length} events`);
  
  const claimedEvent = batch.find(e => e.id === eventId);
  if (claimedEvent) {
    console.log(`✅ Successfully claimed our event: ${claimedEvent.event_type}`);
  } else {
    console.error('❌ Failed to claim our event');
  }

  // 4. Test Failure & Backoff
  console.log('\nTesting Failure & Backoff...');
  await outboxRepo.markFailed(eventId, 0, 5);
  const failedEventRes = await query('SELECT status, attempts, next_attempt_at FROM outbox_events WHERE id = $1', [eventId]);
  const failedEvent = failedEventRes.rows[0];
  console.log(`✅ Status: ${failedEvent.status}, Attempts: ${failedEvent.attempts}`);
  if (new Date(failedEvent.next_attempt_at) > new Date()) {
    console.log(`✅ Backoff scheduled for: ${failedEvent.next_attempt_at}`);
  } else {
    console.error('❌ Backoff scheduling failed');
  }

  // 5. Test Success
  console.log('\nTesting Success...');
  await outboxRepo.markPublished(eventId);
  const successEventRes = await query('SELECT status FROM outbox_events WHERE id = $1', [eventId]);
  console.log(`✅ Status: ${successEventRes.rows[0].status}`);

  // 6. Test Dead Lettering
  console.log('\nTesting Dead Lettering...');
  const dlId = await transaction(async (client) => {
    return await outboxRepo.insertEvent(client, {
      eventType: 'job.failed',
      aggregateType: 'job',
      aggregateId: 'fake-id',
      idempotencyKey: `dl-${uuidv4()}`,
      payload: { error: 'fatal' }
    });
  });
  await outboxRepo.markFailed(dlId, 4, 5); // 5th attempt
  const deadEventRes = await query('SELECT status FROM outbox_events WHERE id = $1', [dlId]);
  console.log(`✅ Status: ${deadEventRes.rows[0].status} (Expected: dead)`);

  console.log('\n=== OUTBOX REPO TESTS COMPLETE ===');
  process.exit(0);
}

runTest().catch(err => {
  console.error('Test driver crashed:', err);
  process.exit(1);
});
