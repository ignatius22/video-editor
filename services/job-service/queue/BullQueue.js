const Bull = require('bull');
const EventEmitter = require('events');
const videoService = require('../database/services/videoService');
const jobHistoryService = require('../database/services/jobHistoryService');
const FF = require('./FF');
const util = require('./util');

class BullQueue extends EventEmitter {
  constructor() {
    super();

    // Create Bull queue connected to Redis
    this.queue = new Bull('video-processing', {
      redis: {
        host: 'localhost',
        port: 6379
      },
      defaultJobOptions: {
        attempts: 1, // We handle retries manually in cluster.js
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 200 // Keep last 200 failed jobs for debugging
      }
    });

    // Configuration
    this.CONCURRENCY = 5; // Process up to 5 jobs simultaneously
    this.eventBus = null; // Will be set by setEventBus()

    // Setup processors for different job types
    this.setupProcessors();

    // Setup Bull event listeners (translate to our custom events)
    this.setupBullEventListeners();

    // Restore incomplete jobs from database on startup
    this.restoreIncompleteJobs();

    console.log('[BullQueue] Initialized with Redis connection');
    console.log(`[BullQueue] Concurrency: ${this.CONCURRENCY} jobs in parallel`);
  }

  /**
   * Set the event bus for publishing events
   */
  setEventBus(eventBus) {
    this.eventBus = eventBus;
    console.log('[BullQueue] Event Bus connected for job event publishing');
  }

  setupProcessors() {
    // Process resize jobs
    this.queue.process('resize', this.CONCURRENCY, async (bullJob) => {
      return this.processResize(bullJob);
    });

    // Process convert jobs
    this.queue.process('convert', this.CONCURRENCY, async (bullJob) => {
      return this.processConvert(bullJob);
    });

    // Process trim jobs
    this.queue.process('trim', this.CONCURRENCY, async (bullJob) => {
      return this.processTrim(bullJob);
    // Process image crop jobs
    this.queue.process('crop', this.CONCURRENCY, async (bullJob) => {
      return this.processCrop(bullJob);
    });

    // Process image resize jobs
    this.queue.process('resize-image', this.CONCURRENCY, async (bullJob) => {
      return this.processResizeImage(bullJob);
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
            videoId: job.data.videoId,
            startedAt: new Date().toISOString(),
            queuedAt: new Date(job.timestamp).toISOString()
          });
        }
      });
    });

    this.queue.on('global:completed', (jobId, result) => {
      // Job completed successfully
      this.queue.getJob(jobId).then(async (job) => {
        if (job) {
          const completedAt = new Date().toISOString();
          const queuedAt = new Date(job.timestamp).toISOString();
          const startedAt = new Date(job.processedOn).toISOString();

          const eventData = {
            jobId: job.id,
            type: job.name,
            videoId: job.data.videoId,
            userId: job.data.userId,
            result: JSON.parse(result),
            queuedAt,
            startedAt,
            completedAt,
            duration: job.finishedOn - job.processedOn
          };

          this.emit('job:completed', eventData);

          // Publish JOB_COMPLETED event to RabbitMQ
          if (this.eventBus && this.eventBus.connected) {
            try {
              const { EventTypes } = require('../../shared/eventBus');
              await this.eventBus.publish(EventTypes.JOB_COMPLETED, eventData, {
                correlationId: job.data.correlationId
              });
              console.log(`[BullQueue] Published JOB_COMPLETED event for job ${jobId}`);
            } catch (error) {
              console.error('[BullQueue] Failed to publish JOB_COMPLETED event:', error.message);
            }
          }
        }
      });
    });

    this.queue.on('global:failed', (jobId, err) => {
      // Job failed
      this.queue.getJob(jobId).then(async (job) => {
        if (job) {
          const failedData = {
            jobId: job.id,
            type: job.name,
            videoId: job.data.videoId,
            userId: job.data.userId,
            error: err.message || err,
            stack: err.stack,
            queuedAt: new Date(job.timestamp).toISOString(),
            startedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
            failedAt: new Date().toISOString(),
            ...job.data // Include all job data for retry
          };

          this.emit('job:failed', failedData);

          // Publish JOB_FAILED event to RabbitMQ
          if (this.eventBus && this.eventBus.connected) {
            try {
              const { EventTypes } = require('../../shared/eventBus');
              await this.eventBus.publish(EventTypes.JOB_FAILED, failedData, {
                correlationId: job.data.correlationId
              });
              console.log(`[BullQueue] Published JOB_FAILED event for job ${jobId}`);
            } catch (error) {
              console.error('[BullQueue] Failed to publish JOB_FAILED event:', error.message);
            }
          }
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
            videoId: job.data.videoId,
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

      pendingOperations.forEach((operation) => {
        const params = operation.parameters;

        if (operation.operation_type === 'resize') {
          this.enqueue({
            type: 'resize',
            videoId: operation.video_id,
            width: params.width,
            height: params.height
          });
          console.log(`[BullQueue] Restored resize job: ${operation.video_id} ${params.width}x${params.height}`);
        } else if (operation.operation_type === 'convert') {
          const originalPath = `./storage/${operation.video_id}/original.${operation.video_extension}`;
          const convertedPath = `./storage/${operation.video_id}/converted.${params.targetFormat}`;

          this.enqueue({
            type: 'convert',
            videoId: operation.video_id,
            targetFormat: params.targetFormat,
            originalFormat: params.originalFormat,
            originalPath,
            convertedPath
          });
          console.log(`[BullQueue] Restored convert job: ${operation.video_id} → ${params.targetFormat}`);
        }
      });

      console.log(`[BullQueue] Restored ${pendingOperations.length} incomplete jobs`);
    } catch (error) {
      console.error('[BullQueue] Error restoring incomplete jobs:', error);
    }
  }

  async enqueue(job) {
    const { type, ...data } = job;

    // Add priority support
    const priority = job.priority || 'normal';
    const priorityValue = {
      high: 1,
      normal: 5,
      low: 10
    }[priority];

    // Add job to Bull queue
    const bullJob = await this.queue.add(type, data, {
      priority: priorityValue
    });

    // Emit queued event
    const queuePosition = await this.queue.count();
    this.emit('job:queued', {
      jobId: bullJob.id,
      type: type,
      videoId: data.videoId,
      queuePosition: queuePosition,
      queuedAt: new Date(bullJob.timestamp).toISOString(),
      priority: priority
    });

    return bullJob.id;
  }

  async processResize(bullJob) {
    const { videoId, width, height } = bullJob.data;

    const video = await videoService.findByVideoId(videoId);

    if (!video) {
      throw new Error(`Video ${videoId} not found`);
    }

    const originalVideoPath = `./storage/${video.video_id}/original.${video.extension}`;
    const targetVideoPath = `./storage/${video.video_id}/${width}x${height}.${video.extension}`;

    // Find the operation
    const operation = await videoService.findOperation(videoId, 'resize', { width, height });

    try {
      // Update progress: Starting
      await bullJob.progress(10);

      // Update operation status to processing
      if (operation) {
        await videoService.updateOperationStatus(operation.id, 'processing');
      }

      // Resize video
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

      return JSON.stringify({ width, height });
    } catch (error) {
      // Update operation status to failed
      if (operation) {
        await videoService.updateOperationStatus(operation.id, 'failed', null, error.message);
      }

      util.deleteFile(targetVideoPath);
      throw error;
    }
  }

  async processConvert(bullJob) {
    const { videoId, targetFormat, originalFormat, originalPath, convertedPath } = bullJob.data;

    const video = await videoService.findByVideoId(videoId);
    if (!video) {
      throw new Error(`Video ${videoId} not found`);
    }

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

      // Convert format
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

      console.log(`✅ Video converted to ${targetFormat.toUpperCase()}`);

      return JSON.stringify({ targetFormat });
    } catch (error) {
      console.error(`❌ Video conversion failed:`, error);
      util.deleteFile(convertedPath);

      // Update operation status to failed
      if (operation) {
        await videoService.updateOperationStatus(operation.id, 'failed', null, error.message);
      }

      throw error;
    }
  }

  async processTrim(bullJob) {
    const { videoId, startTime, endTime } = bullJob.data;

    const video = await videoService.findByVideoId(videoId);
    if (!video) {
      throw new Error(`Video ${videoId} not found`);
    }

    const originalVideoPath = `./storage/${video.video_id}/original.${video.extension}`;
    const targetVideoPath = `./storage/${video.video_id}/trimmed-${startTime}-${endTime}.${video.extension}`;

    // Find the operation
    const operation = await videoService.findOperation(videoId, 'trim', { startTime, endTime });
  async processCrop(bullJob) {
    const { imageId, width, height, x, y } = bullJob.data;

    const image = await videoService.findByVideoId(imageId);
    if (!image) {
      throw new Error(`Image ${imageId} not found`);
    }

    const originalImagePath = `./storage/${image.video_id}/original.${image.extension}`;
    const targetImagePath = `./storage/${image.video_id}/cropped-${width}x${height}.${image.extension}`;

    // Find the operation
    const operation = await videoService.findOperation(imageId, 'crop', { width, height, x, y });

    try {
      // Update progress: Starting
      await bullJob.progress(10);

      // Update operation status to processing
      if (operation) {
        await videoService.updateOperationStatus(operation.id, 'processing');
      }

      // Trim video
      await bullJob.progress(25);
      await FF.trimVideo(originalVideoPath, targetVideoPath, startTime, endTime);
      // Crop image
      await bullJob.progress(25);
      await FF.cropImage(originalImagePath, targetImagePath, width, height, x || 0, y || 0);

      // Update progress: Processing complete
      await bullJob.progress(75);

      // Update operation status to completed
      if (operation) {
        await videoService.updateOperationStatus(operation.id, 'completed', targetVideoPath);
        await videoService.updateOperationStatus(operation.id, 'completed', targetImagePath);
      }

      // Complete
      await bullJob.progress(100);

      console.log(`✅ Video trimmed from ${startTime}s to ${endTime}s`);

      return JSON.stringify({ startTime, endTime, duration: endTime - startTime });
    } catch (error) {
      console.error(`❌ Video trim failed:`, error);
      util.deleteFile(targetVideoPath);
      console.log(`✅ Image cropped to ${width}x${height} at (${x || 0}, ${y || 0})`);

      return JSON.stringify({ width, height, x: x || 0, y: y || 0 });
    } catch (error) {
      console.error(`❌ Image crop failed:`, error);
      util.deleteFile(targetImagePath);

      // Update operation status to failed
      if (operation) {
        await videoService.updateOperationStatus(operation.id, 'failed', null, error.message);
      }

      throw error;
    }
  }

  async processResizeImage(bullJob) {
    const { imageId, width, height } = bullJob.data;

    const image = await videoService.findByVideoId(imageId);
    if (!image) {
      throw new Error(`Image ${imageId} not found`);
    }

    const originalImagePath = `./storage/${image.video_id}/original.${image.extension}`;
    const targetImagePath = `./storage/${image.video_id}/resized-${width}x${height}.${image.extension}`;

    // Find the operation
    const operation = await videoService.findOperation(imageId, 'resize-image', { width, height });

    try {
      // Update progress: Starting
      await bullJob.progress(10);

      // Update operation status to processing
      if (operation) {
        await videoService.updateOperationStatus(operation.id, 'processing');
      }

      // Resize image
      await bullJob.progress(25);
      await FF.resizeImage(originalImagePath, targetImagePath, width, height);

      // Update progress: Processing complete
      await bullJob.progress(75);

      // Update operation status to completed
      if (operation) {
        await videoService.updateOperationStatus(operation.id, 'completed', targetImagePath);
      }

      // Complete
      await bullJob.progress(100);

      console.log(`✅ Image resized to ${width}x${height}`);

      return JSON.stringify({ width, height });
    } catch (error) {
      console.error(`❌ Image resize failed:`, error);
      util.deleteFile(targetImagePath);

      // Update operation status to failed
      if (operation) {
        await videoService.updateOperationStatus(operation.id, 'failed', null, error.message);
      }

      throw error;
    }
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
