# Event-Driven Architecture Guide

## What We Just Built

We transformed the JobQueue from a simple queue into an **observable event-driven system** using the Observer/Pub-Sub pattern.

## The Job Lifecycle Events

Every job now broadcasts 4 lifecycle events:

### 1. `job:queued` - Job enters the queue
```javascript
{
  jobId: "resize-abc123-1733259600000",
  type: "resize",              // or "convert"
  videoId: "abc123",
  queuePosition: 5,            // 5th in line
  queuedAt: "2025-12-03T10:00:00.000Z"
}
```

### 2. `job:started` - Processing begins
```javascript
{
  jobId: "resize-abc123-1733259600000",
  type: "resize",
  videoId: "abc123",
  startedAt: "2025-12-03T10:05:00.000Z",
  queuedAt: "2025-12-03T10:00:00.000Z"
}
```

### 3. `job:completed` - Success!
```javascript
{
  jobId: "resize-abc123-1733259600000",
  type: "resize",
  videoId: "abc123",
  result: { width: 800, height: 600 },
  queuedAt: "2025-12-03T10:00:00.000Z",
  startedAt: "2025-12-03T10:05:00.000Z",
  completedAt: "2025-12-03T10:05:45.000Z",
  duration: 45000  // milliseconds
}
```

### 4. `job:failed` - Error occurred
```javascript
{
  jobId: "resize-abc123-1733259600000",
  type: "resize",
  videoId: "abc123",
  error: "FFmpeg exited with code 1",
  stack: "Error: FFmpeg exited...",
  queuedAt: "2025-12-03T10:00:00.000Z",
  startedAt: "2025-12-03T10:05:00.000Z",
  failedAt: "2025-12-03T10:05:02.000Z"
}
```

## How to Listen to Events

The JobQueue instance in `src/cluster.js` broadcasts these events. You can listen to them:

```javascript
const jobs = new JobQueue();

// Listen to any event
jobs.on('job:queued', (data) => {
  console.log(`New job queued: ${data.jobId}`);
});

jobs.on('job:completed', (data) => {
  console.log(`Job completed in ${data.duration}ms`);
});
```

## Real-World Use Cases

### 1. **Job Analytics & Metrics**
```javascript
let metrics = {
  totalJobs: 0,
  completed: 0,
  failed: 0,
  totalDuration: 0
};

jobs.on('job:queued', () => metrics.totalJobs++);
jobs.on('job:completed', (data) => {
  metrics.completed++;
  metrics.totalDuration += data.duration;
});
jobs.on('job:failed', () => metrics.failed++);

// Calculate average processing time
const avgDuration = metrics.totalDuration / metrics.completed;
const successRate = (metrics.completed / metrics.totalJobs) * 100;
```

### 2. **Real-Time Progress to Frontend**
```javascript
const io = require('socket.io')(server);

jobs.on('job:started', (data) => {
  io.to(data.videoId).emit('processing_started', {
    jobId: data.jobId,
    type: data.type
  });
});

jobs.on('job:completed', (data) => {
  io.to(data.videoId).emit('processing_complete', {
    jobId: data.jobId,
    result: data.result,
    duration: data.duration
  });
});
```

### 3. **Job History Database**
```javascript
jobs.on('job:completed', async (data) => {
  await db.jobHistory.insert({
    jobId: data.jobId,
    videoId: data.videoId,
    type: data.type,
    duration: data.duration,
    completedAt: data.completedAt
  });
});
```

### 4. **Retry Failed Jobs**
```javascript
const MAX_RETRIES = 3;
const retryCount = new Map();

jobs.on('job:failed', (data) => {
  const attempts = retryCount.get(data.jobId) || 0;

  if (attempts < MAX_RETRIES) {
    console.log(`Retrying job ${data.jobId} (attempt ${attempts + 1})`);
    retryCount.set(data.jobId, attempts + 1);

    // Re-enqueue the job
    jobs.enqueue({
      type: data.type,
      videoId: data.videoId,
      // ... other params
    });
  } else {
    console.log(`Job ${data.jobId} failed after ${MAX_RETRIES} attempts`);
  }
});
```

### 5. **Email Notifications**
```javascript
jobs.on('job:completed', async (data) => {
  const user = await getUserByVideoId(data.videoId);
  await sendEmail(user.email, {
    subject: 'Video Processing Complete',
    body: `Your video has been processed successfully in ${data.duration / 1000}s`
  });
});
```

## Key Benefits

### 1. **Decoupling**
- JobQueue doesn't know WHO is listening
- Add new listeners without modifying JobQueue
- Each listener is independent

### 2. **Observability**
- See exactly what's happening in real-time
- Track job lifecycle from queue to completion
- Measure performance (wait time, processing time)

### 3. **Extensibility**
- Add new features by adding listeners
- No need to modify core JobQueue code
- Easy to add: logging, metrics, notifications, webhooks

### 4. **Debugging**
- Full visibility into job flow
- Capture errors with stack traces
- Track timing issues (long wait times, slow processing)

## Architecture Pattern: Observer/Pub-Sub

```
┌─────────────┐
│  JobQueue   │  (Publisher/Subject)
│             │
│ .emit()     │──┐
└─────────────┘  │
                 │ Events
                 ├──→ Logger        (Subscriber/Observer)
                 ├──→ Metrics       (Subscriber/Observer)
                 ├──→ WebSocket     (Subscriber/Observer)
                 ├──→ Database      (Subscriber/Observer)
                 └──→ Notifications (Subscriber/Observer)
```

The JobQueue doesn't care who's listening. It just broadcasts events. This is the **Observer Pattern** - one of the fundamental design patterns in software engineering.

## Next Steps

1. ✅ EventEmitter added to JobQueue
2. ✅ Event listeners added to cluster.js
3. ⏳ Test the system (resize/convert a video)
4. 🔜 Add WebSocket for real-time frontend updates
5. 🔜 Replace JobQueue with Redis Bull (industry standard)
6. 🔜 Add job retry logic with exponential backoff

## Testing Your Event System

Start your server in cluster mode:
```bash
node src/cluster.js
```

Then upload and resize a video. You'll see output like:

```
📥 [JOB QUEUED]
   Job ID: resize-abc123-1733259600000
   Type: resize
   Video: abc123
   Queue Position: 1
   Queued At: 2025-12-03T10:00:00.000Z

⚙️  [JOB STARTED]
   Job ID: resize-abc123-1733259600000
   Type: resize
   Video: abc123
   Wait Time: 0.05s

✅ [JOB COMPLETED]
   Job ID: resize-abc123-1733259600000
   Type: resize
   Video: abc123
   Result: {"width":800,"height":600}
   Duration: 45.32s
   Total Time (queued → completed): 45.37s
```

This is event-driven architecture in action! 🎉
