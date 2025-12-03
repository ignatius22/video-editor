const cluster = require("node:cluster");
const JobQueue = require("../lib/JobQueue.js");

if (cluster.isPrimary) {
  const jobs = new JobQueue();

  // Event Listeners for Job Lifecycle
  jobs.on('job:queued', (data) => {
    console.log(`\n📥 [JOB QUEUED]`);
    console.log(`   Job ID: ${data.jobId}`);
    console.log(`   Type: ${data.type}`);
    console.log(`   Video: ${data.videoId}`);
    console.log(`   Queue Position: ${data.queuePosition}`);
    console.log(`   Queued At: ${data.queuedAt}`);
  });

  jobs.on('job:started', (data) => {
    const waitTime = new Date(data.startedAt) - new Date(data.queuedAt);
    console.log(`\n⚙️  [JOB STARTED]`);
    console.log(`   Job ID: ${data.jobId}`);
    console.log(`   Type: ${data.type}`);
    console.log(`   Video: ${data.videoId}`);
    console.log(`   Wait Time: ${(waitTime / 1000).toFixed(2)}s`);
  });

  jobs.on('job:completed', (data) => {
    console.log(`\n✅ [JOB COMPLETED]`);
    console.log(`   Job ID: ${data.jobId}`);
    console.log(`   Type: ${data.type}`);
    console.log(`   Video: ${data.videoId}`);
    console.log(`   Result:`, JSON.stringify(data.result));
    console.log(`   Duration: ${(data.duration / 1000).toFixed(2)}s`);
    console.log(`   Total Time (queued → completed): ${((new Date(data.completedAt) - new Date(data.queuedAt)) / 1000).toFixed(2)}s`);
  });

  jobs.on('job:failed', (data) => {
    console.log(`\n❌ [JOB FAILED]`);
    console.log(`   Job ID: ${data.jobId}`);
    console.log(`   Type: ${data.type}`);
    console.log(`   Video: ${data.videoId}`);
    console.log(`   Error: ${data.error}`);
    console.log(`   Failed At: ${data.failedAt}`);
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
