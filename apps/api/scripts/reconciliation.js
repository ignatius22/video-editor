const { query, transaction } = require('@video-editor/shared/database/db');
const userService = require('@video-editor/shared/database/services/userService');
const createLogger = require('@video-editor/shared/lib/logger');
const logger = createLogger('billing-reconciliation');

async function reconcile() {
  const args = process.argv.slice(2);
  const mode = getArg(args, '--mode') || 'check';
  const targetUserId = getArg(args, '--userId');

  console.log(`\n--- Billing Reconciliation TOOL (${mode.toUpperCase()}) ---`);

  if (mode === 'check') {
    await runCheck(targetUserId);
  } else if (mode === 'explain') {
    if (!targetUserId) {
      console.error('Error: --userId is required for explain mode');
      process.exit(1);
    }
    await runExplain(targetUserId);
  } else if (mode === 'repair') {
    await runRepair(targetUserId);
  } else {
    console.error(`Unknown mode: ${mode}. Use check, explain, or repair.`);
  }

  process.exit(0);
}

function getArg(args, key) {
  const index = args.indexOf(key);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return null;
}

async function runCheck(userId = null) {
  console.log('Fetching ledger vs balance data...');
  
  const sql = `
    SELECT 
      u.id, 
      u.username, 
      u.credits as current_balance,
      COALESCE(SUM(t.amount), 0) as ledger_sum,
      (u.credits - COALESCE(SUM(t.amount), 0)) as drift
    FROM users u
    LEFT JOIN credit_transactions t ON u.id = t.user_id
    ${userId ? 'WHERE u.id = $1' : ''}
    GROUP BY u.id
    ORDER BY ABS(u.credits - COALESCE(SUM(t.amount), 0)) DESC
  `;

  const results = await query(sql, userId ? [userId] : []);
  
  console.log('\nID | Username | Balance | Ledger Sum | Drift');
  console.log('-'.repeat(50));
  
  let driftCount = 0;
  for (const row of results.rows) {
    const driftMarker = row.drift !== 0 ? '⚠️' : '✅';
    console.log(`${row.id} | ${row.username} | ${row.current_balance} | ${row.ledger_sum} | ${row.drift} ${driftMarker}`);
    if (row.drift !== 0) driftCount++;
  }

  console.log(`\nScan complete. Found ${driftCount} users with drift.`);
}

async function runExplain(userId) {
  const user = await userService.findById(userId);
  if (!user) {
    console.error(`User ${userId} not found`);
    return;
  }

  const transactions = await query(
    'SELECT id, amount, type, description, created_at FROM credit_transactions WHERE user_id = $1 ORDER BY created_at ASC',
    [userId]
  );

  console.log(`\nExplaining User: ${user.username} (ID: ${userId})`);
  console.log(`Reported Balance: ${user.credits}`);
  console.log('\nLedger History:');
  console.log('ID | Created At | Amount | Type | Description');
  console.log('-'.repeat(80));

  let runningSum = 0;
  for (const tx of transactions.rows) {
    runningSum += Number(tx.amount);
    console.log(`${String(tx.id).padEnd(5)} | ${new Date(tx.created_at).toISOString()} | ${String(tx.amount).padEnd(6)} | ${tx.type.padEnd(12)} | ${tx.description}`);
  }

  console.log('-'.repeat(80));
  console.log(`Final Ledger Sum: ${runningSum}`);
  console.log(`Balance Mismatch: ${Number(user.credits) - runningSum}`);
}

async function runRepair(userId = null) {
  console.log(`Repairing drift for ${userId ? 'User ' + userId : 'ALL users'}...`);

  const driftResults = await query(`
    SELECT u.id, u.username, u.credits, COALESCE(SUM(t.amount), 0) as ledger_sum
    FROM users u
    LEFT JOIN credit_transactions t ON u.id = t.user_id
    ${userId ? 'WHERE u.id = $1' : ''}
    GROUP BY u.id
    HAVING u.credits != COALESCE(SUM(t.amount), 0)
  `, userId ? [userId] : []);

  if (driftResults.rows.length === 0) {
    console.log('No drift detected. Nothing to repair.');
    return;
  }

  for (const row of driftResults.rows) {
    const delta = Number(row.ledger_sum) - Number(row.credits);
    console.log(`Repairing User ${row.username}: Balance ${row.credits} -> ${row.ledger_sum} (Adjustment: ${delta})`);

    await transaction(async (client) => {
      // Repair logic: Align the LEDGER to the BALANCE using a compensating entry
      const adjustment = Number(row.credits) - Number(row.ledger_sum);
      await client.query(
        'INSERT INTO credit_transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
        [row.id, adjustment, 'reconciliation_adjustment', `System repair for balance drift (Delta: ${adjustment})`]
      );
    });
    console.log(`✅ User ${row.username} repaired.`);
  }
}

reconcile().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
