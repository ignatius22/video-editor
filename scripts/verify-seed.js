const { query } = require('../packages/shared/database/db');

async function verifySeeding() {
  try {
    console.log('--- Verification Results ---');
    
    const usersCount = await query('SELECT COUNT(*) FROM users');
    console.log(`Users: ${usersCount.rows[0].count}`);
    
    const videosCount = await query('SELECT COUNT(*) FROM videos');
    console.log(`Videos: ${videosCount.rows[0].count}`);
    
    const imagesCount = await query('SELECT COUNT(*) FROM images');
    console.log(`Images: ${imagesCount.rows[0].count}`);
    
    const videoOpsCount = await query('SELECT COUNT(*) FROM video_operations');
    console.log(`Video Operations: ${videoOpsCount.rows[0].count}`);
    
    const imageOpsCount = await query('SELECT COUNT(*) FROM image_operations');
    console.log(`Image Operations: ${imageOpsCount.rows[0].count}`);
    
    const outboxCount = await query('SELECT COUNT(*) FROM outbox_events');
    console.log(`Outbox Events: ${outboxCount.rows[0].count}`);
    
    console.log('--- End of Verification ---');
    process.exit(0);
  } catch (err) {
    console.error('Verification failed:', err.message);
    process.exit(1);
  }
}

verifySeeding();
