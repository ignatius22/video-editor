const db = require('@video-editor/shared/database/db');

async function cleanup() {
  const result = await db.query("DELETE FROM video_operations WHERE status = 'failed'");
  console.log('Deleted', result.rowCount, 'failed operations');
  process.exit(0);
}

cleanup().catch(e => { console.error(e); process.exit(1); });
