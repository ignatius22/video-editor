/**
 * Migration Script: File-Based DB → PostgreSQL
 *
 * Migrates existing data from JSON files to PostgreSQL database:
 * - data/users → users table (with password hashing)
 * - data/sessions → sessions table (with expiration)
 * - data/videos → videos table (currently empty)
 *
 * Usage: node database/migrate-from-files.js
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { query, getClient } = require('./db');
const userService = require('./services/userService');
const sessionService = require('./services/sessionService');
const videoService = require('./services/videoService');

const DATA_DIR = path.join(__dirname, '../data');
const BACKUP_DIR = path.join(DATA_DIR, 'backup');
const SALT_ROUNDS = 10;

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`  ${title}`, 'bright');
  log('='.repeat(60), 'cyan');
}

/**
 * Read JSON file safely
 */
function readJsonFile(filename) {
  const filepath = path.join(DATA_DIR, filename);

  if (!fs.existsSync(filepath)) {
    log(`⚠️  File not found: ${filename}`, 'yellow');
    return null;
  }

  try {
    const content = fs.readFileSync(filepath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    log(`❌ Error reading ${filename}: ${error.message}`, 'red');
    return null;
  }
}

/**
 * Create backup of original files
 */
function createBackups() {
  logSection('CREATING BACKUPS');

  // Create backup directory
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    log('✅ Created backup directory', 'green');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const files = ['users', 'sessions', 'videos'];

  files.forEach(filename => {
    const sourcePath = path.join(DATA_DIR, filename);
    const backupPath = path.join(BACKUP_DIR, `${filename}.${timestamp}.backup`);

    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, backupPath);
      log(`✅ Backed up: ${filename} → ${path.basename(backupPath)}`, 'green');
    }
  });
}

/**
 * Migrate users with password hashing
 */
async function migrateUsers(users) {
  logSection('MIGRATING USERS');

  if (!users || users.length === 0) {
    log('⚠️  No users to migrate', 'yellow');
    return { migrated: 0, userIdMap: {} };
  }

  log(`Found ${users.length} users to migrate\n`, 'blue');

  const userIdMap = {}; // Map old IDs to new IDs
  let migrated = 0;

  for (const oldUser of users) {
    try {
      // Hash password (currently plain text "string")
      const password_hash = await bcrypt.hash(oldUser.password || 'defaultPassword123', SALT_ROUNDS);

      // Insert user
      const result = await query(
        `INSERT INTO users (username, email, password_hash, tier, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         RETURNING id`,
        [
          oldUser.username,
          oldUser.email || `${oldUser.username}@example.com`, // Generate email if missing
          password_hash,
          oldUser.tier || 'free'
        ]
      );

      const newUserId = result.rows[0].id;
      userIdMap[oldUser.id] = newUserId;

      log(`✅ Migrated user: ${oldUser.username} (ID: ${oldUser.id} → ${newUserId})`, 'green');
      migrated++;

    } catch (error) {
      if (error.code === '23505') {
        log(`⚠️  User already exists: ${oldUser.username} (skipping)`, 'yellow');
      } else {
        log(`❌ Error migrating user ${oldUser.username}: ${error.message}`, 'red');
      }
    }
  }

  log(`\n📊 Users migrated: ${migrated}/${users.length}`, 'blue');
  return { migrated, userIdMap };
}

/**
 * Migrate sessions with proper expiration
 */
async function migrateSessions(sessions, userIdMap) {
  logSection('MIGRATING SESSIONS');

  if (!sessions || sessions.length === 0) {
    log('⚠️  No sessions to migrate', 'yellow');
    return { migrated: 0 };
  }

  log(`Found ${sessions.length} sessions to migrate\n`, 'blue');

  let migrated = 0;
  let skipped = 0;

  for (const oldSession of sessions) {
    try {
      // Get new user ID
      const newUserId = userIdMap[oldSession.userId];

      if (!newUserId) {
        log(`⚠️  User ID ${oldSession.userId} not found (session skipped)`, 'yellow');
        skipped++;
        continue;
      }

      // Insert session with 7-day expiration
      await query(
        `INSERT INTO sessions (user_id, token, created_at, expires_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '7 days')`,
        [newUserId, oldSession.token]
      );

      log(`✅ Migrated session: User ${oldSession.userId} → ${newUserId} (token: ${oldSession.token.substring(0, 10)}...)`, 'green');
      migrated++;

    } catch (error) {
      if (error.code === '23505') {
        log(`⚠️  Session token already exists (skipping)`, 'yellow');
        skipped++;
      } else {
        log(`❌ Error migrating session: ${error.message}`, 'red');
        skipped++;
      }
    }
  }

  log(`\n📊 Sessions migrated: ${migrated}/${sessions.length} (skipped: ${skipped})`, 'blue');
  return { migrated, skipped };
}

/**
 * Migrate videos and operations
 */
async function migrateVideos(videos, userIdMap) {
  logSection('MIGRATING VIDEOS');

  if (!videos || videos.length === 0) {
    log('⚠️  No videos to migrate (videos array is empty)', 'yellow');
    return { migrated: 0 };
  }

  log(`Found ${videos.length} videos to migrate\n`, 'blue');

  let migrated = 0;

  for (const oldVideo of videos) {
    try {
      // Get new user ID
      const newUserId = userIdMap[oldVideo.userId];

      if (!newUserId) {
        log(`⚠️  User ID ${oldVideo.userId} not found (video skipped)`, 'yellow');
        continue;
      }

      // Insert video
      await query(
        `INSERT INTO videos (video_id, user_id, name, extension, dimensions, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          oldVideo.videoId,
          newUserId,
          oldVideo.name,
          oldVideo.extension,
          JSON.stringify(oldVideo.dimensions || null),
          JSON.stringify(oldVideo.metadata || {}),
          oldVideo.createdAt || new Date().toISOString()
        ]
      );

      log(`✅ Migrated video: ${oldVideo.name} (ID: ${oldVideo.videoId})`, 'green');

      // Migrate video operations if they exist
      if (oldVideo.resizes) {
        await migrateVideoOperations(oldVideo.videoId, 'resize', oldVideo.resizes);
      }

      migrated++;

    } catch (error) {
      if (error.code === '23505') {
        log(`⚠️  Video already exists: ${oldVideo.videoId} (skipping)`, 'yellow');
      } else {
        log(`❌ Error migrating video: ${error.message}`, 'red');
      }
    }
  }

  log(`\n📊 Videos migrated: ${migrated}/${videos.length}`, 'blue');
  return { migrated };
}

/**
 * Migrate video operations (resizes, conversions, etc.)
 */
async function migrateVideoOperations(videoId, operationType, operations) {
  if (!operations || typeof operations !== 'object') {
    return;
  }

  for (const [key, operation] of Object.entries(operations)) {
    try {
      // Parse operation parameters (e.g., "800x600" → {width: 800, height: 600})
      const params = {};
      if (operationType === 'resize' && key.includes('x')) {
        const [width, height] = key.split('x').map(Number);
        params.width = width;
        params.height = height;
      }

      await query(
        `INSERT INTO video_operations (video_id, operation_type, status, parameters, result_path, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          videoId,
          operationType,
          operation.processing ? 'processing' : (operation.path ? 'completed' : 'pending'),
          JSON.stringify(params),
          operation.path || null,
          new Date().toISOString()
        ]
      );

      log(`  ✅ Migrated operation: ${operationType} ${key}`, 'green');

    } catch (error) {
      log(`  ⚠️  Error migrating operation ${key}: ${error.message}`, 'yellow');
    }
  }
}

/**
 * Verify migration results
 */
async function verifyMigration() {
  logSection('VERIFICATION');

  try {
    const userCount = await query('SELECT COUNT(*) as count FROM users');
    const sessionCount = await query('SELECT COUNT(*) as count FROM sessions');
    const videoCount = await query('SELECT COUNT(*) as count FROM videos');
    const operationCount = await query('SELECT COUNT(*) as count FROM video_operations');

    log(`✅ Users in database: ${userCount.rows[0].count}`, 'green');
    log(`✅ Sessions in database: ${sessionCount.rows[0].count}`, 'green');
    log(`✅ Videos in database: ${videoCount.rows[0].count}`, 'green');
    log(`✅ Video operations in database: ${operationCount.rows[0].count}`, 'green');

    // Show sample data
    const sampleUser = await query('SELECT username, email, tier FROM users LIMIT 1');
    if (sampleUser.rows.length > 0) {
      log(`\n📝 Sample user: ${JSON.stringify(sampleUser.rows[0], null, 2)}`, 'cyan');
    }

  } catch (error) {
    log(`❌ Verification error: ${error.message}`, 'red');
  }
}

/**
 * Main migration function
 */
async function migrate() {
  log('\n' + '='.repeat(60), 'bright');
  log('  📦 FILE-BASED DB → POSTGRESQL MIGRATION', 'bright');
  log('='.repeat(60) + '\n', 'bright');

  try {
    // Step 1: Create backups
    createBackups();

    // Step 2: Read JSON files
    logSection('READING DATA FILES');
    const users = readJsonFile('users');
    const sessions = readJsonFile('sessions');
    const videos = readJsonFile('videos');

    if (!users && !sessions && !videos) {
      log('❌ No data files found. Exiting.', 'red');
      process.exit(1);
    }

    log(`✅ Users: ${users ? users.length : 0}`, 'green');
    log(`✅ Sessions: ${sessions ? sessions.length : 0}`, 'green');
    log(`✅ Videos: ${videos ? videos.length : 0}`, 'green');

    // Step 3: Migrate users
    const { migrated: usersMigrated, userIdMap } = await migrateUsers(users);

    // Step 4: Migrate sessions
    const { migrated: sessionsMigrated } = await migrateSessions(sessions, userIdMap);

    // Step 5: Migrate videos
    const { migrated: videosMigrated } = await migrateVideos(videos, userIdMap);

    // Step 6: Verify migration
    await verifyMigration();

    // Summary
    logSection('MIGRATION COMPLETE');
    log('✅ Users migrated: ' + usersMigrated, 'green');
    log('✅ Sessions migrated: ' + sessionsMigrated, 'green');
    log('✅ Videos migrated: ' + videosMigrated, 'green');
    log('\n📁 Original files backed up to: data/backup/', 'blue');
    log('🎉 Migration completed successfully!\n', 'green');

  } catch (error) {
    log(`\n❌ Migration failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }

  process.exit(0);
}

// Run migration
if (require.main === module) {
  migrate();
}

module.exports = { migrate };
