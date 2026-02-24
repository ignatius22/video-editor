const userService = require('../packages/shared/database/services/userService');
const { v4: uuidv4 } = require('uuid');

async function testReservationLifecycle() {
  console.log('--- Testing Credit Reservation Lifecycle ---');
  
  // 1. Setup Test User
  const username = `res_user_${Date.now()}`;
  const user = await userService.createUser({
    username,
    email: `${username}@example.com`,
    password: 'password123'
  });
  console.log(`Created test user: ${user.username} (Initial Credits: ${user.credits})`);

  const operationId = uuidv4();
  const ledId = `op-${operationId}`;

  // 2. Test Success Flow (Reserve -> Capture)
  console.log('\n--- SCENARIO: SUCCESS FLOW ---');
  console.log(`1. Reserving 1 credit for operation: ${operationId}`);
  const res1 = await userService.reserveCredits(user.id, 1, ledId);
  console.log(`   Balance after reservation: ${res1.credits} (Expected: 9)`);
  
  if (res1.credits !== 9) throw new Error('Reservation deduction failed');

  console.log(`2. Capturing credit for operation: ${operationId}`);
  await userService.captureCredits(ledId);
  
  // Re-fetch user to verify balance didn't change (already deducted)
  const userAfterCapture = await userService.findById(user.id);
  console.log(`   Balance after capture: ${userAfterCapture.credits} (Expected: 9)`);
  
  if (userAfterCapture.credits !== 9) throw new Error('Capture incorrectly modified balance');

  // 3. Test Failure Flow (Reserve -> Release)
  const failOpId = uuidv4();
  const failLedId = `op-${failOpId}`;
  console.log('\n--- SCENARIO: FAILURE FLOW ---');
  console.log(`1. Reserving 1 credit for failing operation: ${failOpId}`);
  await userService.reserveCredits(user.id, 1, failLedId);
  
  const userAfterFailRes = await userService.findById(user.id);
  console.log(`   Balance after reservation: ${userAfterFailRes.credits} (Expected: 8)`);

  console.log(`2. Releasing credit (simulated failure) for operation: ${failOpId}`);
  await userService.releaseCredits(failLedId);
  
  const userAfterRelease = await userService.findById(user.id);
  console.log(`   Balance after release: ${userAfterRelease.credits} (Expected: 9)`);
  
  if (userAfterRelease.credits !== 9) throw new Error('Release failed to restore balance');

  // 4. Test Double-Reserve Idempotency
  console.log('\n--- SCENARIO: DOUBLE RESERVE IDEMPOTENCY ---');
  console.log(`Attempting to reserve SAME operation ${operationId} again...`);
  const resDouble = await userService.reserveCredits(user.id, 1, ledId);
  console.log(`   Balance after double-reserve: ${resDouble.credits} (Expected: 9 - no change)`);
  
  if (resDouble.credits !== 9) throw new Error('Double reserve failed idempotency');

  // 5. Test Double-Capture Idempotency
  console.log('\n--- SCENARIO: DOUBLE CAPTURE IDEMPOTENCY ---');
  console.log(`Attempting to capture operation ${operationId} again...`);
  await userService.captureCredits(ledId);
  console.log('   Double capture handled successfully (no error)');

  console.log('\n✅ ALL RESERVATION LIFECYCLE TESTS PASSED');
  process.exit(0);
}

testReservationLifecycle().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
