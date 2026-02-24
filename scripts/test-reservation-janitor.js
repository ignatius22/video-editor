const { query } = require('../packages/database/db');
const userService = require('../packages/shared/database/services/userService');
const videoService = require('../packages/shared/database/services/videoService');
const ReservationJanitor = require('../apps/worker/lib/reservationJanitor');
const { v4: uuidv4 } = require('uuid');

async function testJanitor() {
  console.log('--- Testing Reservation Janitor ---');

  // 1. Setup User
  const username = `janitor_test_${Date.now()}`;
  const user = await userService.createUser({
    username,
    email: `${username}@example.com`,
    password: 'password123'
  });
  console.log(`Created test user: ${user.username} (Credits: ${user.credits})`);

  // 2. Setup "Stuck" operation
  const videoId = uuidv4();
  await query(
    'INSERT INTO videos (video_id, user_id, name, extension) VALUES ($1, $2, $3, $4)',
    [videoId, user.id, 'Stuck Video', 'mp4']
  );
  
  const op = await query(
    'INSERT INTO video_operations (video_id, operation_type, status, parameters) VALUES ($1, $2, $3, $4) RETURNING id',
    [videoId, 'resize', 'failed', JSON.stringify({ width: 100, height: 100 })]
  );
  const opId = `op-${op.rows[0].id}`;
  console.log(`Created failed operation: ${opId}`);

  // 3. Create "Stuck" reservation (Insert directly with old timestamp to avoid immutability guard on UPDATE)
  console.log('Creating stuck reservation (1 hour old)...');
  await query(
    'INSERT INTO credit_transactions (user_id, amount, type, description, operation_id, created_at) VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL \'1 hour\')',
    [user.id, -5, 'reservation', `Reserved for operation ${opId}`, opId]
  );
  // Also need to manually deduct credits if we bypass userService
  await query('UPDATE users SET credits = credits - 5 WHERE id = $1', [user.id]);

  const userBefore = await userService.findById(user.id);
  console.log(`User credits before janitor: ${userBefore.credits} (Expected: 5)`);

  // 4. Run Janitor
  console.log('\nRunning janitor...');
  const janitor = new ReservationJanitor(null, { ttlMinutes: 30 });
  const metrics = await janitor.run();
  console.log('Janitor metrics:', metrics);

  // 5. Verify Results
  const userAfter = await userService.findById(user.id);
  console.log(`User credits after janitor: ${userAfter.credits} (Expected: 10)`);

  if (userAfter.credits === 10 && metrics.released_count === 1) {
    console.log('\n✅ RESERVATION JANITOR TEST PASSED');
    process.exit(0);
  } else {
    console.error('\n❌ RESERVATION JANITOR TEST FAILED');
    process.exit(1);
  }
}

testJanitor().catch(err => {
  console.error('Test crashed:', err);
  process.exit(1);
});
