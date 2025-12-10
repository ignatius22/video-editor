const jobHistoryService = require("../../database/services/jobHistoryService");
const Bull = require('bull');

// Create a Bull queue connection for workers to query stats
const queueConnection = new Bull('video-processing', {
  redis: {
    host: 'localhost',
    port: 6379
  }
});

/**
 * Get queue statistics
 * Returns real-time data about job queue status
 */
exports.getQueueStats = async (req, res, next) => {
  try {
    // Workers can query the queue stats directly through Redis
    // No need to access the primary process queue instance
    const [waiting, active, completed, failed] = await Promise.all([
      queueConnection.getWaitingCount(),
      queueConnection.getActiveCount(),
      queueConnection.getCompletedCount(),
      queueConnection.getFailedCount()
    ]);

    res.json({
      stats: {
        waiting,
        active,
        completed,
        failed,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("[Job Controller] Error getting queue stats:", error);
    // Return zeros if there's an error
    res.json({
      stats: {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Get job history from database
 * Returns historical job data (not dummy data)
 */
exports.getJobHistory = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    // Get real job history from database
    const jobs = await jobHistoryService.getRecentJobs(limit, offset);

    res.json({
      jobs,
      count: jobs.length,
      limit,
      offset
    });
  } catch (error) {
    console.error("[Job Controller] Error getting job history:", error);
    next(error);
  }
};

/**
 * Get detailed job statistics
 * Aggregated analytics from database
 */
exports.getJobStatistics = async (req, res, next) => {
  try {
    const timeRange = req.query.range || '24h'; // '24h', '7d', '30d'

    // Calculate time range
    const now = new Date();
    let startTime = new Date();

    switch (timeRange) {
      case '1h':
        startTime = new Date(now - 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now - 24 * 60 * 60 * 1000);
    }

    // Get statistics from database
    const stats = await jobHistoryService.getJobStatistics(startTime, now);

    res.json({
      timeRange,
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
      statistics: stats
    });
  } catch (error) {
    console.error("[Job Controller] Error getting job statistics:", error);
    next(error);
  }
};