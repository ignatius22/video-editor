const DB = require("../src/DB");
const FF = require("./FF");
const util = require("./util");
const EventEmitter = require("events");

class JobQueue extends EventEmitter {
  constructor() {
    super(); // Initialize EventEmitter
    this.jobs = [];
    this.currentJob = null;

    // Loop through the videos and find all the processing true items, and
    // add them to the queue (enqueue)
    DB.update();
    DB.videos.forEach((video) => {
      // Restore resize jobs
      Object.keys(video.resizes).forEach((key) => {
        if (video.resizes[key].processing) {
          const [width, height] = key.split("x");
          this.enqueue({
            type: "resize",
            videoId: video.videoId,
            width,
            height,
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
              type: "convert",
              videoId: video.videoId,
              targetFormat: format,
              originalPath,
              convertedPath,
            });
          }
        });
      }
    });
  }

  enqueue(job) {
    // Add unique ID to job for tracking
    job.id = `${job.type}-${job.videoId}-${Date.now()}`;
    job.queuedAt = new Date().toISOString();

    this.jobs.push(job);

    // Emit event when job is queued
    this.emit('job:queued', {
      jobId: job.id,
      type: job.type,
      videoId: job.videoId,
      queuePosition: this.jobs.length,
      queuedAt: job.queuedAt
    });

    this.executeNext();
  }

  dequeue() {
    return this.jobs.shift();
  }

  executeNext() {
    if (this.currentJob) return;
    this.currentJob = this.dequeue();
    if (!this.currentJob) return;
    this.execute(this.currentJob);
  }

  async execute(job) {
    // Emit event when job starts processing
    job.startedAt = new Date().toISOString();
    this.emit('job:started', {
      jobId: job.id,
      type: job.type,
      videoId: job.videoId,
      startedAt: job.startedAt,
      queuedAt: job.queuedAt
    });

    if (job.type === "resize") {
      const { videoId, width, height } = job;

      DB.update();
      const video = DB.videos.find((video) => video.videoId === videoId);

      const originalVideoPath = `./storage/${video.videoId}/original.${video.extension}`;
      const targetVideoPath = `./storage/${video.videoId}/${width}x${height}.${video.extension}`;

      try {
        await FF.resize(originalVideoPath, targetVideoPath, width, height);

        DB.update();
        const video = DB.videos.find((video) => video.videoId === videoId);
        video.resizes[`${width}x${height}`].processing = false;
        DB.save();

        // Emit success event
        job.completedAt = new Date().toISOString();
        this.emit('job:completed', {
          jobId: job.id,
          type: job.type,
          videoId: job.videoId,
          result: { width, height },
          queuedAt: job.queuedAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          duration: new Date(job.completedAt) - new Date(job.startedAt)
        });

        console.log(
          "Done resizing! Number of jobs remaining:",
          this.jobs.length
        );
      } catch (e) {
        util.deleteFile(targetVideoPath);

        // Emit failure event with full job context for retry
        job.failedAt = new Date().toISOString();
        this.emit('job:failed', {
          jobId: job.id,
          type: job.type,
          videoId: job.videoId,
          width: job.width,
          height: job.height,
          error: e.message,
          stack: e.stack,
          queuedAt: job.queuedAt,
          startedAt: job.startedAt,
          failedAt: job.failedAt
        });
      }
    } else if (job.type === "convert") {
      const { videoId, targetFormat, originalPath, convertedPath } = job;

      try {
        await FF.convertFormat(originalPath, convertedPath, targetFormat);

        // Update database
        DB.update();
        const video = DB.videos.find((video) => video.videoId === videoId);
        if (!video.conversions) {
          video.conversions = {};
        }
        video.conversions[targetFormat] = {
          processing: false,
          completed: true,
          timestamp: new Date().toISOString(),
        };
        DB.save();

        // Emit success event
        job.completedAt = new Date().toISOString();
        this.emit('job:completed', {
          jobId: job.id,
          type: job.type,
          videoId: job.videoId,
          result: { targetFormat },
          queuedAt: job.queuedAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          duration: new Date(job.completedAt) - new Date(job.startedAt)
        });

        console.log(
          `✅ Video converted to ${targetFormat.toUpperCase()}! Number of jobs remaining:`,
          this.jobs.length
        );
      } catch (e) {
        console.error(`❌ Video conversion failed:`, e);
        util.deleteFile(convertedPath);

        // Mark as failed in database
        DB.update();
        const video = DB.videos.find((video) => video.videoId === videoId);
        if (video && video.conversions && video.conversions[targetFormat]) {
          video.conversions[targetFormat] = {
            processing: false,
            completed: false,
            error: e.message,
          };
          DB.save();
        }

        // Emit failure event with full job context for retry
        job.failedAt = new Date().toISOString();
        this.emit('job:failed', {
          jobId: job.id,
          type: job.type,
          videoId: job.videoId,
          targetFormat: job.targetFormat,
          originalPath: job.originalPath,
          convertedPath: job.convertedPath,
          error: e.message,
          stack: e.stack,
          queuedAt: job.queuedAt,
          startedAt: job.startedAt,
          failedAt: job.failedAt
        });
      }
    }

    this.currentJob = null;
    this.executeNext();
  }
}

module.exports = JobQueue;
