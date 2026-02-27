const { query } = require('../packages/shared/database/db');
const fs = require('fs');
const path = require('path');

async function applyOutboxMigration() {
  try {
    const migrationPath = path.join(__dirname, '..', 'packages', 'database', 'migrations', '006_create_outbox.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Applying outbox migration...');
    await query(sql);
    console.log('✓ Outbox migration applied successfully');
    process.exit(0);
  } catch (err) {
    console.error('✗ Failed to apply outbox migration:', err.message);
    process.exit(1);
  }
}

applyOutboxMigration();
