const jobHistoryService = require("../../shared/database/services/jobHistoryService");
const { EventTypes } = require("../../shared/eventBus");

// Will be initialized in server.js
let bullQueue = null;
let eventBus = null;

/**
 * Initialize the queue (called from server.js)
 */
function initQueue(queue) {
  bullQueue = queue;
}

/**
 * Initialize the event bus (called from server.js)
 */
function initEventBus(bus) {
  eventBus = bus;
}

/**
 * Handle VIDEO_PROCESSING_REQUESTED or IMAGE_PROCESSING_REQUESTED event
 * Called by event subscriber in server.js
 */
async function handleProcessingRequest(data, metadata) {
  const { videoId, imageId, userId, operation, parameters } = data;
  const resourceId = videoId || imageId;
  const resourceType = videoId ? 'video' : 'image';

  console.log(`[Job Controller] Handling ${resourceType} processing request:`, {
    resourceId,
    operation,
    parameters,
    correlationId: metadata.correlationId
  });

  try {
    // Enqueue the job in Bull queue
    const jobData = {
      type: operation,
      userId,
      ...parameters,
      correlationId: metadata.correlationId
    };

    // Add the appropriate ID field
    if (videoId) {
      jobData.videoId = videoId;
    } else if (imageId) {
      jobData.imageId = imageId;
    }

    const jobId = await bullQueue.enqueue(jobData);

    console.log(`[Job Controller] Job enqueued: ${jobId} for ${resourceType} ${resourceId}`);

    // Publish JOB_CREATED event
    if (eventBus && eventBus.connected) {
      const eventData = {
        jobId,
        userId,
        operation,
        parameters
      };

      // Add the appropriate ID field to event
      if (videoId) {
        eventData.videoId = videoId;
      } else if (imageId) {
        eventData.imageId = imageId;
      }

      await eventBus.publish(EventTypes.JOB_CREATED, eventData, {
        correlationId: metadata.correlationId
      });
    }

    return jobId;
  } catch (error) {
    console.error('[Job Controller] Failed to enqueue job:', error);
    throw error;
  }
}

/**
 * Enqueue a new job
 * POST /enqueue
 */
const enqueueJob = async (req, res) => {
  const { type, videoId, ...params } = req.body;

  if (!type) {
    return res.status(400).json({ error: "Job type is required" });
  }

  if (!videoId) {
    return res.status(400).json({ error: "Video ID is required" });
  }

  try {
    const jobId = await bullQueue.enqueue({ type, videoId, ...params });

    res.status(202).json({
      status: "queued",
      jobId,
      message: `Job ${type} queued for video ${videoId}`
    });
  } catch (error) {
    console.error("[Job Service] Enqueue error:", error);
    res.status(500).json({
      error: "Failed to enqueue job",
      details: error.message
    });
  }
};

/**
 * Get job status
 * GET /status/:jobId
 */
const getJobStatus = async (req, res) => {
  const { jobId } = req.params;

  try {
    const job = await bullQueue.queue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    const state = await job.getState();
    const progress = job.progress();

    res.json({
      jobId: job.id,
      type: job.data.type,
      videoId: job.data.videoId,
      state,
      progress,
      data: job.data,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason
    });
  } catch (error) {
    console.error("[Job Service] Get job status error:", error);
    res.status(500).json({
      error: "Failed to get job status",
      details: error.message
    });
  }
};

/**
 * Get queue statistics
 * GET /queue/stats
 */
const getQueueStats = async (req, res) => {
  try {
    const waiting = await bullQueue.queue.getWaitingCount();
    const active = await bullQueue.queue.getActiveCount();
    const completed = await bullQueue.queue.getCompletedCount();
    const failed = await bullQueue.queue.getFailedCount();
    const delayed = await bullQueue.queue.getDelayedCount();

    res.json({
      queue: "video-processing",
      stats: {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed
      },
      concurrency: bullQueue.CONCURRENCY
    });
  } catch (error) {
    console.error("[Job Service] Get queue stats error:", error);
    res.status(500).json({
      error: "Failed to get queue stats",
      details: error.message
    });
  }
};

/**
 * Get job history
 * GET /history
 */
const getJobHistory = async (req, res) => {
  const { videoId, userId, limit = 50, offset = 0 } = req.query;

  try {
    const filters = {};
    if (videoId) filters.videoId = videoId;
    if (userId) filters.userId = userId;

    const jobs = await jobHistoryService.getJobHistory({
      ...filters,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      jobs,
      count: jobs.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error("[Job Service] Get job history error:", error);
    res.status(500).json({
      error: "Failed to get job history",
      details: error.message
    });
  }
};

/**
 * Get comprehensive analytics
 * GET /analytics
 */
const getAnalytics = async (req, res) => {
  const { days = 7 } = req.query;

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get overall job statistics
    const overallStats = await jobHistoryService.getJobStats({ startDate });

    // Get statistics by operation type
    const statsByType = await jobHistoryService.getStatsByType({ startDate });

    // Get job timeline (daily breakdown)
    const timeline = await jobHistoryService.getJobTimeline(parseInt(days));

    // Get current queue status
    const waiting = await bullQueue.queue.getWaitingCount();
    const active = await bullQueue.queue.getActiveCount();
    const completed = await bullQueue.queue.getCompletedCount();
    const failed = await bullQueue.queue.getFailedCount();

    // Get recent failed jobs
    const recentFailures = await jobHistoryService.getRecentFailedJobs(10);

    // Get upload counts from the database
    const videoService = require("../../shared/database/services/videoService");
    const uploadStats = await videoService.getUploadStats({ startDate });

    res.json({
      period: {
        days: parseInt(days),
        startDate,
        endDate: new Date()
      },
      overall: {
        total: parseInt(overallStats.total) || 0,
        completed: parseInt(overallStats.completed) || 0,
        failed: parseInt(overallStats.failed) || 0,
        active: parseInt(overallStats.active) || 0,
        queued: parseInt(overallStats.queued) || 0,
        avgDuration: parseFloat(overallStats.avg_duration) || 0,
        successRate: parseFloat(overallStats.success_rate) || 0
      },
      queue: {
        waiting,
        active,
        completed,
        failed,
        total: waiting + active + completed + failed
      },
      byOperation: statsByType.map(stat => ({
        operation: stat.type,
        total: parseInt(stat.total),
        completed: parseInt(stat.completed),
        failed: parseInt(stat.failed),
        avgDuration: parseFloat(stat.avg_duration) || 0,
        successRate: parseFloat(stat.success_rate) || 0
      })),
      timeline: timeline.map(day => ({
        date: day.date,
        total: parseInt(day.total),
        completed: parseInt(day.completed),
        failed: parseInt(day.failed),
        avgDuration: parseFloat(day.avg_duration) || 0
      })),
      uploads: {
        totalVideos: uploadStats.totalVideos || 0,
        totalImages: uploadStats.totalImages || 0,
        recentVideos: uploadStats.recentVideos || 0,
        recentImages: uploadStats.recentImages || 0
      },
      recentFailures: recentFailures.slice(0, 5).map(job => ({
        jobId: job.job_id,
        operation: job.type,
        error: job.error,
        failedAt: job.failed_at,
        videoId: job.video_id
      }))
    });
  } catch (error) {
    console.error("[Job Service] Get analytics error:", error);
    res.status(500).json({
      error: "Failed to get analytics",
      details: error.message
    });
  }
};

module.exports = {
  initQueue,
  initEventBus,
  handleProcessingRequest,
  enqueueJob,
  getJobStatus,
  getQueueStats,
  getJobHistory,
  getAnalytics
};
