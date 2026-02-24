const Bull = require('bull');
const EventEmitter = require('events');
const fs = require('fs').promises;
const { transaction } = require('@video-editor/shared/database/db');
const videoService = require('@video-editor/shared/database/services/videoService');
const imageService = require('@video-editor/shared/database/services/imageService');
const FFOriginal = require('@video-editor/shared/lib/FF');
const util = require('@video-editor/shared/lib/util');
const config = require('@video-editor/shared/config');
const telemetry = require('@video-editor/shared/telemetry');
const userService = require('@video-editor/shared/database/services/userService');
const createLogger = require('@video-editor/shared/lib/logger');
const logger = createLogger('queue');

// Use instrumented FF module if telemetry is enabled
const FF = telemetry.config.enabled
  ? telemetry.createInstrumentedFF(FFOriginal)
  : FFOriginal;

class BullQueue extends EventEmitter {
  constructor() {
    super();

    // Create Bull queue connected to Redis
    this.queue = new Bull('video-processing', {
      redis: {
        host: config.redis.host,
        port: config.redis.port
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: config.queue.removeOnComplete,
        removeOnFail: config.queue.removeOnFail
      },
      settings: {
        lockDuration: 60000, // 60s lock to prevent premature "stalling" on heavy jobs
        lockRenewTime: 30000, // Renew every 30s
        stalledInterval: 10000, // Check for stalled jobs every 10s
        maxStalledCount: 2
      }
    });

    // Surface Redis/Bull connection errors for easier debugging
    this.queue.on('error', (err) => {
      logger.error({ err: err.message, stack: err.stack }, 'Redis/Bull connection error');
    });

    this.queue.on('ready', () => {
      logger.info('Bull queue connected to Redis and ready');
    });

    // Configuration
    this.CONCURRENCY = config.queue.concurrency;

    // Setup processors for different job types
    this.setupProcessors();

    // Setup Bull event listeners (translate to our custom events)
    this.setupBullEventListeners();
    
    // Add structured logging for internal events
    this.setupLoggingEventListeners();

    // Setup global failure handling (terminal failures)
    this.setupFailureHandling();

    // Restore incomplete jobs from database on startup
    this.restoreIncompleteJobs();

    logger.info({
      concurrency: this.CONCURRENCY,
      redis: `${config.redis.host}:${config.redis.port}`
    }, 'BullQueue initialized');
  }

  setupLoggingEventListeners() {
    this.on('job:queued', (data) => {
      logger.info({ jobId: data.jobId, type: data.type, resourceId: data.videoId || data.imageId }, 'Job Queued');
    });

    this.on('job:started', (data) => {
      logger.info({ jobId: data.jobId, type: data.type, resourceId: data.videoId || data.imageId }, 'Job Started');
    });

    this.on('job:progress', (data) => {
      // Log progress only at certain intervals (e.g. 25, 50, 75, 100) to avoid log spam
      if (data.progress % 25 === 0) {
        logger.debug({ jobId: data.jobId, progress: data.progress }, 'Job Progress');
      }
    });

    this.on('job:completed', (data) => {
      logger.info({ 
        jobId: data.jobId, 
        type: data.type, 
        resourceId: data.videoId || data.imageId,
        duration: data.duration 
      }, 'Job Completed');
    });

    this.on('job:failed', (data) => {
      logger.error({ 
        jobId: data.jobId, 
        type: data.type, 
        resourceId: data.videoId || data.imageId,
        err: data.error 
      }, 'Job Failed');
    });
  }

  setupFailureHandling() {
    this.queue.on('global:failed', async (jobId, err) => {
      const job = await this.queue.getJob(jobId);
      if (!job) return;

      // Only mark as failed in DB if all retry attempts are exhausted
      if (job.attemptsMade >= job.opts.attempts) {
        logger.error({ 
          jobId, 
          type: job.name, 
          resourceId: job.data.videoId || job.data.imageId,
          attempts: job.attemptsMade,
          err: err
        }, 'Job terminally failed after retries');

        const service = job.data.videoId ? videoService : imageService;
        const resourceId = job.data.videoId || job.data.imageId;
        const operationId = job.data.operationId;

        if (operationId) {
          try {
            // Use transaction for atomic status update + credit release + outbox events
            await transaction(async (client) => {
              await service.updateOperationStatus(
                operationId, 
                'failed', 
                null, 
                `Failed after ${job.attemptsMade} attempts: ${err}`,
                client
              );
              
              // Release/Refund credits on terminal failure
              await userService.releaseCredits(`op-${operationId}`, client);
            });
          } catch (dbErr) {
            logger.error({ dbErr, jobId }, 'Failed to update terminal failure status or release credits');
          }
        }
      } else {
        logger.warn({ 
          jobId, 
          type: job.name, 
          attempts: job.attemptsMade, 
          nextRetryIn: Math.pow(2, job.attemptsMade - 1) * 5000 
        }, 'Job failed, scheduling retry');
      }
    });
  }

  setupProcessors() {
    // Process video resize jobs
    this.queue.process('resize', this.CONCURRENCY, async (bullJob) => {
      return this.processResize(bullJob);
    });

    // Process video convert jobs
    this.queue.process('convert', this.CONCURRENCY, async (bullJob) => {
      return this.processConvert(bullJob);
    });

    // Process image crop jobs
    this.queue.process('crop', this.CONCURRENCY, async (bullJob) => {
      return this.processCropImage(bullJob);
    });

    // Process image resize jobs
    this.queue.process('resize-image', this.CONCURRENCY, async (bullJob) => {
      return this.processResizeImage(bullJob);
    });

    // Process image convert jobs
    this.queue.process('convert-image', this.CONCURRENCY, async (bullJob) => {
      return this.processConvertImage(bullJob);
    });
  }

  setupBullEventListeners() {
    // Global events
    this.queue.on('global:active', (jobId, result) => {
      // Job started processing
      // Driven by outbox (job.started event generated in service.updateOperationStatus)
    });

    this.queue.on('global:completed', (jobId, result) => {
      // Job completed successfully
      // Business logic (status update & credit capture) moved to processors for atomicity
    });

    // Standard job lifecycle listeners
    this.queue.on('global:failed', (jobId, err) => {
      // Driven by outbox (job.failed event generated in setupFailureHandling)
    });

    this.queue.on('global:progress', (jobId, progress) => {
      // Job progress update
      this.queue.getJob(jobId).then(job => {
        if (job) {
          this.emit('job:progress', {
            jobId: job.id,
            type: job.name,
            videoId: job.data.videoId || job.data.imageId,
            progress: progress
          });
        }
      });
    });
  }

  async restoreIncompleteJobs() {
    try {
      // Restore pending operations from database
      const pendingOperations = await videoService.getPendingOperations(100);

      let restoredCount = 0;
      let skippedCount = 0;

      for (const operation of pendingOperations) {
        const params = operation.parameters;
        const idPrefix = operation.video_id ? 'video_id' : 'image_id';
        const resourceId = operation.video_id || operation.image_id;
        const extension = operation.video_extension || operation.image_extension;
        const originalPath = `${config.storage.path}/${resourceId}/original.${extension}`;

        // Check if the original file exists before restoring the job
        try {
          await fs.access(originalPath);
        } catch (err) {
          // File doesn't exist, mark operation as failed and skip
          console.log(`[BullQueue] Skipping ${operation.operation_type} job for ${resourceId} - original file not found`);
          const service = operation.video_id ? videoService : imageService;
          await service.updateOperationStatus(operation.id, 'failed', null, 'Original file not found');
          skippedCount++;
          continue;
        }

        // Restore jobs based on operation type
        if (operation.operation_type === 'resize') {
          await this.enqueue({
            type: 'resize',
            videoId: operation.video_id,
            width: params.width,
            height: params.height,
            operationId: operation.id
          });
          logger.info({ videoId: operation.video_id, operationId: operation.id }, 'Restored resize job');
          restoredCount++;
        } else if (operation.operation_type === 'convert') {
          await this.enqueue({
            type: 'convert',
            videoId: operation.video_id,
            targetFormat: params.targetFormat,
            originalFormat: params.originalFormat,
            operationId: operation.id
          });
          logger.info({ videoId: operation.video_id, operationId: operation.id }, 'Restored convert job');
          restoredCount++;
        } else if (operation.operation_type === 'crop') {
          await this.enqueue({
            type: 'crop',
            imageId: operation.image_id,
            width: params.width,
            height: params.height,
            x: params.x,
            y: params.y,
            operationId: operation.id
          });
          logger.info({ imageId: operation.image_id, operationId: operation.id }, 'Restored crop job');
          restoredCount++;
        } else if (operation.operation_type === 'resize-image') {
          await this.enqueue({
            type: 'resize-image',
            imageId: operation.image_id,
            width: params.width,
            height: params.height,
            operationId: operation.id
          });
          logger.info({ imageId: operation.image_id, operationId: operation.id }, 'Restored resize-image job');
          restoredCount++;
        } else if (operation.operation_type === 'convert-image') {
          await this.enqueue({
            type: 'convert-image',
            imageId: operation.image_id,
            targetFormat: params.targetFormat,
            originalFormat: params.originalFormat,
            operationId: operation.id
          });
          logger.info({ imageId: operation.image_id, operationId: operation.id }, 'Restored convert-image job');
          restoredCount++;
        }
      }

      logger.info({ restoredCount, skippedCount }, 'Incomplete jobs restoration complete');
    } catch (error) {
      logger.error({ err: error.message }, 'Error restoring incomplete jobs');
    }
  }

  async enqueue(job) {
    const { type, ...data } = job;

    // Inject trace context into job data
    const instrumentedData = telemetry.injectTraceContext(data);

    // Add priority support
    const priority = job.priority || 'normal';
    const priorityValue = {
      high: 1,
      normal: 5,
      low: 10
    }[priority];

    // Create enqueue span
    const enqueueSpan = telemetry.createEnqueueSpan(type, data);

    return await enqueueSpan.run(async () => {
      // Add job to Bull queue
      const bullJob = await this.queue.add(type, instrumentedData, {
        priority: priorityValue
      });

      // Emit queued event
      const queuePosition = await this.queue.count();
      this.emit('job:queued', {
        jobId: bullJob.id,
        type: type,
        videoId: data.videoId || data.imageId,
        queuePosition: queuePosition,
        queuedAt: new Date(bullJob.timestamp).toISOString(),
        priority: priority
      });

      return bullJob.id;
    });
  }

  async processResize(bullJob) {
    return telemetry.extractTraceContextAndStartSpan(
      bullJob,
      'queue.process.resize',
      async (context, span) => {
        const { videoId, width, height } = bullJob.data;

        const video = await videoService.findByVideoId(videoId);

        if (!video) {
          throw new Error(`Video ${videoId} not found`);
        }

        const originalVideoPath = `${config.storage.path}/${video.video_id}/original.${video.extension}`;
        const targetVideoPath = `${config.storage.path}/${video.video_id}/${width}x${height}.${video.extension}`;

        // Find the operation
        const operation = await videoService.findOperation(videoId, 'resize', { width, height });

        try {
          // Update progress: Starting
          await bullJob.progress(10);

          // Update operation status to processing
          if (operation) {
            await videoService.updateOperationStatus(operation.id, 'processing');
          }

          // Pre-flight check
          await this.verifyInputFile(originalVideoPath);

          // Resize video (FFmpeg operation is now auto-instrumented)
          await bullJob.progress(25);
          await FF.resizeVideo(originalVideoPath, targetVideoPath, width, height, (progress) => {
            bullJob.progress(25 + Math.floor(progress * 0.5)); // Scale progress from 25% to 75%
          });

          // Post-flight check
          await this.verifyOutputFile(targetVideoPath);

          // Update progress: Processing complete
          await bullJob.progress(75);

          // Update operation status to completed AND capture credits atomically
          if (operation) {
            await transaction(async (client) => {
              await videoService.updateOperationStatus(operation.id, 'completed', targetVideoPath, null, client);
              await userService.captureCredits(`op-${operation.id}`, client);
            });
          }

          // Complete
          await bullJob.progress(100);

          console.log(`Done resizing ${videoId} to ${width}x${height}`);

          // Add result attributes to span
          if (span) {
            span.setAttributes({
              'job.result.output_path': targetVideoPath,
              'job.result.dimensions': `${width}x${height}`,
            });
          }

          return JSON.stringify({ width, height, outputPath: targetVideoPath });
        } catch (error) {
          if (error.message.includes('Process timed out')) {
            logger.error({ videoId, timeout: true }, "Resize operation timed out");
          } else {
            logger.error({ err: error.message, stack: error.stack, videoId }, "Resize operation failed");
          }
          util.deleteFile(targetVideoPath);
          throw error;
        }
      }
    );
  }

  async processConvert(bullJob) {
    return telemetry.extractTraceContextAndStartSpan(
      bullJob,
      'queue.process.convert',
      async (context, span) => {
        const { videoId, targetFormat, originalFormat } = bullJob.data;

      const video = await videoService.findByVideoId(videoId);
      if (!video) {
        throw new Error(`Video ${videoId} not found`);
      }

      const originalPath = `${config.storage.path}/${video.video_id}/original.${video.extension}`;
      const convertedPath = `${config.storage.path}/${video.video_id}/converted.${targetFormat}`;

        // Find the operation
        const operation = await videoService.findOperation(videoId, 'convert', {
          targetFormat,
          originalFormat: originalFormat || video.extension.toLowerCase()
        });

        try {
          // Update progress: Starting
          await bullJob.progress(10);

          // Update operation status to processing
          if (operation) {
            await videoService.updateOperationStatus(operation.id, 'processing');
          }

          // Pre-flight check
          await this.verifyInputFile(originalPath);

          // Convert format (FFmpeg operation is now auto-instrumented)
          await bullJob.progress(25);
          await FF.convertVideo(originalPath, convertedPath, targetFormat, (progress) => {
            bullJob.progress(25 + Math.floor(progress * 0.5)); // Scale progress from 25% to 75%
          });

          // Post-flight check
          await this.verifyOutputFile(convertedPath);

          // Update progress: Processing complete
          await bullJob.progress(75);

          // Update operation status to completed AND capture credits atomically
          if (operation) {
            await transaction(async (client) => {
              await videoService.updateOperationStatus(operation.id, 'completed', convertedPath, null, client);
              await userService.captureCredits(`op-${operation.id}`, client);
            });
          }

          // Complete
          await bullJob.progress(100);

          console.log(`Video converted to ${targetFormat.toUpperCase()}`);

          // Add result attributes to span
          if (span) {
            span.setAttributes({
              'job.result.output_path': convertedPath,
              'job.result.format': targetFormat,
            });
          }

          return JSON.stringify({ targetFormat, outputPath: convertedPath });
        } catch (error) {
          if (error.message.includes('Process timed out')) {
            logger.error({ videoId, timeout: true, targetFormat }, "Video conversion timed out");
          } else {
            logger.error({ err: error.message, stack: error.stack, videoId }, "Video conversion failed");
          }
          util.deleteFile(convertedPath);
          throw error;
        }
      }
    );
  }

  async processCropImage(bullJob) {
    return telemetry.extractTraceContextAndStartSpan(
      bullJob,
      'queue.process.crop',
      async (context, span) => {
        const { imageId, width, height, x, y } = bullJob.data;

        const image = await imageService.findByImageId(imageId);
        if (!image) {
          throw new Error(`Image ${imageId} not found`);
        }

        const originalImagePath = `${config.storage.path}/${image.image_id}/original.${image.extension}`;
        const targetImagePath = `${config.storage.path}/${image.image_id}/cropped_${width}x${height}x${x}x${y}.${image.extension}`;

        // Find the operation
        const operation = await imageService.findOperation(imageId, 'crop', { width, height, x, y });

        try {
          // Update progress: Starting
          await bullJob.progress(10);

          // Update operation status to processing
          if (operation) {
            await imageService.updateOperationStatus(operation.id, 'processing');
          }

          // Pre-flight check
          await this.verifyInputFile(originalImagePath);

          // Crop image (FFmpeg operation is now auto-instrumented)
          await FF.cropImage(originalImagePath, targetImagePath, width, height, x, y);

          // Post-flight check
          await this.verifyOutputFile(targetImagePath);

          // Update progress: Processing complete
          await bullJob.progress(75);

          // Update operation status to completed AND capture credits atomically
          if (operation) {
            await transaction(async (client) => {
              await imageService.updateOperationStatus(operation.id, 'completed', targetImagePath, null, client);
              await userService.captureCredits(`op-${operation.id}`, client);
            });
          }

          // Complete
          await bullJob.progress(100);
          
          // Add result attributes to span
          if (span) {
            span.setAttributes({
              'job.result.output_path': targetImagePath,
              'job.result.dimensions': `${width}x${height}`,
              'job.result.position': `${x},${y}`,
            });
          }

          return JSON.stringify({ width, height, x, y, outputPath: targetImagePath });
        } catch (error) {
          if (error.message.includes('Process timed out')) {
            logger.error({ imageId, timeout: true }, "Image crop timed out");
          } else {
            logger.error({ err: error.message, stack: error.stack, imageId }, "Image crop failed");
          }
          util.deleteFile(targetImagePath);
          throw error;
        }
      }
    );
  }

  async processResizeImage(bullJob) {
    return telemetry.extractTraceContextAndStartSpan(
      bullJob,
      'queue.process.resize-image',
      async (context, span) => {
        const { imageId, width, height } = bullJob.data;

        const image = await imageService.findByImageId(imageId);
        if (!image) {
          throw new Error(`Image ${imageId} not found`);
        }

        const originalImagePath = `${config.storage.path}/${image.image_id}/original.${image.extension}`;
        const targetImagePath = `${config.storage.path}/${image.image_id}/resized_${width}x${height}.${image.extension}`;

        // Find the operation
        const operation = await imageService.findOperation(imageId, 'resize', { width, height });

        try {
          // Update progress: Starting
          await bullJob.progress(10);

          // Update operation status to processing
          if (operation) {
            await imageService.updateOperationStatus(operation.id, 'processing');
          }

          // Pre-flight check
          await this.verifyInputFile(originalImagePath);

          // Resize image (FFmpeg operation is now auto-instrumented)
          await FF.resizeImage(originalImagePath, targetImagePath, width, height);

          // Post-flight check
          await this.verifyOutputFile(targetImagePath);

          // Update progress: Processing complete
          await bullJob.progress(75);

          // Update operation status to completed AND capture credits atomically
          if (operation) {
            await transaction(async (client) => {
              await imageService.updateOperationStatus(operation.id, 'completed', targetImagePath, null, client);
              await userService.captureCredits(`op-${operation.id}`, client);
            });
          }

          // Complete
          await bullJob.progress(100);

          // Add result attributes to span
          if (span) {
            span.setAttributes({
              'job.result.output_path': targetImagePath,
              'job.result.dimensions': `${width}x${height}`,
            });
          }

          return JSON.stringify({ width, height, outputPath: targetImagePath });
        } catch (error) {
          if (error.message.includes('Process timed out')) {
            logger.error({ imageId, timeout: true }, "Image resize timed out");
          } else {
            logger.error({ err: error.message, stack: error.stack, imageId }, "Image resize failed");
          }
          util.deleteFile(targetImagePath);
          throw error;
        }
      }
    );
  }

  async processConvertImage(bullJob) {
    return telemetry.extractTraceContextAndStartSpan(
      bullJob,
      'queue.process.convert-image',
      async (context, span) => {
        const { imageId, targetFormat, originalFormat } = bullJob.data;

        const image = await imageService.findByImageId(imageId);
        if (!image) {
          throw new Error(`Image ${imageId} not found`);
        }

        const originalImagePath = `${config.storage.path}/${image.image_id}/original.${image.extension}`;
        const targetImagePath = `${config.storage.path}/${image.image_id}/converted.${targetFormat}`;

        // Find the operation
        const operation = await imageService.findOperation(imageId, 'convert-image', {
          targetFormat,
          originalFormat: originalFormat || image.extension
        });

        try {
          // Update progress: Starting
          await bullJob.progress(10);

          // Update operation status to processing
          if (operation) {
            await imageService.updateOperationStatus(operation.id, 'processing');
          }

          // Pre-flight check
          await this.verifyInputFile(originalImagePath);

          // Convert image format (FFmpeg operation is now auto-instrumented)
          await FF.convertImageFormat(originalImagePath, targetImagePath, targetFormat);

          // Post-flight check
          await this.verifyOutputFile(targetImagePath);

          // Update progress: Processing complete
          await bullJob.progress(75);

          // Update operation status to completed AND capture credits atomically
          if (operation) {
            await transaction(async (client) => {
              await imageService.updateOperationStatus(operation.id, 'completed', targetImagePath, null, client);
              await userService.captureCredits(`op-${operation.id}`, client);
            });
          }

          // Complete
          await bullJob.progress(100);

          // Add result attributes to span
          if (span) {
            span.setAttributes({
              'job.result.output_path': targetImagePath,
              'job.result.format': targetFormat,
            });
          }

          return JSON.stringify({ targetFormat, outputPath: targetImagePath });
        } catch (error) {
          if (error.message.includes('Process timed out')) {
            logger.error({ imageId, timeout: true, targetFormat }, "Image conversion timed out");
          } else {
            logger.error({ err: error.message, stack: error.stack, imageId }, "Image conversion failed");
          }
          util.deleteFile(targetImagePath);
          throw error;
        }
      }
    );
  }

  // Helper methods for queue management
  async getQueueStats() {
    const waiting = await this.queue.getWaitingCount();
    const active = await this.queue.getActiveCount();
    const completed = await this.queue.getCompletedCount();
    const failed = await this.queue.getFailedCount();
    const delayed = await this.queue.getDelayedCount();

    return { waiting, active, completed, failed, delayed };
  }

  async getJob(jobId) {
    return await this.queue.getJob(jobId);
  }

  async removeJob(jobId) {
    const job = await this.getJob(jobId);
    if (job) {
      await job.remove();
    }
  }

  async pauseQueue() {
    await this.queue.pause();
    console.log('[BullQueue] Queue paused');
  }

  async resumeQueue() {
    await this.queue.resume();
    console.log('[BullQueue] Queue resumed');
  }

  async cleanOldJobs(grace = 86400000) {
    // Clean jobs older than grace period (default: 24 hours)
    await this.queue.clean(grace, 'completed');
    await this.queue.clean(grace, 'failed');
    console.log('[BullQueue] Cleaned old jobs');
  }

  async close() {
    await this.queue.close();
    console.log('[BullQueue] Queue closed');
  }

  /**
   * Pre-flight sanity check for input file
   */
  async verifyInputFile(filePath) {
    try {
      await fs.access(filePath);
      const stat = await fs.stat(filePath);
      if (stat.size === 0) {
        throw new Error(`Pre-flight failure: Input file is empty at ${filePath}`);
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error(`Pre-flight failure: Input file not found at ${filePath}`);
      }
      throw err;
    }
  }

  /**
   * Post-flight verification for output file
   */
  async verifyOutputFile(filePath) {
    try {
      const stat = await fs.stat(filePath);
      if (stat.size === 0) {
        throw new Error(`Post-flight failure: Output file was created but is empty at ${filePath}`);
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error(`Post-flight failure: Output file was not created at ${filePath}`);
      }
      throw err;
    }
  }
}

module.exports = BullQueue;
