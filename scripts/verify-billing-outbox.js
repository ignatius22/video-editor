const userService = require('../packages/shared/database/services/userService');
const { query } = require('../packages/database/db');
const { v4: uuidv4 } = require('uuid');

async function runVerification() {
  console.log('=== VERIFYING BILLING OUTBOX INTEGRATION ===');

  // 1. Setup User
  const username = `outbox_test_${Date.now()}`;
  const user = await userService.createUser({
    username,
    email: `${username}@example.com`,
    password: 'password123'
  });
  console.log(`Created test user: ${user.username}`);

  const operationId = `op-outbox-${uuidv4()}`;

  // 2. Test Reservation Outbox
  console.log('\nTesting Reservation Outbox...');
  await userService.reserveCredits(user.id, 5, operationId);
  const resOutbox = await query(
    'SELECT * FROM outbox_events WHERE aggregate_id = $1 AND event_type = $2',
    [operationId, 'billing.reservation.reserved']
  );
  if (resOutbox.rows.length === 1) {
    console.log('✅ SUCCESS: billing.reservation.reserved event found in outbox');
    console.log('Payload:', resOutbox.rows[0].payload);
  } else {
    console.error('❌ FAIL: billing.reservation.reserved event MISSING from outbox');
  }

  // 3. Test Capture Outbox
  console.log('\nTesting Capture Outbox...');
  await userService.captureCredits(operationId);
  const capOutbox = await query(
    'SELECT * FROM outbox_events WHERE aggregate_id = $1 AND event_type = $2',
    [operationId, 'billing.reservation.captured']
  );
  if (capOutbox.rows.length === 1) {
    console.log('✅ SUCCESS: billing.reservation.captured event found in outbox');
  } else {
    console.error('❌ FAIL: billing.reservation.captured event MISSING from outbox');
  }

  // 4. Test Release Outbox (on a new reservation)
  console.log('\nTesting Release Outbox...');
  const relOpId = `op-rel-outbox-${uuidv4()}`;
  await userService.reserveCredits(user.id, 2, relOpId);
  await userService.releaseCredits(relOpId);
  const relOutbox = await query(
    'SELECT * FROM outbox_events WHERE aggregate_id = $1 AND event_type = $2',
    [relOpId, 'billing.reservation.released']
  );
  if (relOutbox.rows.length === 1) {
    console.log('✅ SUCCESS: billing.reservation.released event found in outbox');
  } else {
    console.error('❌ FAIL: billing.reservation.released event MISSING from outbox');
  }

  console.log('\n=== VERIFICATION COMPLETE ===');
  process.exit(0);
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
