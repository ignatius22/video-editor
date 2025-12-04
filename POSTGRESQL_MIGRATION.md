# PostgreSQL Migration Guide

## 🎯 Overview

This document explains the migration from file-based JSON storage to **PostgreSQL** relational database, providing ACID transactions, complex queries, and scalability.

---

## Why PostgreSQL?

### Problems with File-Based DB

```javascript
// Current DB.js - Race Conditions!
DB.update();  // Worker 1 reads
DB.update();  // Worker 2 reads (stale data)
video.resizes['800x600'].processing = false;  // Worker 1 writes
video.resizes['1920x1080'].processing = false; // Worker 2 writes
DB.save();  // Worker 1 saves
DB.save();  // Worker 2 overwrites! ❌ Data lost
```

### PostgreSQL Solutions

✅ **ACID Transactions** - No race conditions
✅ **Foreign Keys** - Data integrity guaranteed
✅ **Complex Queries** - Analytics and reporting
✅ **Scalability** - Millions of records easily
✅ **Security** - Password hashing with bcrypt
✅ **Indexes** - Fast lookups
✅ **Connection Pooling** - Efficient resource usage

---

## Database Schema

### Tables

**1. users** - Application users
```sql
id, username, email, password_hash, tier, created_at, updated_at
```

**2. sessions** - Authentication tokens
```sql
id, user_id, token, created_at, expires_at
```

**3. videos** - Uploaded videos
```sql
id, video_id, user_id, name, extension, dimensions, metadata, created_at
```

**4. video_operations** - Resize/convert operations
```sql
id, video_id, operation_type, status, parameters, result_path, error_message
```

**5. job_history** - Bull queue job analytics
```sql
id, job_id, video_id, user_id, type, status, priority, progress, duration, etc.
```

### Relationships

```
users (1) ──→ (many) sessions
users (1) ──→ (many) videos
videos (1) ──→ (many) video_operations
videos (1) ──→ (many) job_history
```

### Key Features

- **Foreign Keys with CASCADE** - Delete user → deletes all their data
- **CHECK Constraints** - Data validation at DB level
- **JSONB Columns** - Flexible metadata storage
- **Indexes** - Fast queries on common lookups
- **Triggers** - Auto-update `updated_at` timestamps
- **Functions** - Complex queries (user stats, cleanup)

---

## Setup Instructions

### 1. Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**macOS:**
```bash
brew install postgresql
brew services start postgresql
```

**Windows:**
Download from: https://www.postgresql.org/download/windows/

**Docker:**
```bash
docker run -d \
  --name video-editor-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=video_editor \
  -p 5432:5432 \
  postgres:14-alpine
```

### 2. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE video_editor;

# Exit
\q
```

### 3. Run Schema Migration

```bash
# From project root
psql -U postgres -d video_editor -f database/schema.sql
```

### 4. Configure Environment Variables

Create `.env` file:
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=video_editor
DB_USER=postgres
DB_PASSWORD=your_password_here
```

### 5. Install Node Dependencies

```bash
npm install pg bcrypt
```

### 6. Test Connection

```bash
node -e "require('./database/db').query('SELECT NOW()')"
```

You should see: `✅ Database connected successfully`

---

## Architecture

### Before: File-Based

```
┌─────────────────────┐
│  data/users        │  ← JSON file
│  data/sessions     │  ← JSON file
│  data/videos       │  ← JSON file
└─────────────────────┘

❌ Race conditions
❌ No transactions
❌ No relationships
❌ No complex queries
❌ Plain text passwords
```

### After: PostgreSQL

```
┌──────────────────────────────┐
│       PostgreSQL              │
│                               │
│  ┌─────────┐  ┌──────────┐  │
│  │  users  │→ │ sessions │  │
│  └────┬────┘  └──────────┘  │
│       │                      │
│       ↓                      │
│  ┌─────────┐  ┌──────────┐  │
│  │ videos  │→ │video_ops │  │
│  └────┬────┘  └──────────┘  │
│       │                      │
│       ↓                      │
│  ┌──────────────┐            │
│  │ job_history  │            │
│  └──────────────┘            │
└──────────────────────────────┘

✅ ACID transactions
✅ Foreign keys
✅ Complex queries
✅ Password hashing
✅ Connection pooling
```

---

## Services Layer

### User Service (`database/services/userService.js`)

```javascript
const userService = require('./database/services/userService');

// Create user with hashed password
const user = await userService.createUser({
  username: 'john_doe',
  email: 'john@example.com',
  password: 'plain_text_password',  // Auto-hashed
  tier: 'pro'
});

// Verify login
const user = await userService.verifyPassword('john_doe', 'password');

// Get user stats
const stats = await userService.getUserStats(userId);
// {
//   total_videos: 50,
//   total_jobs: 200,
//   completed_jobs: 195,
//   failed_jobs: 5,
//   avg_job_duration: 45000
// }
```

### Session Service (`database/services/sessionService.js`)

```javascript
const sessionService = require('./database/services/sessionService');

// Create session (login)
const session = await sessionService.createSession(userId, 7); // 7 days
// { id, user_id, token, expires_at }

// Validate token
const user = await sessionService.validateToken(token);
// { id, username, email, tier } or null

// Logout
await sessionService.deleteSession(token);

// Cleanup expired
const deleted = await sessionService.cleanupExpiredSessions();
```

### Video Service (`database/services/videoService.js`)

```javascript
const videoService = require('./database/services/videoService');

// Create video
const video = await videoService.createVideo({
  videoId: 'abc123',
  userId: 1,
  name: 'my-video.mp4',
  extension: 'mp4',
  dimensions: { width: 1920, height: 1080 }
});

// Get user's videos
const videos = await videoService.getUserVideos(userId);

// Add resize operation
await videoService.addOperation(videoId, {
  type: 'resize',
  status: 'processing',
  parameters: { width: 800, height: 600 }
});

// Update operation status
await videoService.updateOperationStatus(operationId, 'completed', '/path/to/result.mp4');
```

### Job History Service (`database/services/jobHistoryService.js`)

```javascript
const jobHistoryService = require('./database/services/jobHistoryService');

// Record job
await jobHistoryService.createJob({
  jobId: 'bull-job-123',
  videoId: 'abc123',
  userId: 1,
  type: 'resize',
  priority: 'high',
  data: { width: 800, height: 600 }
});

// Update progress
await jobHistoryService.updateProgress('bull-job-123', 75);

// Mark completed
await jobHistoryService.markCompleted('bull-job-123', {
  result: { width: 800, height: 600 },
  duration: 45000
});

// Analytics
const stats = await jobHistoryService.getJobStats();
// {
//   total: 1000,
//   completed: 950,
//   failed: 50,
//   avg_duration: 42000,
//   success_rate: 0.95
// }
```

---

## Migration from File-Based Data

### Automatic Migration Script

Run once to migrate existing data:

```bash
node database/migrate-from-files.js
```

This will:
1. Read `data/users`, `data/sessions`, `data/videos`
2. Hash passwords with bcrypt
3. Insert into PostgreSQL
4. Preserve all relationships
5. Backup old files to `data/backup/`

---

## Query Examples

### Complex Analytics

```sql
-- Top 10 users by video count
SELECT u.username, COUNT(v.id) as video_count
FROM users u
LEFT JOIN videos v ON u.id = v.user_id
GROUP BY u.id, u.username
ORDER BY video_count DESC
LIMIT 10;

-- Job success rate by type
SELECT
  type,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
  ROUND(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::numeric / COUNT(*) * 100, 2) as success_rate
FROM job_history
GROUP BY type;

-- Average processing time by day
SELECT
  DATE(created_at) as date,
  COUNT(*) as jobs,
  AVG(duration) / 1000 as avg_duration_seconds
FROM job_history
WHERE status = 'completed'
  AND created_at > CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Performance Queries

```sql
-- Find slow jobs (> 60 seconds)
SELECT
  job_id,
  type,
  duration / 1000 as duration_seconds,
  video_id,
  created_at
FROM job_history
WHERE status = 'completed'
  AND duration > 60000
ORDER BY duration DESC
LIMIT 20;

-- Users with failed jobs
SELECT
  u.username,
  COUNT(*) as failed_jobs,
  ARRAY_AGG(DISTINCT jh.error) as errors
FROM users u
JOIN videos v ON u.id = v.user_id
JOIN job_history jh ON v.video_id = jh.video_id
WHERE jh.status = 'failed'
GROUP BY u.id, u.username
HAVING COUNT(*) > 5
ORDER BY failed_jobs DESC;
```

---

## Performance Optimization

### Indexes

All critical lookups have indexes:
- `users.username`, `users.email` (UNIQUE)
- `sessions.token` (UNIQUE)
- `videos.video_id`, `videos.user_id`
- `job_history.job_id`, `job_history.status`

### Connection Pooling

```javascript
// Configured in database/db.js
max: 20,                    // 20 connections max
idleTimeoutMillis: 30000,   // Close idle after 30s
connectionTimeoutMillis: 2000
```

### Query Optimization

```javascript
// Slow query logging (> 1s)
if (duration > 1000) {
  console.warn(`⚠️ Slow query (${duration}ms):`, query);
}
```

---

## Security Features

### Password Hashing

```javascript
// bcrypt with salt rounds = 10
const password_hash = await bcrypt.hash(password, 10);

// Verification
const isValid = await bcrypt.compare(plaintext, hash);
```

### SQL Injection Prevention

```javascript
// Parameterized queries (NEVER string concatenation)
await query('SELECT * FROM users WHERE username = $1', [username]); // ✅ SAFE

// NEVER DO THIS:
await query(`SELECT * FROM users WHERE username = '${username}'`); // ❌ VULNERABLE
```

### Session Security

- Secure random tokens (32 bytes)
- Automatic expiration (7 days default)
- Token stored as unique index
- Expired sessions cleaned up

---

## Troubleshooting

### Connection Error

**Error:** `connection refused on port 5432`

**Solution:**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Start if not running
sudo systemctl start postgresql
```

### Authentication Failed

**Error:** `password authentication failed for user "postgres"`

**Solution:**
1. Edit `database/db.js` with correct credentials
2. Or set environment variables in `.env`

### Schema Not Created

**Error:** `relation "users" does not exist`

**Solution:**
```bash
# Run schema migration
psql -U postgres -d video_editor -f database/schema.sql
```

### Slow Queries

**Check:**
```sql
-- Enable query timing
\timing on

-- Find slow queries
SELECT * FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
```

---

## Testing

### Unit Tests

```bash
# Test database connection
npm test -- database.test.js

# Test user service
npm test -- userService.test.js
```

### Manual Tests

```javascript
// Test user creation
const user = await userService.createUser({
  username: 'test_user',
  email: 'test@example.com',
  password: 'password123'
});
console.log('User created:', user);

// Test login
const authenticated = await userService.verifyPassword('test_user', 'password123');
console.log('Login:', authenticated ? 'SUCCESS' : 'FAILED');

// Test session
const session = await sessionService.createSession(user.id);
console.log('Session token:', session.token);

const validated = await sessionService.validateToken(session.token);
console.log('Session valid:', validated);
```

---

## Next Steps

After PostgreSQL migration:

1. **Remove file-based DB** - Delete `src/DB.js`, `data/users`, `data/sessions`, `data/videos`
2. **Update controllers** - Use new services instead of DB.js
3. **Add API endpoints** - User registration, analytics dashboard
4. **Monitoring** - Track query performance, connection pool
5. **Backup strategy** - Regular pg_dump backups
6. **Replication** - Setup read replicas for scaling

---

## Comparison: Before vs After

| Feature | File-Based | PostgreSQL |
|---------|-----------|------------|
| **Concurrency** | ❌ Race conditions | ✅ ACID transactions |
| **Data Integrity** | ❌ None | ✅ Foreign keys, constraints |
| **Queries** | ❌ Linear scan | ✅ Indexed lookups |
| **Analytics** | ❌ Impossible | ✅ SQL aggregations |
| **Passwords** | ❌ Plain text | ✅ bcrypt hashed |
| **Sessions** | ❌ Never expire | ✅ Auto-expiring |
| **Scalability** | ❌ Single file | ✅ Millions of rows |
| **Backup** | ❌ Manual copy | ✅ pg_dump |
| **Performance** | ❌ O(n) reads | ✅ O(log n) with indexes |

---

## Summary

**What You Get:**

✅ **No More Race Conditions** - ACID transactions guarantee consistency
✅ **Data Integrity** - Foreign keys, constraints, validation
✅ **Security** - Password hashing, parameterized queries
✅ **Analytics** - Complex queries for insights
✅ **Scalability** - Handle millions of records
✅ **Performance** - Indexes make lookups fast
✅ **Professional** - Industry-standard database

**System Design Concepts:**

✅ **Relational Database Design** - Normalization, foreign keys
✅ **ACID Properties** - Atomicity, Consistency, Isolation, Durability
✅ **Connection Pooling** - Efficient resource management
✅ **Service Layer Pattern** - Separation of concerns
✅ **Security** - Hashing, parameterized queries, session management

---

This completes the PostgreSQL migration! 🎉
