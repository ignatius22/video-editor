const { query, close } = require('@video-editor/database/db');

async function probe() {
  const types = [
    'resize', 'convert', 'crop', 'resize-image', 'convert-image',
    'video-resize', 'video-convert', 'image-crop', 'image-resize', 'image-convert',
    'video-rescale', 'format-convert', 'watermark', 'audio-extract'
  ];

  console.log('Probing valid types...');
  const valid = [];
  
  // Get a user ID for tests
  const userRes = await query('SELECT id FROM users LIMIT 1');
  if (userRes.rows.length === 0) {
      console.error('No users found. Run user seed first.');
      process.exit(1);
  }
  const userId = userRes.rows[0].id;

  for (const t of types) {
    try {
      await query(
        'INSERT INTO job_history (job_id, status, type, user_id, created_at, duration) VALUES ($1, $2, $3, $4, $5, $6)',
        ['probe_' + t, 'completed', t, userId, new Date(), 100]
      );
      console.log(`✅ Valid: ${t}`);
      valid.push(t);
      // Clean up
      await query('DELETE FROM job_history WHERE job_id = $1', ['probe_' + t]);
    } catch (e) {
      console.log(`❌ Invalid: ${t}`);
    }
  }

  console.log('Summary of valid types:', valid);
  await close();
}

probe();
