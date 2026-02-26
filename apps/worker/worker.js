// CRITICAL: Initialize telemetry FIRST (before any other imports)
const telemetry = require('@convertix/shared/telemetry');
const sdk = telemetry.initializeTelemetry('convertix-worker');

const BullQueue = require('./queue/BullQueue');
const createLogger = require('@convertix/shared/lib/logger');
const logger = createLogger('worker');
const db = require('@convertix/shared/database/db');
const config = require('@convertix/shared/config');

/**
 * Worker Service
 * Background job processor for video and image operations
 * No HTTP server - pure queue consumer
 */
// Initialize Bull Queue
const queue = new BullQueue();

/**
 * Worker Entry Point
 */
async function start() {
  logger.info({
    env: config.api.env,
    redis: `${config.redis.host}:${config.redis.port}`,
    concurrency: config.queue.concurrency
  }, 'VIDEO EDITOR WORKER SERVICE STARTING');

  try {
    // Setup processors for different job types
    queue.setupProcessors();
    
    logger.info('Worker processors registered and listening for jobs');

    // Restore any incomplete jobs from the database (e.g. after a crash)
    await queue.restoreIncompleteJobs();
    logger.info('Cleanup: Incomplete jobs restoration check complete');

    // Start periodic storage cleanup (run every 1 hour)
    const storagePruner = require('./lib/cleanup');
    const ReservationJanitor = require('./lib/reservationJanitor');
    const janitor = new ReservationJanitor(queue, { ttlMinutes: 30 });

    // Run cleanups once at startup
    storagePruner.run().catch(err => logger.error({ err: err.message }, 'Initial storage cleanup failed'));
    janitor.run().catch(err => logger.error({ err: err.message }, 'Initial reservation janitor failed'));
    
    // Set intervals for subsequent runs
    const STORAGE_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
    const JANITOR_INTERVAL = 30 * 60 * 1000; // 30 minutes

    setInterval(() => {
      storagePruner.run().catch(err => logger.error({ err: err.message }, 'Periodic storage cleanup failed'));
    }, STORAGE_CLEANUP_INTERVAL);

    setInterval(() => {
      janitor.run().catch(err => logger.error({ err: err.message }, 'Periodic reservation janitor failed'));
    }, JANITOR_INTERVAL);

    logger.info({ 
      storageIntervalMs: STORAGE_CLEANUP_INTERVAL,
      janitorIntervalMs: JANITOR_INTERVAL 
    }, 'Background maintenance tasks scheduled');

  } catch (error) {
    logger.error({ err: error.message, stack: error.stack }, 'FAILED TO START WORKER');
    process.exit(1);
  }
}

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

    // Kill any remaining active FFmpeg processes
    const FF = require('@convertix/shared/lib/FF');
    FF.cleanupProcesses();
    console.log('[Worker] Active FFmpeg processes cleaned up');

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
