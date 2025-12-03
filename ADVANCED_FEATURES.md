# Advanced Features: Retry Logic & Real-Time WebSocket Updates

This document covers the advanced event-driven features added to the video processing system.

## Table of Contents
- [Retry Logic with Exponential Backoff](#retry-logic-with-exponential-backoff)
- [Real-Time WebSocket Updates](#real-time-websocket-updates)
- [Architecture Overview](#architecture-overview)
- [Usage Examples](#usage-examples)

---

## Retry Logic with Exponential Backoff

### Overview
Failed jobs are automatically retried up to 3 times with exponentially increasing delays between attempts.

### Configuration
```javascript
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 2000; // 2 seconds

// Retry delays:
// Attempt 1: 2s
// Attempt 2: 4s
// Attempt 3: 8s
```

### How It Works

**1. Job Fails for the First Time**
```
❌ [JOB FAILED]
   Job ID: resize-abc123-1733259600000
   Type: resize
   Video: abc123
   Error: FFmpeg exited with code 1
   Attempt: 1/4
   🔄 Retrying in 2s... (Attempt 2/4)
```

**2. Retry After 2 Seconds**
```
🔄 [RETRY ATTEMPT 2]
   Video: abc123
   Type: resize

📥 [JOB QUEUED]  (Re-enqueued with same parameters)
```

**3. If It Fails Again**
- Wait 4 seconds (2^1 × 2s)
- Retry again (Attempt 3/4)

**4. If It Fails Again**
- Wait 8 seconds (2^2 × 2s)
- Final retry (Attempt 4/4)

**5. After All Retries Exhausted**
```
⛔ [PERMANENT FAILURE]
   Job ID: resize-abc123-1733259600000
   Type: resize
   Video: abc123
   Total Attempts: 4
   Final Error: FFmpeg exited with code 1
   This job will not be retried.
```

### Success After Retry
```
✅ [JOB COMPLETED] (Succeeded after 2 retry/retries)
   Job ID: resize-abc123-1733259600000
   Type: resize
   Video: abc123
   Result: {"width":800,"height":600}
   Duration: 45.32s
```

### Implementation Details

**Retry Tracking** (cluster.js:10)
```javascript
const retryTracker = new Map(); // videoId -> { attempts }
```

**Exponential Backoff Calculation** (cluster.js:56)
```javascript
const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, currentAttempt);
// Attempt 0: 2000ms (2s)
// Attempt 1: 4000ms (4s)
// Attempt 2: 8000ms (8s)
```

**Re-enqueue Logic** (cluster.js:67-83)
```javascript
setTimeout(() => {
  if (data.type === 'resize') {
    jobs.enqueue({
      type: 'resize',
      videoId: data.videoId,
      width: data.width,
      height: data.height
    });
  } else if (data.type === 'convert') {
    jobs.enqueue({
      type: 'convert',
      videoId: data.videoId,
      targetFormat: data.targetFormat,
      originalPath: data.originalPath,
      convertedPath: data.convertedPath
    });
  }
}, backoffMs);
```

### Benefits
- **Resilience**: Transient errors (network issues, temporary resource unavailability) don't cause permanent failures
- **Exponential backoff**: Prevents overwhelming the system during outages
- **Observability**: Full logging of retry attempts
- **Automatic cleanup**: Retry tracker cleaned up on success or permanent failure

---

## Real-Time WebSocket Updates

### Overview
All job lifecycle events are broadcast in real-time to connected clients via WebSocket, enabling live progress monitoring without polling.

### Architecture: Distributed WebSocket

```
┌─────────────────────┐
│  Primary Process    │
│  (JobQueue)         │
│                     │
│  ┌───────────────┐  │
│  │ EventEmitter  │  │
│  │ .emit()       │  │
│  └───────┬───────┘  │
│          │          │
│          ├──IPC─────┼──→ Worker 1 → Socket.IO → Client 1, 2, 3
│          ├──IPC─────┼──→ Worker 2 → Socket.IO → Client 4, 5
│          └──IPC─────┼──→ Worker 3 → Socket.IO → Client 6, 7
│                     │
└─────────────────────┘
```

**Key Insight**: JobQueue runs in the PRIMARY process, but WebSocket clients connect to WORKER processes. We use IPC (Inter-Process Communication) to broadcast events from primary to all workers.

### Implementation

**1. Primary Process Broadcasts to Workers** (cluster.js:12-21)
```javascript
const broadcastToWorkers = (event, data) => {
  Object.values(cluster.workers).forEach(worker => {
    worker.send({
      type: 'job-event',
      event,
      data
    });
  });
};

jobs.on('job:queued', (data) => {
  broadcastToWorkers('job:queued', data);
  // ... logging
});
```

**2. Workers Receive IPC Messages & Emit via WebSocket** (index.js:74-88)
```javascript
if (cluster.isWorker) {
  process.on('message', (message) => {
    if (message.type === 'job-event') {
      const { event, data } = message;

      // Broadcast to all connected clients
      io.emit(event, data);

      // Also broadcast to video-specific room
      if (data.videoId) {
        io.to(`video:${data.videoId}`).emit(event, data);
      }
    }
  });
}
```

**3. Clients Connect and Listen** (websocket-demo.html)
```javascript
const socket = io();

socket.on('job:queued', (data) => {
  console.log('Job Queued:', data);
});

socket.on('job:completed', (data) => {
  console.log('Job Completed:', data);
});
```

### Events Broadcast via WebSocket

| Event | Data | When Fired |
|-------|------|------------|
| `job:queued` | `{ jobId, type, videoId, queuePosition, queuedAt }` | Job enters queue |
| `job:started` | `{ jobId, type, videoId, startedAt, queuedAt }` | Processing begins |
| `job:completed` | `{ jobId, type, videoId, result, duration, completedAt }` | Job succeeds |
| `job:failed` | `{ jobId, type, videoId, error, currentAttempt, maxRetries }` | Job fails (will retry) |
| `job:permanent-failure` | `{ jobId, type, videoId, totalAttempts, error }` | All retries exhausted |

### Features

**1. Global Broadcast**
All clients receive all job events:
```javascript
io.emit('job:completed', data);
```

**2. Video-Specific Rooms**
Clients can subscribe to updates for specific videos only:
```javascript
// Client subscribes
socket.emit('subscribe-video', 'abc123');

// Server broadcasts to room
io.to('video:abc123').emit('job:completed', data);
```

**3. Connection Handling** (index.js:54-71)
```javascript
io.on('connection', (socket) => {
  console.log(`[WebSocket] Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[WebSocket] Client disconnected: ${socket.id}`);
  });

  socket.on('subscribe-video', (videoId) => {
    socket.join(`video:${videoId}`);
  });

  socket.on('unsubscribe-video', (videoId) => {
    socket.leave(`video:${videoId}`);
  });
});
```

### Testing the WebSocket

**1. Start the Server in Cluster Mode**
```bash
npm run cluster
```

**2. Open the Demo Page**
Navigate to: `http://localhost:8060/websocket-demo.html`

**3. Trigger a Job**
- Upload a video
- Resize it or convert format
- Watch real-time updates appear on the demo page!

**4. What You'll See**
```
📥 QUEUED          (Blue) - Job enters queue
⚙️  STARTED         (Yellow) - Processing begins
✅ COMPLETED       (Green) - Job succeeds
❌ FAILED          (Red) - Job fails (will retry)
⛔ PERMANENT FAILURE (Pink) - All retries exhausted
```

### Benefits

**1. No Polling Required**
- Traditional: Client polls `/api/jobs` every 2 seconds
- WebSocket: Server pushes updates instantly

**2. Real-Time UX**
- Users see progress updates immediately
- Show processing status without page refresh
- Display retry attempts to keep users informed

**3. Scalability**
- Works across all cluster workers
- Clients can connect to any worker
- All workers broadcast the same events

**4. Selective Updates**
- Subscribe to specific video updates
- Don't receive irrelevant notifications
- Efficient bandwidth usage

---

## Architecture Overview

### Distributed Event-Driven System

```
┌──────────────────────────────────────────────────────────┐
│                     PRIMARY PROCESS                       │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              JobQueue (EventEmitter)                 │ │
│  │                                                       │ │
│  │  1. Job processing                                   │ │
│  │  2. Emit events (queued/started/completed/failed)   │ │
│  │  3. Retry logic with exponential backoff            │ │
│  └───────────────────────┬─────────────────────────────┘ │
│                          │                                │
│                          ├─── Event Listeners            │
│                          │    (Logging)                  │
│                          │                                │
│                          └─── broadcastToWorkers()       │
│                               │                           │
│                               ├─IPC→ Worker 1            │
│                               ├─IPC→ Worker 2            │
│                               └─IPC→ Worker 3            │
└──────────────────────────────┼────────────────────────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
         ┌──────▼──────┐ ┌────▼──────┐ ┌────▼──────┐
         │   Worker 1   │ │  Worker 2  │ │  Worker 3  │
         │              │ │            │ │            │
         │ Express + WS │ │Express + WS│ │Express + WS│
         └──────┬───────┘ └────┬───────┘ └────┬───────┘
                │              │              │
         Socket.IO      Socket.IO      Socket.IO
                │              │              │
         ┌──────▼──────┐ ┌────▼──────┐ ┌────▼──────┐
         │   Client 1   │ │  Client 2  │ │  Client 3  │
         │   Client 2   │ │  Client 3  │ │  Client 4  │
         └──────────────┘ └────────────┘ └────────────┘
```

### Key Components

**1. JobQueue (Primary Process)**
- Emits lifecycle events
- Handles retry logic
- Manages job execution

**2. Event Listeners (Primary Process)**
- Console logging
- Retry coordination
- Broadcasting to workers

**3. IPC Communication**
- Primary → Workers: Job event data
- Workers → Primary: Job requests (resize/convert)

**4. Socket.IO (Worker Processes)**
- Receives IPC messages
- Broadcasts to WebSocket clients
- Manages client connections and rooms

**5. Clients (Frontend)**
- Connect to any worker
- Receive real-time updates
- Subscribe to specific videos

---

## Usage Examples

### Example 1: Frontend Integration

```html
<!DOCTYPE html>
<html>
<head>
    <script src="/socket.io/socket.io.js"></script>
</head>
<body>
    <div id="progress"></div>

    <script>
        const socket = io();

        // Track job progress
        socket.on('job:started', (data) => {
            if (data.videoId === currentVideoId) {
                document.getElementById('progress').innerHTML =
                    `Processing your video...`;
            }
        });

        socket.on('job:completed', (data) => {
            if (data.videoId === currentVideoId) {
                document.getElementById('progress').innerHTML =
                    `✅ Complete! Duration: ${(data.duration / 1000).toFixed(2)}s`;
            }
        });

        socket.on('job:failed', (data) => {
            if (data.videoId === currentVideoId) {
                document.getElementById('progress').innerHTML =
                    `⚠️ Retrying... (Attempt ${data.currentAttempt + 1}/${data.maxRetries + 1})`;
            }
        });
    </script>
</body>
</html>
```

### Example 2: React Integration

```javascript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

function VideoProgress({ videoId }) {
  const [status, setStatus] = useState('pending');
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    const socket = io('http://localhost:8060');

    socket.emit('subscribe-video', videoId);

    socket.on('job:started', (data) => {
      if (data.videoId === videoId) {
        setStatus('processing');
      }
    });

    socket.on('job:completed', (data) => {
      if (data.videoId === videoId) {
        setStatus('completed');
        setProgress(data);
      }
    });

    socket.on('job:failed', (data) => {
      if (data.videoId === videoId) {
        setStatus(`retrying (${data.currentAttempt + 1}/${data.maxRetries + 1})`);
      }
    });

    return () => {
      socket.emit('unsubscribe-video', videoId);
      socket.disconnect();
    };
  }, [videoId]);

  return (
    <div>
      <h3>Status: {status}</h3>
      {progress && <p>Completed in {(progress.duration / 1000).toFixed(2)}s</p>}
    </div>
  );
}
```

### Example 3: Admin Dashboard

```javascript
// Track all jobs across the system
const socket = io();
const jobStats = { queued: 0, processing: 0, completed: 0, failed: 0 };

socket.on('job:queued', () => jobStats.queued++);
socket.on('job:started', () => {
  jobStats.queued--;
  jobStats.processing++;
});
socket.on('job:completed', () => {
  jobStats.processing--;
  jobStats.completed++;
});
socket.on('job:failed', () => jobStats.failed++);

// Display dashboard
setInterval(() => {
  console.log('Job Statistics:', jobStats);
}, 5000);
```

---

## System Design Concepts Demonstrated

### 1. Event-Driven Architecture ✅
- **Observer Pattern**: JobQueue emits events, listeners react
- **Loose Coupling**: Components don't know about each other
- **Pub/Sub**: One publisher (JobQueue), multiple subscribers (logging, WebSocket, etc.)

### 2. Distributed Systems ✅
- **Horizontal Scaling**: Multiple worker processes
- **Inter-Process Communication**: Primary ↔ Workers via IPC
- **Load Balancing**: OS round-robin distributes WebSocket connections
- **State Synchronization**: All workers receive same events

### 3. Resilience Patterns ✅
- **Retry Logic**: Automatic retry with exponential backoff
- **Circuit Breaker**: Max retries prevents infinite loops
- **Graceful Degradation**: Failed jobs don't crash the system
- **Observability**: Full logging and real-time monitoring

### 4. Real-Time Communication ✅
- **WebSocket (Bi-directional)**: Server can push to clients
- **Message Broadcasting**: One-to-many communication
- **Room-based Routing**: Selective message delivery
- **Connection Management**: Handle connects/disconnects

---

## Next Steps

With these features implemented, you now have:
- ✅ Event-driven architecture
- ✅ Retry logic with exponential backoff
- ✅ Real-time WebSocket updates
- ✅ Distributed system with IPC

**Future Enhancements:**
1. Replace JobQueue with Redis Bull (industry-standard queue)
2. Add PostgreSQL for persistent job history
3. Implement job progress percentage (0-100%)
4. Add dead letter queue for permanently failed jobs
5. Metrics collection (success rate, avg duration)
6. Email/webhook notifications
7. Job cancellation feature
8. Priority queue (high/normal/low priority jobs)

---

## Testing Checklist

- [ ] Start server: `npm run cluster`
- [ ] Open demo: `http://localhost:8060/websocket-demo.html`
- [ ] Upload a video
- [ ] Resize video - see events flow in real-time
- [ ] Convert format - observe retry logic if error occurs
- [ ] Open multiple browser tabs - all receive events
- [ ] Check server logs - see retry attempts and timing
- [ ] Verify exponential backoff (2s → 4s → 8s)

Congratulations! You've built a production-grade event-driven distributed system! 🎉
