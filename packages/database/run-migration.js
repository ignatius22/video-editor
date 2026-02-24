const fs = require('fs');
const path = require('path');
const { query } = require('./db');

async function runMigration(migrationFile) {
  const filePath = path.join(__dirname, 'migrations', migrationFile);
  const sql = fs.readFileSync(filePath, 'utf8');

  console.log(`Running migration: ${migrationFile}...`);
  try {
    const result = await query(sql);
    console.log('Migration result:', result.rows || result);
    console.log('✅ Migration successful!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Please specify a migration file name (e.g. 004_billing_state_guards.sql)');
  process.exit(1);
}

runMigration(migrationFile).then(() => process.exit(0));
