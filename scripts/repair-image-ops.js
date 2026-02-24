const db = require('@video-editor/shared/database/db');
const fs = require('fs');
const path = require('path');
const storagePath = '/app/storage';

async function repair() {
  const { rows: ops } = await db.query("SELECT * FROM image_operations WHERE status = 'pending' AND operation_type = 'crop'");
  console.log(`Checking ${ops.length} pending crop operations...`);
  
  for (const op of ops) {
    const { width, height, x, y } = op.parameters;
    const { rows: imgs } = await db.query('SELECT extension FROM images WHERE image_id = $1', [op.image_id]);
    
    if (imgs.length === 0) {
      console.log(`Image ${op.image_id} not found in database, skipping.`);
      continue;
    }
    
    const ext = imgs[0].extension;
    const filename = `cropped_${width}x${height}x${x}x${y}.${ext}`;
    const filePath = path.join(storagePath, op.image_id, filename);
    
    if (fs.existsSync(filePath)) {
      console.log(`[FIX] File found for op ${op.id} at ${filePath}. Updating status to completed.`);
      await db.query(
        "UPDATE image_operations SET status = 'completed', result_path = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [filePath, op.id]
      );
    } else {
      console.log(`[MISSING] File not found for op ${op.id} at ${filePath}`);
    }
  }
  
  console.log('Repair complete.');
  process.exit(0);
}

repair().catch(err => {
  console.error('Repair failed:', err);
  process.exit(1);
});
