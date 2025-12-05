const cluster = require("node:cluster");
const BullQueue = require("../lib/BullQueue.js");

if (cluster.isPrimary) {
  const jobs = new BullQueue();

  // Retry configuration
  const MAX_RETRIES = 3;
  const INITIAL_BACKOFF_MS = 2000; // 2 seconds
  const retryTracker = new Map(); // jobId -> { attempts, originalJob }

  // Helper function to broadcast job events to all workers (for WebSocket)
  const broadcastToWorkers = (event, data) => {
    Object.values(cluster.workers).forEach(worker => {
      worker.send({
        type: 'job-event',
        event,
        data
      });
    });
  };

  // Event Listeners for Job Lifecycle
  jobs.on('job:queued', (data) => {
    broadcastToWorkers('job:queued', data);
    console.log(`\n📥 [JOB QUEUED]`);
    console.log(`   Job ID: ${data.jobId}`);
    console.log(`   Type: ${data.type}`);
    console.log(`   Video: ${data.videoId}`);
    console.log(`   Queue Position: ${data.queuePosition}`);
    console.log(`   Queued At: ${data.queuedAt}`);
  });

  jobs.on('job:started', (data) => {
    broadcastToWorkers('job:started', data);
    const waitTime = new Date(data.startedAt) - new Date(data.queuedAt);
    console.log(`\n⚙️  [JOB STARTED]`);
    console.log(`   Job ID: ${data.jobId}`);
    console.log(`   Type: ${data.type}`);
    console.log(`   Video: ${data.videoId}`);
    console.log(`   Wait Time: ${(waitTime / 1000).toFixed(2)}s`);
  });

  jobs.on('job:progress', (data) => {
    broadcastToWorkers('job:progress', data);
    console.log(`\n📊 [JOB PROGRESS]`);
    console.log(`   Job ID: ${data.jobId}`);
    console.log(`   Type: ${data.type}`);
    console.log(`   Video: ${data.videoId}`);
    console.log(`   Progress: ${data.progress}%`);
  });

  jobs.on('job:completed', (data) => {
    broadcastToWorkers('job:completed', data);

    // Clean up retry tracker on success
    if (retryTracker.has(data.videoId)) {
      const attempts = retryTracker.get(data.videoId).attempts;
      console.log(`\n✅ [JOB COMPLETED] (Succeeded after ${attempts} retry/retries)`);
      retryTracker.delete(data.videoId);
    } else {
      console.log(`\n✅ [JOB COMPLETED]`);
    }

    console.log(`   Job ID: ${data.jobId}`);
    console.log(`   Type: ${data.type}`);
    console.log(`   Video: ${data.videoId}`);
    console.log(`   Result:`, JSON.stringify(data.result));
    console.log(`   Duration: ${(data.duration / 1000).toFixed(2)}s`);
    console.log(`   Total Time (queued → completed): ${((new Date(data.completedAt) - new Date(data.queuedAt)) / 1000).toFixed(2)}s`);
  });

  // Listener for permanent failures (after all retries exhausted)
  jobs.on('job:permanent-failure', (data) => {
    broadcastToWorkers('job:permanent-failure', data);
    console.log(`\n⛔ [PERMANENT FAILURE]`);
    console.log(`   Job ID: ${data.jobId}`);
    console.log(`   Type: ${data.type}`);
    console.log(`   Video: ${data.videoId}`);
    console.log(`   Total Attempts: ${data.totalAttempts}`);
    console.log(`   Final Error: ${data.error}`);
    console.log(`   This job will not be retried.`);
  });

  jobs.on('job:failed', (data) => {
    // Get or initialize retry info
    const retryInfo = retryTracker.get(data.videoId) || { attempts: 0 };
    const currentAttempt = retryInfo.attempts;

    // Broadcast failure to clients
    broadcastToWorkers('job:failed', { ...data, currentAttempt, maxRetries: MAX_RETRIES });

    console.log(`\n❌ [JOB FAILED]`);
    console.log(`   Job ID: ${data.jobId}`);
    console.log(`   Type: ${data.type}`);
    console.log(`   Video: ${data.videoId}`);
    console.log(`   Error: ${data.error}`);
    console.log(`   Attempt: ${currentAttempt + 1}/${MAX_RETRIES + 1}`);
    console.log(`   Failed At: ${data.failedAt}`);

    // Retry logic with exponential backoff
    if (currentAttempt < MAX_RETRIES) {
      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, currentAttempt);
      retryTracker.set(data.videoId, { attempts: currentAttempt + 1 });

      console.log(`   🔄 Retrying in ${backoffMs / 1000}s... (Attempt ${currentAttempt + 2}/${MAX_RETRIES + 1})`);

      // Schedule retry with exponential backoff
      setTimeout(() => {
        console.log(`\n🔄 [RETRY ATTEMPT ${currentAttempt + 2}]`);
        console.log(`   Video: ${data.videoId}`);
        console.log(`   Type: ${data.type}`);

        // Re-enqueue the job based on type
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
    } else {
      console.log(`   ⛔ Max retries exceeded. Job permanently failed.`);
      retryTracker.delete(data.videoId); // Clean up

      // Emit permanent failure event
      jobs.emit('job:permanent-failure', {
        ...data,
        totalAttempts: currentAttempt + 1
      });
    }
  });

  const coreCount = require("node:os").availableParallelism();
  for (let i = 0; i < coreCount; i++) {
    cluster.fork();
  }

  cluster.on("message", (worker, message) => {
    if (message.messageType === "new-resize") {
      const { videoId, height, width } = message.data;
      jobs.enqueue({
        type: "resize",
        videoId,
        width,
        height,
      });
    } else if (message.messageType === "new-convert") {
      const { videoId, targetFormat, originalPath, convertedPath } = message.data;
      jobs.enqueue({
        type: "convert",
        videoId,
        targetFormat,
        originalPath,
        convertedPath,
      });
    }
  });

  cluster.on("exit", (worker, code, signal) => {
    console.log(
      `Worker ${worker.process.pid} died (${signal} | ${code}). Restarting...`
    );
    cluster.fork();
  });
} else {
  require("./index.js");
}
