# Database Services API Reference

Complete service layer for PostgreSQL database operations.

---

## 📦 Services Overview

| Service | Lines | Purpose |
|---------|-------|---------|
| **userService.js** | 202 | User authentication, CRUD, statistics |
| **sessionService.js** | 136 | Session/token management |
| **videoService.js** | 309 | Video CRUD, operations tracking |
| **jobHistoryService.js** | 441 | Bull job analytics & monitoring |
| **TOTAL** | **1,088** | Complete database layer |

---

## 1. User Service (`userService.js`)

### Methods

```javascript
const userService = require('./database/services/userService');

// Create user with hashed password
await userService.createUser({
  username: 'john_doe',
  email: 'john@example.com',
  password: 'plain_password',  // Auto-hashed with bcrypt
  tier: 'pro'                   // 'free', 'pro', 'enterprise'
});

// Find user
await userService.findById(userId);
await userService.findByUsername('john_doe');
await userService.findByEmail('john@example.com');

// Verify login
const user = await userService.verifyPassword('john_doe', 'password');
// Returns user object if valid, null if invalid

// Update user
await userService.updateUser(userId, {
  email: 'newemail@example.com',
  tier: 'enterprise'
});

// Change password
await userService.changePassword(userId, 'new_password');

// Get statistics
const stats = await userService.getUserStats(userId);
// {
//   total_videos: 50,
//   total_jobs: 200,
//   completed_jobs: 195,
//   failed_jobs: 5,
//   avg_job_duration: 45000
// }

// List all users (admin)
await userService.listUsers(limit, offset);

// Delete user (cascades to videos, sessions, jobs)
await userService.deleteUser(userId);
```

---

## 2. Session Service (`sessionService.js`)

### Methods

```javascript
const sessionService = require('./database/services/sessionService');

// Create session (login)
const session = await sessionService.createSession(userId, 7); // 7 days
// { id, user_id, token, expires_at }

// Validate token
const user = await sessionService.validateToken(token);
// Returns { id, username, email, tier } or null

// Find session
const session = await sessionService.findByToken(token);

// Logout (delete session)
await sessionService.deleteSession(token);

// Logout from all devices
await sessionService.deleteAllUserSessions(userId);

// Extend session
await sessionService.extendSession(token, 7); // Add 7 more days

// Get user's active sessions
const sessions = await sessionService.getUserSessions(userId);

// Cleanup expired sessions (run periodically)
const deletedCount = await sessionService.cleanupExpiredSessions();
```

---

## 3. Video Service (`videoService.js`)

### Methods

```javascript
const videoService = require('./database/services/videoService');

// Create video
await videoService.createVideo({
  videoId: 'abc123',
  userId: 1,
  name: 'my-video.mp4',
  extension: 'mp4',
  dimensions: { width: 1920, height: 1080 },
  metadata: { codec: 'h264', bitrate: 5000 }
});

// Find video
await videoService.findByVideoId('abc123');
await videoService.findById(databaseId);

// Get user's videos
const videos = await videoService.getUserVideos(userId, {
  limit: 50,
  offset: 0,
  orderBy: 'created_at',
  order: 'DESC'
});

// Update video
await videoService.updateVideo('abc123', {
  name: 'new-name.mp4',
  metadata: { codec: 'hevc' }
});

// Delete video (cascades to operations)
await videoService.deleteVideo('abc123');

// Add operation (resize, convert, extract_audio)
await videoService.addOperation('abc123', {
  type: 'resize',
  status: 'pending',
  parameters: { width: 800, height: 600 }
});

// Update operation status
await videoService.updateOperationStatus(operationId, 'completed', '/path/to/result.mp4');
await videoService.updateOperationStatus(operationId, 'failed', null, 'FFmpeg error');

// Get video operations
const operations = await videoService.getVideoOperations('abc123');

// Get pending operations (for processing)
const pending = await videoService.getPendingOperations(100);

// Find specific operation
const operation = await videoService.findOperation('abc123', 'resize', {
  width: 800,
  height: 600
});

// Get video statistics
const stats = await videoService.getVideoStats('abc123');
// {
//   total_operations: 10,
//   completed_operations: 8,
//   failed_operations: 1,
//   processing_operations: 1,
//   pending_operations: 0
// }

// Search videos
await videoService.searchVideos(userId, 'vacation', 20);

// Get video count
const count = await videoService.getUserVideoCount(userId);

// Get videos with pending operations
await videoService.getVideosWithPendingOperations(userId);
```

---

## 4. Job History Service (`jobHistoryService.js`)

### Methods

```javascript
const jobHistoryService = require('./database/services/jobHistoryService');

// Create job record
await jobHistoryService.createJob({
  jobId: 'bull-job-123',
  videoId: 'abc123',
  userId: 1,
  type: 'resize',
  status: 'queued',
  priority: 'high',
  data: { width: 800, height: 600 }
});

// Update status
await jobHistoryService.updateStatus('bull-job-123', 'active');
await jobHistoryService.markStarted('bull-job-123');

// Update progress
await jobHistoryService.updateProgress('bull-job-123', 25);
await jobHistoryService.updateProgress('bull-job-123', 75);

// Mark completed
await jobHistoryService.markCompleted('bull-job-123', {
  width: 800,
  height: 600
});

// Mark failed
await jobHistoryService.markFailed('bull-job-123', 'FFmpeg error', stackTrace);

// Find job
const job = await jobHistoryService.findByJobId('bull-job-123');

// Get video jobs
const videoJobs = await jobHistoryService.getVideoJobs('abc123');

// Get user jobs
const userJobs = await jobHistoryService.getUserJobs(userId, {
  limit: 50,
  offset: 0,
  status: 'completed', // optional filter
  type: 'resize'       // optional filter
});

// Get overall statistics
const stats = await jobHistoryService.getJobStats();
// {
//   total: 1000,
//   completed: 950,
//   failed: 50,
//   active: 5,
//   queued: 10,
//   avg_duration: 42000,
//   min_duration: 5000,
//   max_duration: 120000,
//   success_rate: 95.00
// }

// Get stats with filters
const userStats = await jobHistoryService.getJobStats({
  userId: 1,
  startDate: '2025-11-01',
  endDate: '2025-12-01'
});

// Get stats by job type
const typeStats = await jobHistoryService.getStatsByType({
  userId: 1,
  startDate: '2025-11-01'
});
// [
//   { type: 'resize', total: 500, completed: 490, ... },
//   { type: 'convert', total: 300, completed: 285, ... }
// ]

// Get recent failed jobs
const failures = await jobHistoryService.getRecentFailedJobs(20);

// Get slow jobs (> 60 seconds)
const slowJobs = await jobHistoryService.getSlowJobs(60000, 20);

// Get job timeline (daily stats)
const timeline = await jobHistoryService.getJobTimeline(30, userId);
// [
//   { date: '2025-12-04', total: 50, completed: 48, failed: 2, avg_duration: 45000 },
//   { date: '2025-12-03', total: 45, completed: 43, failed: 2, avg_duration: 42000 },
//   ...
// ]

// Get active jobs count
const activeCount = await jobHistoryService.getActiveJobsCount();

// Cleanup old jobs (> 30 days)
const deletedCount = await jobHistoryService.cleanupOldJobs(30);
```

---

## Integration Example

### Complete workflow:

```javascript
const userService = require('./database/services/userService');
const sessionService = require('./database/services/sessionService');
const videoService = require('./database/services/videoService');
const jobHistoryService = require('./database/services/jobHistoryService');

// 1. User registration
const user = await userService.createUser({
  username: 'john_doe',
  email: 'john@example.com',
  password: 'secure_password'
});

// 2. Login
const authenticatedUser = await userService.verifyPassword('john_doe', 'secure_password');
const session = await sessionService.createSession(authenticatedUser.id);
// Send session.token to client as cookie

// 3. Upload video
const video = await videoService.createVideo({
  videoId: 'abc123',
  userId: authenticatedUser.id,
  name: 'vacation.mp4',
  extension: 'mp4',
  dimensions: { width: 1920, height: 1080 }
});

// 4. Add resize operation
const operation = await videoService.addOperation('abc123', {
  type: 'resize',
  status: 'pending',
  parameters: { width: 800, height: 600 }
});

// 5. Create job in Bull queue
const job = await jobHistoryService.createJob({
  jobId: 'bull-123',
  videoId: 'abc123',
  userId: authenticatedUser.id,
  type: 'resize',
  data: { width: 800, height: 600 }
});

// 6. Job starts processing
await jobHistoryService.markStarted('bull-123');
await videoService.updateOperationStatus(operation.id, 'processing');

// 7. Update progress
await jobHistoryService.updateProgress('bull-123', 25);
await jobHistoryService.updateProgress('bull-123', 75);

// 8. Job completes
await jobHistoryService.markCompleted('bull-123', {
  width: 800,
  height: 600
});
await videoService.updateOperationStatus(operation.id, 'completed', '/path/to/800x600.mp4');

// 9. Get user statistics
const stats = await userService.getUserStats(authenticatedUser.id);
console.log(`User has ${stats.total_videos} videos, ${stats.completed_jobs} completed jobs`);

// 10. Logout
await sessionService.deleteSession(session.token);
```

---

## Error Handling

All service methods throw errors that should be caught:

```javascript
try {
  const user = await userService.createUser({
    username: 'duplicate',
    email: 'test@example.com',
    password: 'password'
  });
} catch (error) {
  if (error.code === '23505') {
    // Unique constraint violation
    console.error('Username or email already exists');
  } else {
    console.error('Database error:', error.message);
  }
}
```

---

## Transaction Example

For operations that need atomicity:

```javascript
const { transaction } = require('./database/db');

await transaction(async (client) => {
  // Create user
  const userResult = await client.query(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['john', 'john@example.com', hashedPassword]
  );

  const userId = userResult.rows[0].id;

  // Create initial video
  await client.query(
    'INSERT INTO videos (video_id, user_id, name, extension) VALUES ($1, $2, $3, $4)',
    ['welcome-123', userId, 'welcome.mp4', 'mp4']
  );

  // If any query fails, both are rolled back
});
```

---

## Security Notes

### Password Security
- Passwords are hashed with bcrypt (10 salt rounds)
- Never store plain text passwords
- Use `verifyPassword()` for authentication

### SQL Injection Prevention
- All queries use parameterized statements ($1, $2, etc.)
- Never concatenate user input into SQL strings

### Session Security
- Tokens are 32-byte secure random strings
- Sessions expire after 7 days by default
- Run `cleanupExpiredSessions()` periodically

---

## Performance Tips

### Use Indexes
All critical fields are indexed:
- `users.username`, `users.email`
- `sessions.token`
- `videos.video_id`, `videos.user_id`
- `job_history.job_id`, `job_history.status`

### Connection Pooling
- Max 20 connections configured
- Idle connections closed after 30s
- Use for all queries (already configured in services)

### Pagination
Always use `limit` and `offset` for large result sets:
```javascript
await videoService.getUserVideos(userId, { limit: 50, offset: 0 });
```

### Cleanup
Run periodic cleanup to prevent database bloat:
```javascript
// Daily cron job
await sessionService.cleanupExpiredSessions();
await jobHistoryService.cleanupOldJobs(30);
```

---

## Testing

```javascript
// Test user service
const user = await userService.createUser({
  username: 'test_user',
  email: 'test@example.com',
  password: 'password123'
});
console.assert(user.id, 'User should have ID');

// Test authentication
const authenticated = await userService.verifyPassword('test_user', 'password123');
console.assert(authenticated, 'Should authenticate');

// Test session
const session = await sessionService.createSession(user.id);
console.assert(session.token, 'Session should have token');

// Cleanup
await userService.deleteUser(user.id);
```

---

## Summary

✅ **Complete database service layer** (1,088 lines)
✅ **4 services covering all operations**
✅ **CRUD operations for all entities**
✅ **Analytics & statistics methods**
✅ **Security best practices**
✅ **Performance optimizations**
✅ **Error handling**
✅ **Transaction support**

**Ready to integrate with controllers!** 🚀
