const Bull = require('bull');
const EventEmitter = require('events');
const videoService = require('@video-editor/shared/database/services/videoService');
const imageService = require('@video-editor/shared/database/services/imageService');
const FFOriginal = require('@video-editor/shared/lib/FF');
const util = require('@video-editor/shared/lib/util');
const config = require('@video-editor/shared/config');
const telemetry = require('@video-editor/shared/telemetry');
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
        attempts: 1, // We handle retries manually
        removeOnComplete: config.queue.removeOnComplete,
        removeOnFail: config.queue.removeOnFail
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
      this.queue.getJob(jobId).then(job => {
        if (job) {
          this.emit('job:started', {
            jobId: job.id,
            type: job.name,
            videoId: job.data.videoId || job.data.imageId,
            startedAt: new Date().toISOString(),
            queuedAt: new Date(job.timestamp).toISOString()
          });
        }
      });
    });

    this.queue.on('global:completed', (jobId, result) => {
      // Job completed successfully
      this.queue.getJob(jobId).then(job => {
        if (job) {
          const completedAt = new Date().toISOString();
          const queuedAt = new Date(job.timestamp).toISOString();
          const startedAt = new Date(job.processedOn).toISOString();

          this.emit('job:completed', {
            jobId: job.id,
            type: job.name,
            videoId: job.data.videoId || job.data.imageId,
            result: JSON.parse(result),
            queuedAt,
            startedAt,
            completedAt,
            duration: job.finishedOn - job.processedOn
          });
        }
      });
    });

    this.queue.on('global:failed', (jobId, err) => {
      // Job failed
      this.queue.getJob(jobId).then(job => {
        if (job) {
          // Handle different error types (Error object, string, or undefined)
          const errorMessage = err?.message || (typeof err === 'string' ? err : 'Unknown error');
          const errorStack = err?.stack || null;

          const failedData = {
            jobId: job.id,
            type: job.name,
            videoId: job.data.videoId || job.data.imageId,
            error: errorMessage,
            stack: errorStack,
            queuedAt: new Date(job.timestamp).toISOString(),
            startedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
            failedAt: new Date().toISOString(),
            ...job.data // Include all job data for retry
          };

          this.emit('job:failed', failedData);
        }
      });
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
      const fs = require('fs').promises;

      // Restore pending operations from database
      const pendingOperations = await videoService.getPendingOperations(100);

      let restoredCount = 0;
      let skippedCount = 0;

      for (const operation of pendingOperations) {
        const params = operation.parameters;
        const originalPath = `${config.storage.path}/${operation.video_id}/original.${operation.video_extension}`;

        // Check if the original file exists before restoring the job
        try {
          await fs.access(originalPath);
        } catch (err) {
          // File doesn't exist, mark operation as failed and skip
          console.log(`[BullQueue] Skipping ${operation.operation_type} job for ${operation.video_id} - original file not found`);
          await videoService.updateOperationStatus(operation.id, 'failed', null, 'Original file not found');
          skippedCount++;
          continue;
        }

        // Restore jobs based on operation type
        if (operation.operation_type === 'resize') {
          await this.enqueue({
            type: 'resize',
            videoId: operation.video_id,
            width: params.width,
            height: params.height
          });
          console.log(`[BullQueue] Restored resize job: ${operation.video_id} ${params.width}x${params.height}`);
          restoredCount++;
        } else if (operation.operation_type === 'convert') {
          const convertedPath = `${config.storage.path}/${operation.video_id}/converted.${params.targetFormat}`;

          await this.enqueue({
            type: 'convert',
            videoId: operation.video_id,
            targetFormat: params.targetFormat,
            originalFormat: params.originalFormat,
            originalPath,
            convertedPath
          });
          console.log(`[BullQueue] Restored convert job: ${operation.video_id} → ${params.targetFormat}`);
          restoredCount++;
        } else if (operation.operation_type === 'crop') {
          await this.enqueue({
            type: 'crop',
            imageId: operation.video_id,
            width: params.width,
            height: params.height,
            x: params.x,
            y: params.y
          });
          console.log(`[BullQueue] Restored crop job: ${operation.video_id} ${params.width}x${params.height} at (${params.x},${params.y})`);
          restoredCount++;
        } else if (operation.operation_type === 'resize-image') {
          await this.enqueue({
            type: 'resize-image',
            imageId: operation.video_id,
            width: params.width,
            height: params.height
          });
          console.log(`[BullQueue] Restored resize-image job: ${operation.video_id} ${params.width}x${params.height}`);
          restoredCount++;
        } else if (operation.operation_type === 'convert-image') {
          await this.enqueue({
            type: 'convert-image',
            imageId: operation.video_id,
            targetFormat: params.targetFormat,
            originalFormat: params.originalFormat
          });
          console.log(`[BullQueue] Restored convert-image job: ${operation.video_id} ${params.originalFormat} → ${params.targetFormat}`);
          restoredCount++;
        }
      }

      console.log(`[BullQueue] Restored ${restoredCount} incomplete jobs, skipped ${skippedCount} jobs with missing files`);
    } catch (error) {
      console.error('[BullQueue] Error restoring incomplete jobs:', error);
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

          // Resize video (FFmpeg operation is now auto-instrumented)
          await bullJob.progress(25);
          await FF.resize(originalVideoPath, targetVideoPath, width, height);

          // Update progress: Processing complete
          await bullJob.progress(75);

          // Update operation status to completed
          if (operation) {
            await videoService.updateOperationStatus(operation.id, 'completed', targetVideoPath);
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
          // Update operation status to failed
          if (operation) {
            await videoService.updateOperationStatus(operation.id, 'failed', null, error.message);
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

          // Convert format (FFmpeg operation is now auto-instrumented)
          await bullJob.progress(25);
          await FF.convertFormat(originalPath, convertedPath, targetFormat);

          // Update progress: Processing complete
          await bullJob.progress(75);

          // Update operation status to completed
          if (operation) {
            await videoService.updateOperationStatus(operation.id, 'completed', convertedPath);
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
          console.error(`Video conversion failed:`, error);
          util.deleteFile(convertedPath);

          // Update operation status to failed
          if (operation) {
            await videoService.updateOperationStatus(operation.id, 'failed', null, error.message);
          }

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
          await bullJob.progress(100); // Progress is fast for images

          // Update operation status to processing
          if (operation) {
            await imageService.updateOperationStatus(operation.id, 'processing');
          }

          // Crop image (FFmpeg operation is now auto-instrumented)
          await FF.cropImage(originalImagePath, targetImagePath, width, height, x, y);

          // Update operation status to completed
          if (operation) {
            await imageService.updateOperationStatus(operation.id, 'completed', targetImagePath);
          }

          // Complete
          await bullJob.progress(100);

          console.log(`Image cropped ${imageId} to ${width}x${height} at (${x},${y})`);

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
          console.error(`Image crop failed:`, error);

          // Update operation status to failed
          if (operation) {
            await imageService.updateOperationStatus(operation.id, 'failed', null, error.message);
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
          await bullJob.progress(100);

          // Update operation status to processing
          if (operation) {
            await imageService.updateOperationStatus(operation.id, 'processing');
          }

          // Resize image (FFmpeg operation is now auto-instrumented)
          await FF.resizeImage(originalImagePath, targetImagePath, width, height);

          // Update operation status to completed
          if (operation) {
            await imageService.updateOperationStatus(operation.id, 'completed', targetImagePath);
          }

          // Complete
          await bullJob.progress(100);

          console.log(`Image resized ${imageId} to ${width}x${height}`);

          // Add result attributes to span
          if (span) {
            span.setAttributes({
              'job.result.output_path': targetImagePath,
              'job.result.dimensions': `${width}x${height}`,
            });
          }

          return JSON.stringify({ width, height, outputPath: targetImagePath });
        } catch (error) {
          console.error(`Image resize failed:`, error);

          // Update operation status to failed
          if (operation) {
            await imageService.updateOperationStatus(operation.id, 'failed', null, error.message);
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
          await bullJob.progress(100);

          // Update operation status to processing
          if (operation) {
            await imageService.updateOperationStatus(operation.id, 'processing');
          }

          // Convert image format (FFmpeg operation is now auto-instrumented)
          await FF.convertImageFormat(originalImagePath, targetImagePath, targetFormat);

          // Update operation status to completed
          if (operation) {
            await imageService.updateOperationStatus(operation.id, 'completed', targetImagePath);
          }

          // Complete
          await bullJob.progress(100);

          console.log(`Image converted ${imageId} from ${image.extension} to ${targetFormat}`);

          // Add result attributes to span
          if (span) {
            span.setAttributes({
              'job.result.output_path': targetImagePath,
              'job.result.format': targetFormat,
            });
          }

          return JSON.stringify({ targetFormat, outputPath: targetImagePath });
        } catch (error) {
          console.error(`Image conversion failed:`, error);
          util.deleteFile(targetImagePath);

          // Update operation status to failed
          if (operation) {
            await imageService.updateOperationStatus(operation.id, 'failed', null, error.message);
          }

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
}

module.exports = BullQueue;
