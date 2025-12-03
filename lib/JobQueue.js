const DB = require("../src/DB");
const FF = require("./FF");
const util = require("./util");

class JobQueue {
  constructor() {
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
    this.jobs.push(job);
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

        console.log(
          "Done resizing! Number of jobs remaining:",
          this.jobs.length
        );
      } catch (e) {
        util.deleteFile(targetVideoPath);
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
      }
    }

    this.currentJob = null;
    this.executeNext();
  }
}

module.exports = JobQueue;
