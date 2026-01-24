// CRITICAL: Initialize telemetry FIRST (before any other imports)
const telemetry = require('../shared/telemetry');
const sdk = telemetry.initializeTelemetry('video-editor-worker');

const BullQueue = require('./queue/BullQueue');
const db = require('../shared/database/db');
const config = require('../shared/config');

/**
 * Worker Service
 * Background job processor for video and image operations
 * No HTTP server - pure queue consumer
 */

console.log(`
╔═══════════════════════════════════════════════════════════╗
║         VIDEO EDITOR WORKER SERVICE                       ║
║                                                           ║
║  Environment: ${config.api.env.padEnd(44)}║
║  Redis:       ${config.redis.host}:${config.redis.port}${' '.repeat(44 - (config.redis.host + ':' + config.redis.port).length)}║
║  Database:    ${config.database.host}:${config.database.port} (${config.database.database})${' '.repeat(44 - (config.database.host + ':' + config.database.port + ' (' + config.database.database + ')').length)}║
║  Concurrency: ${config.queue.concurrency} jobs${' '.repeat(44 - (config.queue.concurrency + ' jobs').toString().length)}║
║                                                           ║
║  Processors:                                              ║
║    - Video resize                                         ║
║    - Video format conversion                              ║
║    - Image crop                                           ║
║    - Image resize                                         ║
║    - Image format conversion                              ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// Initialize Bull Queue
const queue = new BullQueue();

// Log queue events
queue.on('job:queued', (data) => {
  console.log(`[Worker] ✓ Job queued: ${data.jobId} (${data.type})`);
});

queue.on('job:started', (data) => {
  console.log(`[Worker] → Job started: ${data.jobId} (${data.type})`);
});

queue.on('job:progress', (data) => {
  console.log(`[Worker] ⏳ Job progress: ${data.jobId} - ${data.progress}%`);
});

queue.on('job:completed', (data) => {
  const duration = data.duration ? `in ${data.duration}ms` : '';
  console.log(`[Worker] ✓ Job completed: ${data.jobId} (${data.type}) ${duration}`);
});

queue.on('job:failed', (data) => {
  console.error(`[Worker] ✗ Job failed: ${data.jobId} (${data.type}) - ${data.error}`);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('\n[Worker] Shutting down gracefully...');

  try {
    // Flush telemetry first
    if (sdk) {
      await telemetry.shutdownTelemetry();
    }

    // Close queue
    await queue.close();
    console.log('[Worker] Queue closed');

    // Close database connections
    await db.pool.end();
    console.log('[Worker] Database connections closed');

    console.log('[Worker] Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('[Worker] Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('[Worker] Uncaught exception:', error);
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Worker] Unhandled rejection at:', promise, 'reason:', reason);
  shutdown();
});

console.log('[Worker] ✓ Service started successfully');
console.log('[Worker] Listening for jobs...\n');
