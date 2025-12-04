const jobHistoryService = require("../../shared/database/services/jobHistoryService");

// Will be initialized in server.js
let bullQueue = null;

/**
 * Initialize the queue (called from server.js)
 */
function initQueue(queue) {
  bullQueue = queue;
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

module.exports = {
  initQueue,
  enqueueJob,
  getJobStatus,
  getQueueStats,
  getJobHistory
};
