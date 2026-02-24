const userService = require('../packages/shared/database/services/userService');
const { v4: uuidv4 } = require('uuid');

async function testIdempotency() {
  console.log('--- Testing Billing Idempotency ---');
  
  // 1. Create a test user
  const username = `test_user_${Date.now()}`;
  const user = await userService.createUser({
    username,
    email: `${username}@example.com`,
    password: 'password123'
  });
  console.log(`Created test user: ${user.username} (Initial Credits: ${user.credits})`);

  const requestId = uuidv4();
  
  // 2. First purchase attempt
  console.log(`\nAttempt 1: Adding 100 credits with requestId: ${requestId}`);
  const result1 = await userService.addCredits(user.id, 100, 'Test purchase', requestId);
  console.log(`Result 1: New Balance = ${result1.credits}`);
  
  if (result1.credits !== 110) {
    console.error('❌ FAILED: Expected 110 credits after first purchase');
    process.exit(1);
  }

  // 3. Duplicate purchase attempt (Same requestId)
  console.log(`\nAttempt 2: Adding 100 credits WITH SAME requestId: ${requestId}`);
  const result2 = await userService.addCredits(user.id, 100, 'Test purchase duplicate', requestId);
  console.log(`Result 2: New Balance = ${result2.credits}`);
  
  if (result2.credits !== 110) {
    console.error('❌ FAILED: Idempotency failed! Credits were added twice.');
    process.exit(1);
  } else {
    console.log('✅ SUCCESS: Second attempt returned current balance without double-crediting.');
  }

  // 4. Different requestId attempt
  const otherRequestId = uuidv4();
  console.log(`\nAttempt 3: Adding 50 credits with NEW requestId: ${otherRequestId}`);
  const result3 = await userService.addCredits(user.id, 50, 'Test purchase new', otherRequestId);
  console.log(`Result 3: New Balance = ${result3.credits}`);
  
  if (result3.credits !== 160) {
    console.error('❌ FAILED: Expected 160 credits after third purchase');
    process.exit(1);
  } else {
    console.log('✅ SUCCESS: Different requestId processed correctly.');
  }

  // 5. Collision attempt (Same requestId, different user)
  const otherUser = await userService.createUser({
    username: `${username}_other`,
    email: `${username}_other@example.com`,
    password: 'password123'
  });
  console.log(`\nCreated second test user: ${otherUser.username}`);
  
  try {
    console.log(`Attempt 4: Using Attempt 1's requestId for Second User...`);
    await userService.addCredits(otherUser.id, 100, 'Collision test', requestId);
    console.error('❌ FAILED: Colliding requestId across users should have failed.');
    process.exit(1);
  } catch (err) {
    console.log(`✅ SUCCESS: Correctly rejected collision: ${err.message}`);
  }

  console.log('\n--- Idempotency Tests Passed ---');
  process.exit(0);
}

testIdempotency().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
