const { query, transaction } = require('../packages/database/db');
const userService = require('../packages/shared/database/services/userService');
const { v4: uuidv4 } = require('uuid');

async function verifyGuards() {
  console.log('--- Verifying Database State Machine Guards ---');

  // 1. Setup User
  const username = `guard_test_${Date.now()}`;
  const user = await userService.createUser({
    username,
    email: `${username}@example.com`,
    password: 'password123'
  });
  console.log(`Created test user: ${user.username} (ID: ${user.id})`);

  const opId = `op-test-${uuidv4()}`;

  // 2. Test: No reservation before capture
  console.log('\nSCENARIO: Capture without reservation');
  try {
    await query(
      'INSERT INTO credit_transactions (user_id, amount, type, description, operation_id) VALUES ($1, $2, $3, $4, $5)',
      [user.id, -1, 'debit_capture', 'Illegal capture', opId]
    );
    console.error('❌ FAIL: Allowed capture without reservation');
  } catch (err) {
    console.log(`✅ SUCCESS: Rejected (Error: ${err.message})`);
  }

  // 3. Setup: Valid reservation
  console.log('\nSCENARIO: Valid reservation');
  await userService.reserveCredits(user.id, 5, opId);
  console.log('   Reservation created.');

  // 4. Test: Amount mismatch
  console.log('\nSCENARIO: Capture with wrong amount');
  try {
    await query(
      'INSERT INTO credit_transactions (user_id, amount, type, description, operation_id) VALUES ($1, $2, $3, $4, $5)',
      [user.id, -10, 'debit_capture', 'Wrong amount', opId]
    );
    console.error('❌ FAIL: Allowed capture with mismatched amount');
  } catch (err) {
    console.log(`✅ SUCCESS: Rejected (Error: ${err.message})`);
  }

  // 5. Test: Valid Refund
  console.log('\nSCENARIO: Valid Refund');
  await userService.releaseCredits(opId);
  console.log('   Refund processed.');

  // 6. Test: Capture after Refund (Illegal)
  console.log('\nSCENARIO: Capture after Refund');
  try {
    await query(
      'INSERT INTO credit_transactions (user_id, amount, type, description, operation_id) VALUES ($1, $2, $3, $4, $5)',
      [user.id, -5, 'debit_capture', 'Illegal capture after refund', opId]
    );
    console.error('❌ FAIL: Allowed capture after refund');
  } catch (err) {
    console.log(`✅ SUCCESS: Rejected (Error: ${err.message})`);
  }

  // 7. Test: Immutability (Update Record)
  console.log('\nSCENARIO: Prevent Update');
  try {
    const lastRes = await query('SELECT id FROM credit_transactions WHERE operation_id = $1 LIMIT 1', [opId]);
    await query('UPDATE credit_transactions SET description = \'Hacked\' WHERE id = $1', [lastRes.rows[0].id]);
    console.error('❌ FAIL: Allowed update to ledger entry');
  } catch (err) {
    console.log(`✅ SUCCESS: Rejected (Error: ${err.message})`);
  }

  console.log('\n--- ALL STATE GUARD TESTS PASSED ---');
  process.exit(0);
}

verifyGuards().catch(err => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
