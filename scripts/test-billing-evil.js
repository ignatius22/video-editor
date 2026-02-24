const { query } = require('../packages/database/db');
const userService = require('../packages/shared/database/services/userService');
const { v4: uuidv4 } = require('uuid');

async function runEvilTests() {
  console.log('=== BILLING EVIL TESTS: CONCURRENCY & STRESS ===');

  // 1. Setup User
  const username = `evil_test_${Date.now()}`;
  const user = await userService.createUser({
    username,
    email: `${username}@example.com`,
    password: 'password123'
  });
  console.log(`Created test user: ${user.username} (Initial Credits: 10)`);

  // 2. TEST: Concurrent Reservations (The Thundering Herd)
  console.log('\nSCENARIO: Hammering with concurrent reservations (10 credits each, 20 parallel requests)');
  const reservationPromises = [];
  for (let i = 0; i < 20; i++) {
    reservationPromises.push(userService.reserveCredits(user.id, 10, `op-concur-${uuidv4()}`));
  }

  const resResults = await Promise.allSettled(reservationPromises);
  const succeededCount = resResults.filter(r => r.status === 'fulfilled').length;
  const failedCount = resResults.filter(r => r.status === 'rejected').length;

  console.log(`Results: ${succeededCount} succeeded, ${failedCount} failed.`);
  
  if (succeededCount === 1) {
    console.log('✅ SUCCESS: Exactly one reservation succeeded. Balances are safe.');
  } else {
    console.error(`❌ FAIL: ${succeededCount} reservations succeeded. User is likely overdrawn!`);
  }

  // 3. TEST: Concurrent Captures (The Double Charge)
  console.log('\nSCENARIO: Attempting parallel captures for the same reservation');
  const opId = `op-double-${uuidv4()}`;
  await userService.addCredits(user.id, 10, 'Reset for capture test');
  await userService.reserveCredits(user.id, 5, opId);
  
  const capturePromises = [];
  for (let i = 0; i < 10; i++) {
    capturePromises.push(userService.captureCredits(opId));
  }

  const capResults = await Promise.allSettled(capturePromises);
  const capSuccessCount = capResults.filter(r => r.status === 'fulfilled').length;
  console.log(`Capture Results: ${capSuccessCount} succeeded, ${capResults.length - capSuccessCount} failed.`);

  if (capSuccessCount === 1) {
    console.log('✅ SUCCESS: Double capture prevented at database/service level.');
  } else {
    console.error(`❌ FAIL: ${capSuccessCount} captures succeeded for a single operation!`);
  }

  // 4. TEST: Concurrent Releases (The Duplicate Refund)
  console.log('\nSCENARIO: Attempting parallel releases for the same reservation');
  const relOpId = `op-refund-${uuidv4()}`;
  await userService.reserveCredits(user.id, 5, relOpId);
  
  const releasePromises = [];
  for (let i = 0; i < 10; i++) {
    releasePromises.push(userService.releaseCredits(relOpId));
  }

  const relResults = await Promise.allSettled(releasePromises);
  const relSuccessCount = relResults.filter(r => r.status === 'fulfilled' && r.value !== null).length;
  console.log(`Release Results: ${relSuccessCount} succeeded, ${relResults.length - relSuccessCount} failed/skipped.`);

  if (relSuccessCount === 1) {
    console.log('✅ SUCCESS: Duplicate release prevented.');
  } else {
    console.error(`❌ FAIL: ${relSuccessCount} releases succeeded for a single operation!`);
  }

  // 5. Check Final Balance Integrity
  console.log('\nVerifying Absolute Integrity...');
  const userFinal = await userService.findById(user.id);
  const ledgerSumRes = await query('SELECT SUM(amount) as sum FROM credit_transactions WHERE user_id = $1', [user.id]);
  const ledgerSum = Number(ledgerSumRes.rows[0].sum);

  console.log(`Final User Balance: ${userFinal.credits}`);
  console.log(`Final Ledger Sum: ${ledgerSum}`);

  if (Number(userFinal.credits) === ledgerSum) {
    console.log('✅ SUCCESS: Balance matches ledger sum after the storm.');
  } else {
    console.error('❌ FAIL: Balance/Ledger DRIFT detected!');
  }

  console.log('\n=== EVIL TESTS COMPLETE ===');
  process.exit(0);
}

runEvilTests().catch(err => {
  console.error('Evil Test Driver crashed:', err);
  process.exit(1);
});
