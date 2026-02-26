const db = require('@convertix/shared/database/db');

async function migrateImages() {
  // Find records in 'videos' table that have image extensions
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'];
  const result = await db.query(
    `SELECT * FROM videos WHERE extension = ANY($1)`,
    [imageExts]
  );

  console.log(`Found ${result.rows.length} image records in videos table`);

  for (const row of result.rows) {
    try {
      // Insert into images table
      await db.query(
        `INSERT INTO images (image_id, user_id, name, extension, dimensions, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (image_id) DO NOTHING`,
        [row.video_id, row.user_id, row.name, row.extension, 
         JSON.stringify(row.dimensions), JSON.stringify(row.metadata || {}),
         row.created_at, row.updated_at]
      );
      console.log(`Migrated image ${row.video_id} (${row.name}.${row.extension})`);
    } catch (e) {
      console.error(`Failed to migrate ${row.video_id}:`, e.message);
    }
  }

  process.exit(0);
}

migrateImages().catch(e => { console.error(e); process.exit(1); });
