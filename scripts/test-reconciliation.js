const { query } = require('../packages/database/db');
const userService = require('../packages/shared/database/services/userService');
const { execSync } = require('child_process');

async function testReconciliation() {
  console.log('--- Testing Billing Reconciliation ---');

  // 1. Setup User
  const username = `recon_test_${Date.now()}`;
  const user = await userService.createUser({
    username,
    email: `${username}@example.com`,
    password: 'password123'
  });
  console.log(`Created test user: ${user.username} (Initial Ledger Sum: 10, Balance: 10)`);

  // 2. Simulate Drift: Update balance directly without ledger entry
  console.log('Inducing drift: Setting balance to 50 manually...');
  await query('UPDATE users SET credits = 50 WHERE id = $1', [user.id]);

  // 3. Run Check
  console.log('\nRunning RECONCILE CHECK...');
  const checkOutput = execSync(`node apps/api/scripts/reconciliation.js --mode check --userId ${user.id}`).toString();
  console.log(checkOutput);

  if (checkOutput.includes('40 ⚠️')) {
    console.log('✅ Drift successfully detected.');
  } else {
    console.error('❌ Drift NOT detected.');
    process.exit(1);
  }

  // 4. Run Explain
  console.log('\nRunning RECONCILE EXPLAIN...');
  const explainOutput = execSync(`node apps/api/scripts/reconciliation.js --mode explain --userId ${user.id}`).toString();
  console.log(explainOutput);

  // 5. Run Repair
  console.log('\nRunning RECONCILE REPAIR...');
  const repairOutput = execSync(`node apps/api/scripts/reconciliation.js --mode repair --userId ${user.id}`).toString();
  console.log(repairOutput);

  // 6. Verify Repair
  console.log('\nVerifying Repair...');
  const userAfter = await userService.findById(user.id);
  const ledgerSumRes = await query('SELECT SUM(amount) as sum FROM credit_transactions WHERE user_id = $1', [user.id]);
  const ledgerSum = Number(ledgerSumRes.rows[0].sum);

  console.log(`Final Balance: ${userAfter.credits}`);
  console.log(`Final Ledger Sum: ${ledgerSum}`);

  if (Number(userAfter.credits) === ledgerSum && ledgerSum === 50) {
    console.log('\n✅ RECONCILIATION TEST PASSED');
    process.exit(0);
  } else {
    console.error('\n❌ RECONCILIATION TEST FAILED');
    process.exit(1);
  }
}

testReconciliation().catch(err => {
  console.error('Test crashed:', err);
  process.exit(1);
});
