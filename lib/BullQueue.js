const Bull = require('bull');
const EventEmitter = require('events');
const DB = require('../src/DB');
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

    // Setup processors for different job types
    this.setupProcessors();

    // Setup Bull event listeners (translate to our custom events)
    this.setupBullEventListeners();

    // Restore incomplete jobs from database on startup
    this.restoreIncompleteJobs();

    console.log('[BullQueue] Initialized with Redis connection');
    console.log(`[BullQueue] Concurrency: ${this.CONCURRENCY} jobs in parallel`);
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
      this.queue.getJob(jobId).then(job => {
        if (job) {
          const completedAt = new Date().toISOString();
          const queuedAt = new Date(job.timestamp).toISOString();
          const startedAt = new Date(job.processedOn).toISOString();

          this.emit('job:completed', {
            jobId: job.id,
            type: job.name,
            videoId: job.data.videoId,
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
          const failedData = {
            jobId: job.id,
            type: job.name,
            videoId: job.data.videoId,
            error: err.message || err,
            stack: err.stack,
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
            videoId: job.data.videoId,
            progress: progress
          });
        }
      });
    });
  }

  async restoreIncompleteJobs() {
    // Restore resize jobs
    DB.update();
    DB.videos.forEach((video) => {
      Object.keys(video.resizes).forEach((key) => {
        if (video.resizes[key].processing) {
          const [width, height] = key.split('x');
          this.enqueue({
            type: 'resize',
            videoId: video.videoId,
            width,
            height
          });
        }
      });

      // Restore conversion jobs
      if (video.conversions) {
        Object.keys(video.conversions).forEach((format) => {
          if (video.conversions[format].processing) {
            const originalPath = `./storage/${video.videoId}/original.${video.extension}`;
            const convertedPath = `./storage/${video.videoId}/converted.${format}`;
            this.enqueue({
              type: 'convert',
              videoId: video.videoId,
              targetFormat: format,
              originalPath,
              convertedPath
            });
          }
        });
      }
    });
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

    DB.update();
    const video = DB.videos.find((v) => v.videoId === videoId);

    if (!video) {
      throw new Error(`Video ${videoId} not found`);
    }

    const originalVideoPath = `./storage/${video.videoId}/original.${video.extension}`;
    const targetVideoPath = `./storage/${video.videoId}/${width}x${height}.${video.extension}`;

    try {
      // Update progress: Starting
      await bullJob.progress(10);

      // Resize video
      await bullJob.progress(25);
      await FF.resize(originalVideoPath, targetVideoPath, width, height);

      // Update progress: Processing complete
      await bullJob.progress(75);

      // Update database
      DB.update();
      const updatedVideo = DB.videos.find((v) => v.videoId === videoId);
      updatedVideo.resizes[`${width}x${height}`].processing = false;
      DB.save();

      // Complete
      await bullJob.progress(100);

      console.log(`Done resizing ${videoId} to ${width}x${height}`);

      return JSON.stringify({ width, height });
    } catch (error) {
      util.deleteFile(targetVideoPath);
      throw error;
    }
  }

  async processConvert(bullJob) {
    const { videoId, targetFormat, originalPath, convertedPath } = bullJob.data;

    try {
      // Update progress: Starting
      await bullJob.progress(10);

      // Convert format
      await bullJob.progress(25);
      await FF.convertFormat(originalPath, convertedPath, targetFormat);

      // Update progress: Processing complete
      await bullJob.progress(75);

      // Update database
      DB.update();
      const video = DB.videos.find((v) => v.videoId === videoId);
      if (!video.conversions) {
        video.conversions = {};
      }
      video.conversions[targetFormat] = {
        processing: false,
        completed: true,
        timestamp: new Date().toISOString()
      };
      DB.save();

      // Complete
      await bullJob.progress(100);

      console.log(`✅ Video converted to ${targetFormat.toUpperCase()}`);

      return JSON.stringify({ targetFormat });
    } catch (error) {
      console.error(`❌ Video conversion failed:`, error);
      util.deleteFile(convertedPath);

      // Mark as failed in database
      DB.update();
      const video = DB.videos.find((v) => v.videoId === videoId);
      if (video && video.conversions && video.conversions[targetFormat]) {
        video.conversions[targetFormat] = {
          processing: false,
          completed: false,
          error: error.message
        };
        DB.save();
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
