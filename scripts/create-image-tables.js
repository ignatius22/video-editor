const db = require('@convertix/shared/database/db');

async function createImageTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS images (
      id SERIAL PRIMARY KEY,
      image_id VARCHAR(50) UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      extension VARCHAR(10) NOT NULL CHECK (extension IN ('jpg', 'jpeg', 'png', 'webp', 'gif')),
      dimensions JSONB,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Created images table');

  await db.query(`
    CREATE TABLE IF NOT EXISTS image_operations (
      id SERIAL PRIMARY KEY,
      image_id VARCHAR(50) NOT NULL REFERENCES images(image_id) ON DELETE CASCADE,
      operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('crop', 'resize', 'convert-image')),
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
      parameters JSONB NOT NULL,
      result_path VARCHAR(500),
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Created image_operations table');

  await db.query(`CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_images_image_id ON images(image_id);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_image_operations_image_id ON image_operations(image_id);`);
  console.log('Created indexes');

  process.exit(0);
}

createImageTables().catch(e => { console.error(e); process.exit(1); });
