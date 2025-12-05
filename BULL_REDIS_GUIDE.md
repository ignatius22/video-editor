# Bull & Redis Integration Guide

## 🎯 Overview

This document explains the migration from a simple in-memory job queue to a production-grade **Bull queue** backed by **Redis**, transforming the video processing system into a truly distributed, scalable architecture.

---

## Table of Contents

- [What Changed](#what-changed)
- [Architecture Comparison](#architecture-comparison)
- [Key Features](#key-features)
- [How It Works](#how-it-works)
- [Configuration](#configuration)
- [Bull Dashboard](#bull-dashboard)
- [Progress Tracking](#progress-tracking)
- [Job Prioritization](#job-prioritization)
- [API Reference](#api-reference)
- [Distributed System Concepts](#distributed-system-concepts)

---

## What Changed

### BEFORE: Simple Array-Based Queue (JobQueue.js)

```javascript
class JobQueue {
  constructor() {
    this.jobs = [];           // ❌ In-memory array
    this.currentJob = null;   // ❌ Only 1 job at a time
  }

  enqueue(job) {
    this.jobs.push(job);      // ❌ Lost on restart
    this.executeNext();
  }

  executeNext() {
    if (this.currentJob) return;  // ❌ Sequential processing
    this.currentJob = this.dequeue();
    this.execute(this.currentJob);
  }
}
```

**Limitations:**
- ❌ Sequential processing (1 job at a time)
- ❌ No persistence (jobs lost on restart)
- ❌ No distributed workers (single server only)
- ❌ No prioritization
- ❌ No progress tracking
- ❌ No visual monitoring

### AFTER: Bull + Redis (BullQueue.js)

```javascript
const Bull = require('bull');

class BullQueue extends EventEmitter {
  constructor() {
    super();
    this.queue = new Bull('video-processing', {
      redis: { host: 'localhost', port: 6379 }
    });

    this.CONCURRENCY = 5;  // ✅ 5 jobs in parallel

    // Parallel processing
    this.queue.process('resize', this.CONCURRENCY, async (job) => {
      await job.progress(25);  // ✅ Progress tracking
      await processVideo(job);
      await job.progress(100);
    });
  }
}
```

**Benefits:**
- ✅ **Parallel processing** (5 concurrent jobs)
- ✅ **Persistence** (Redis stores jobs)
- ✅ **Distributed workers** (multiple servers)
- ✅ **Prioritization** (high/normal/low)
- ✅ **Progress tracking** (0-100%)
- ✅ **Visual dashboard** (Bull Board)
- ✅ **Automatic retries** (built-in)
- ✅ **Job cleanup** (auto-delete old jobs)

---

## Architecture Comparison

### Simple Queue Architecture

```
┌─────────────────────────────────────┐
│  Primary Process                     │
│                                      │
│  jobs = [job1, job2, job3, job4]    │
│  currentJob = job1                   │
│                                      │
│  ❌ Only job1 processing             │
│  ❌ job2, job3, job4 waiting          │
│  ❌ Lost on restart                   │
└─────────────────────────────────────┘
```

### Bull + Redis Architecture

```
┌──────────────────────────────────────────────────────────┐
│                         REDIS                             │
│                   (Message Broker)                        │
│                                                           │
│  Queue: video-processing                                  │
│  ├─ Waiting:  [job5, job6, job7, job8]                   │
│  ├─ Active:   [job1, job2, job3, job4, job5]  (5 workers)│
│  ├─ Completed: [job-100, job-99, ...]  (last 100)        │
│  └─ Failed:    [job-50, job-49, ...]   (last 200)        │
│                                                           │
└─────────────────────┬────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┬─────────────┐
        │             │             │             │
   ┌────▼────┐   ┌───▼─────┐  ┌───▼─────┐  ┌───▼─────┐
   │ Worker 1│   │Worker 2 │  │Worker 3 │  │Worker 4 │
   │         │   │         │  │         │  │         │
   │ job1    │   │ job2    │  │ job3    │  │ job4    │
   │ resize  │   │ convert │  │ resize  │  │ convert │
   └─────────┘   └─────────┘  └─────────┘  └─────────┘

✅ Parallel processing
✅ Jobs persist in Redis
✅ Can add more servers/workers
✅ Auto-recovery on failure
```

---

## Key Features

### 1. Parallel Processing (Concurrency = 5)

**Configuration:** `lib/BullQueue.js:35`
```javascript
this.CONCURRENCY = 5; // Process up to 5 jobs simultaneously
```

**How it works:**
- Old system: Process job1, wait for it to finish, then job2
- New system: Process job1, job2, job3, job4, job5 **all at the same time**

**Example:**
```
Time 0s:  Start job1, job2, job3, job4, job5 (all 5 slots filled)
Time 10s: job2 finishes → Start job6 (fill empty slot)
Time 15s: job1 finishes → Start job7 (fill empty slot)
Time 20s: job4 finishes → Start job8 (fill empty slot)
```

**Performance Impact:**
- Old: 5 videos × 45s each = **225 seconds total**
- New: 5 videos in parallel = **45 seconds total** (5x faster!)

### 2. Job Persistence

**Where jobs are stored:** Redis database on disk

**What survives restart:**
- ✅ Waiting jobs (not yet started)
- ✅ Active jobs (currently processing) → moved back to waiting
- ✅ Completed jobs (last 100)
- ✅ Failed jobs (last 200)

**Example:**
```
1. User uploads 10 videos for processing
2. Server is processing videos 1-5
3. Server crashes 💥
4. Restart server
5. Videos 1-5 restart from beginning
6. Videos 6-10 still in queue
7. No jobs lost!
```

### 3. Distributed Workers

**Single Server (Current):**
```
Server A:
  ├─ Worker 1 (resize job)
  ├─ Worker 2 (convert job)
  ├─ Worker 3 (resize job)
  ├─ Worker 4 (resize job)
  └─ Worker 5 (convert job)
```

**Multiple Servers (Possible with Bull):**
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Server A   │  │  Server B   │  │  Server C   │
│  (5 workers)│  │  (5 workers)│  │  (5 workers)│
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
                   ┌────▼────┐
                   │  Redis  │
                   │  Queue  │
                   └─────────┘

Total: 15 jobs processing simultaneously!
```

To add more servers, just run the same app on another machine pointing to the same Redis instance.

### 4. Job Prioritization

**Priority Levels:**
- **High** (1): VIP users, urgent jobs
- **Normal** (5): Default priority
- **Low** (10): Background tasks, cleanup

**Usage:**
```javascript
// High priority (processed first)
await jobs.enqueue({
  type: 'resize',
  videoId: 'abc123',
  width: 1920,
  height: 1080,
  priority: 'high'
});

// Normal priority
await jobs.enqueue({
  type: 'resize',
  videoId: 'def456',
  width: 800,
  height: 600
  // priority defaults to 'normal'
});

// Low priority (processed last)
await jobs.enqueue({
  type: 'convert',
  videoId: 'ghi789',
  targetFormat: 'webm',
  priority: 'low'
});
```

**Queue Processing Order:**
```
Queue: [high-1, high-2, normal-1, normal-2, low-1, low-2]
       ↑        ↑
       Processed first

Result: high-1 → high-2 → normal-1 → normal-2 → low-1 → low-2
```

### 5. Progress Tracking (0-100%)

**Implementation:** `lib/BullQueue.js:195-235`

**Resize Job Progress:**
```javascript
async processResize(bullJob) {
  await bullJob.progress(10);  // 10%  - Starting
  await bullJob.progress(25);  // 25%  - FFmpeg initialized
  await FF.resize(...);         // Processing...
  await bullJob.progress(75);  // 75%  - FFmpeg complete
  // Update database
  await bullJob.progress(100); // 100% - Done!
}
```

**Progress Events Emitted:**
```
📊 [JOB PROGRESS] 10%
📊 [JOB PROGRESS] 25%
📊 [JOB PROGRESS] 75%
📊 [JOB PROGRESS] 100%
```

**WebSocket Updates:**
Clients receive real-time progress:
```javascript
socket.on('job:progress', (data) => {
  console.log(`${data.videoId}: ${data.progress}%`);
  // Update UI progress bar
});
```

### 6. Automatic Job Cleanup

**Configuration:** `lib/BullQueue.js:19-21`
```javascript
defaultJobOptions: {
  removeOnComplete: 100,  // Keep last 100 completed jobs
  removeOnFail: 200       // Keep last 200 failed jobs
}
```

**Why this matters:**
- Without cleanup: Redis grows indefinitely → disk full
- With cleanup: Only recent jobs kept for debugging

**Manual cleanup:**
```javascript
// Clean jobs older than 24 hours
await jobs.cleanOldJobs(86400000);
```

---

## How It Works

### Job Lifecycle

```
1. ENQUEUE
   User requests video resize
   ↓
   jobs.enqueue({ type: 'resize', ... })
   ↓
   Bull adds to Redis queue
   ↓
   Emit: job:queued

2. WAITING
   Job sits in Redis queue
   Waiting for available worker slot

3. ACTIVE
   Worker picks up job
   ↓
   Emit: job:started
   ↓
   Process video with progress updates
   ↓
   Emit: job:progress (10%, 25%, 75%, 100%)

4. COMPLETED
   ↓
   Emit: job:completed
   ↓
   Keep in Redis for 100 jobs, then delete

OR

4. FAILED
   ↓
   Emit: job:failed
   ↓
   Retry logic in cluster.js (exponential backoff)
   ↓
   If max retries exceeded:
   Emit: job:permanent-failure
```

### Event Flow with WebSocket

```
┌─────────────────┐
│  BullQueue      │
│  (Primary)      │
└────────┬────────┘
         │
         ├─ job:queued ────────┐
         ├─ job:started ────────┼─→ broadcastToWorkers()
         ├─ job:progress ───────┤      (IPC)
         ├─ job:completed ──────┤         │
         └─ job:failed ─────────┘         │
                                          │
              ┌───────────────────────────┘
              │
        ┌─────▼─────┐
        │  Worker 1  │
        │  Worker 2  │ → Socket.IO → Clients
        │  Worker 3  │
        └────────────┘
```

---

## Configuration

### Redis Connection

**File:** `lib/BullQueue.js:13-16`
```javascript
this.queue = new Bull('video-processing', {
  redis: {
    host: 'localhost',  // Change for remote Redis
    port: 6379          // Default Redis port
  }
});
```

**Production Redis:**
```javascript
redis: {
  host: 'redis.example.com',
  port: 6379,
  password: 'your-redis-password',
  tls: {} // Enable TLS for secure connection
}
```

**Redis Cloud/ElastiCache:**
```javascript
redis: 'redis://:password@your-redis-url:6379'
```

### Concurrency

**File:** `lib/BullQueue.js:35`
```javascript
this.CONCURRENCY = 5; // Adjust based on CPU cores
```

**Guidelines:**
- **Low-end server** (2 cores): `CONCURRENCY = 2`
- **Medium server** (4 cores): `CONCURRENCY = 4`
- **High-end server** (8+ cores): `CONCURRENCY = 8`
- **CPU-intensive tasks**: Set to number of CPU cores
- **I/O-intensive tasks**: Can be 2-3× CPU cores

---

## Bull Dashboard

### Accessing the Dashboard

**URL:** `http://localhost:8060/admin/queues`

**Setup:** `src/bullBoard.js`

### Dashboard Features

**1. Queue Overview**
```
┌──────────────────────────────────────┐
│  video-processing                    │
│                                      │
│  Waiting:    12 jobs                 │
│  Active:     5 jobs                  │
│  Completed:  1,234 jobs              │
│  Failed:     23 jobs                 │
│  Paused:     No                      │
└──────────────────────────────────────┘
```

**2. Job Details**
- Click any job to see:
  - Job ID
  - Data payload (videoId, width, height, etc.)
  - Progress (0-100%)
  - Start/end timestamps
  - Error stack trace (if failed)
  - Retry attempts

**3. Actions**
- **Retry Failed Jobs**: Manually retry failed jobs
- **Clean Queue**: Remove old completed/failed jobs
- **Pause Queue**: Stop processing new jobs
- **Resume Queue**: Resume processing
- **Remove Job**: Delete specific job

### Screenshots

**Queue Overview:**
Shows all jobs in different states with counts and timestamps.

**Job Details:**
Click a job to see full details, including progress, timestamps, and error logs.

---

## Progress Tracking

### Client-Side Progress Bar

**Example: React Component**
```javascript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

function VideoProgress({ videoId }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const socket = io('http://localhost:8060');

    socket.emit('subscribe-video', videoId);

    socket.on('job:progress', (data) => {
      if (data.videoId === videoId) {
        setProgress(data.progress);
      }
    });

    return () => socket.disconnect();
  }, [videoId]);

  return (
    <div>
      <h3>Processing: {progress}%</h3>
      <progress value={progress} max="100" />
    </div>
  );
}
```

### Progress Milestones

**Resize Job:**
```
10%  → Starting FFmpeg
25%  → FFmpeg initialized
75%  → Video processing complete
100% → Database updated, done
```

**Convert Job:**
```
10%  → Starting conversion
25%  → Codec selection complete
75%  → Conversion finished
100% → Database updated, done
```

---

## Job Prioritization

### Use Cases

**High Priority:**
- Paid/VIP users
- Small videos (quick to process)
- Admin actions
- Live streaming preparation

**Normal Priority:**
- Free users
- Standard videos
- Bulk uploads

**Low Priority:**
- Batch processing
- Background jobs
- Re-encoding old videos
- Cleanup tasks

### Implementation Example

**Controller:** `src/controllers/video.js`
```javascript
async resizeVideo(req, res) {
  const { videoId, width, height } = req.body;
  const user = req.user;

  // Determine priority based on user tier
  const priority = user.tier === 'pro' ? 'high' : 'normal';

  if (cluster.isPrimary) {
    jobs.enqueue({
      type: 'resize',
      videoId,
      width,
      height,
      priority  // ✅ Priority included
    });
  } else {
    process.send({
      messageType: 'new-resize',
      data: { videoId, width, height, priority }
    });
  }

  res.json({ message: 'Video resize queued', priority });
}
```

---

## API Reference

### BullQueue Methods

#### `enqueue(job)`
Add a job to the queue.

```javascript
const jobId = await jobs.enqueue({
  type: 'resize',
  videoId: 'abc123',
  width: 1920,
  height: 1080,
  priority: 'high'  // optional
});
```

**Returns:** Job ID (string)

#### `getQueueStats()`
Get queue statistics.

```javascript
const stats = await jobs.getQueueStats();
// { waiting: 12, active: 5, completed: 1234, failed: 23, delayed: 0 }
```

#### `getJob(jobId)`
Get job details by ID.

```javascript
const job = await jobs.getJob('12345');
console.log(job.data);    // Job payload
console.log(job.progress()); // Current progress
```

#### `removeJob(jobId)`
Remove a job from the queue.

```javascript
await jobs.removeJob('12345');
```

#### `pauseQueue()`
Pause job processing.

```javascript
await jobs.pauseQueue();
// No new jobs will be processed until resumed
```

#### `resumeQueue()`
Resume job processing.

```javascript
await jobs.resumeQueue();
```

#### `cleanOldJobs(grace)`
Clean jobs older than grace period (milliseconds).

```javascript
await jobs.cleanOldJobs(86400000); // 24 hours
```

---

## Distributed System Concepts

### 1. Message Queue Pattern

**Definition:** A message broker (Redis) that decouples producers from consumers.

**In Our System:**
- **Producer:** API controllers (add jobs to queue)
- **Broker:** Redis (stores jobs)
- **Consumer:** Workers (process jobs)

**Benefits:**
- Producers don't wait for processing
- Consumers can scale independently
- Jobs survive system failures

### 2. Horizontal Scaling

**Definition:** Add more machines to handle increased load.

**How to Scale:**
```bash
# Server A
npm run cluster

# Server B (same code, same Redis)
npm run cluster

# Server C (same code, same Redis)
npm run cluster
```

**Result:**
- 3 servers × 5 workers = **15 concurrent jobs**
- All pulling from the same Redis queue
- Automatic load distribution

### 3. Persistence & Durability

**Redis Persistence:**
- **RDB (Snapshots):** Save database at intervals
- **AOF (Append-Only File):** Log every write operation

**Our Setup:**
Redis default settings (RDB snapshots every 15 minutes)

**Production Recommendation:**
Enable AOF for maximum durability:
```bash
# redis.conf
appendonly yes
appendfsync everysec
```

### 4. At-Least-Once Delivery

**Guarantee:** Every job will be processed at least once.

**How Bull Ensures This:**
1. Job added to Redis (persisted)
2. Worker picks up job (marked as active)
3. If worker crashes → job goes back to waiting
4. Another worker picks it up
5. Job completes → removed from queue

**Trade-off:** Same job might be processed twice (if worker crashes after completion but before acknowledgment).

**Mitigation:** Make processing **idempotent** (safe to run multiple times).

### 5. Concurrency Control

**Problem:** Too many jobs → server overload

**Solution:** Limit concurrency
```javascript
this.CONCURRENCY = 5; // Max 5 jobs at once
```

**How It Works:**
- Bull maintains a pool of 5 worker slots
- When a job finishes, the slot becomes available
- Next job in queue fills the empty slot
- Never exceeds the concurrency limit

---

## Testing

### Start Redis
```bash
redis-server --daemonize yes
```

### Start Application
```bash
npm run cluster
```

### Access Bull Dashboard
```
http://localhost:8060/admin/queues
```

### Access WebSocket Demo
```
http://localhost:8060/websocket-demo.html
```

### Trigger Jobs
1. Upload a video
2. Resize to 800x600
3. Watch in real-time:
   - Bull Dashboard: See job move from waiting → active → completed
   - WebSocket Demo: See progress updates (10%, 25%, 75%, 100%)
   - Server Logs: See detailed console output

### Test Scenarios

**1. Parallel Processing**
- Upload 10 videos
- Resize all to different sizes
- Observe 5 processing simultaneously in Bull Dashboard

**2. Progress Tracking**
- Resize a video
- Watch WebSocket Demo for progress events
- See progress bar fill from 0% to 100%

**3. Job Prioritization**
- Queue 5 low-priority jobs
- Queue 1 high-priority job
- Observe high-priority job processed first

**4. Persistence**
- Queue 10 jobs
- Restart server (Ctrl+C, then `npm run cluster`)
- Observe jobs resume from where they left off

**5. Failure & Retry**
- Simulate FFmpeg error (modify code temporarily)
- Watch retry logic with exponential backoff
- See permanent failure after 3 retries

---

## Troubleshooting

### Redis Connection Error

**Error:** `Could not connect to Redis at 127.0.0.1:6379`

**Solution:**
```bash
# Check if Redis is running
redis-cli ping

# If not running, start it
redis-server --daemonize yes
```

### Jobs Not Processing

**Check:**
1. Redis is running: `redis-cli ping`
2. Workers are started: Look for "Worker ready" in logs
3. Queue is not paused: Check Bull Dashboard

### High Memory Usage

**Cause:** Too many completed/failed jobs in Redis

**Solution:**
```javascript
// Clean old jobs
await jobs.cleanOldJobs(86400000); // 24 hours
```

Or reduce retention:
```javascript
removeOnComplete: 50,  // Keep last 50 (was 100)
removeOnFail: 100      // Keep last 100 (was 200)
```

---

## Production Checklist

- [ ] Redis persistence enabled (AOF)
- [ ] Redis password set
- [ ] Concurrency tuned for server capacity
- [ ] Job cleanup scheduled (daily cron job)
- [ ] Bull Dashboard behind authentication
- [ ] Monitoring: Track queue size, processing time
- [ ] Alerts: Queue growing too large, high failure rate
- [ ] Backup: Redis data backed up regularly

---

## Summary

**What You Achieved:**

✅ **Distributed Job Queue:** Bull + Redis replaces simple array
✅ **Parallel Processing:** 5 jobs concurrently (was 1)
✅ **Persistence:** Jobs survive restarts
✅ **Scalability:** Add more servers easily
✅ **Progress Tracking:** Real-time 0-100% updates
✅ **Prioritization:** High/normal/low priority jobs
✅ **Visual Dashboard:** Bull Board for monitoring
✅ **Event-Driven:** All existing events preserved

**System Design Concepts Mastered:**

✅ Message Queue Pattern
✅ Horizontal Scaling
✅ Persistence & Durability
✅ At-Least-Once Delivery
✅ Concurrency Control
✅ Distributed Systems Architecture

---

**Congratulations!** You now have a production-grade distributed job processing system! 🎉
