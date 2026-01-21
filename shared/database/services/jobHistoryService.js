const { query } = require('../db');

/**
 * Job History Service
 * Handles Bull queue job tracking and analytics
 */
class JobHistoryService {
  /**
   * Create a new job record
   * @param {object} jobData - Job data
   * @returns {Promise<object>} Created job
   */
  async createJob({
    jobId,
    videoId,
    userId,
    type,
    status = 'queued',
    priority = 'normal',
    data = {},
    queuedAt = null
  }) {
    const result = await query(
      `INSERT INTO job_history (job_id, video_id, user_id, type, status, priority, data, queued_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        jobId,
        videoId,
        userId,
        type,
        status,
        priority,
        JSON.stringify(data),
        queuedAt || new Date().toISOString()
      ]
    );

    return result.rows[0];
  }

  /**
   * Update job status
   * @param {string} jobId - Job ID
   * @param {string} status - New status
   * @returns {Promise<object>} Updated job
   */
  async updateStatus(jobId, status) {
    const result = await query(
      `UPDATE job_history
       SET status = $1
       WHERE job_id = $2
       RETURNING *`,
      [status, jobId]
    );

    return result.rows[0];
  }

  /**
   * Mark job as started
   * @param {string} jobId - Job ID
   * @returns {Promise<object>} Updated job
   */
  async markStarted(jobId) {
    const result = await query(
      `UPDATE job_history
       SET status = 'active', started_at = CURRENT_TIMESTAMP
       WHERE job_id = $1
       RETURNING *`,
      [jobId]
    );

    return result.rows[0];
  }

  /**
   * Update job progress
   * @param {string} jobId - Job ID
   * @param {number} progress - Progress percentage (0-100)
   * @returns {Promise<object>} Updated job
   */
  async updateProgress(jobId, progress) {
    const result = await query(
      `UPDATE job_history
       SET progress = $1
       WHERE job_id = $2
       RETURNING *`,
      [progress, jobId]
    );

    return result.rows[0];
  }

  /**
   * Mark job as completed
   * @param {string} jobId - Job ID
   * @param {object} result - Job result
   * @returns {Promise<object>} Updated job
   */
  async markCompleted(jobId, resultData = {}) {
    const completedAt = new Date();

    const result = await query(
      `UPDATE job_history
       SET status = 'completed',
           progress = 100,
           result = $1,
           completed_at = $2,
           duration = EXTRACT(EPOCH FROM ($2 - started_at)) * 1000
       WHERE job_id = $3
       RETURNING *`,
      [JSON.stringify(resultData), completedAt, jobId]
    );

    return result.rows[0];
  }

  /**
   * Mark job as failed
   * @param {string} jobId - Job ID
   * @param {string} error - Error message
   * @param {string} stackTrace - Stack trace (optional)
   * @returns {Promise<object>} Updated job
   */
  async markFailed(jobId, error, stackTrace = null) {
    const result = await query(
      `UPDATE job_history
       SET status = 'failed',
           error = $1,
           stack_trace = $2,
           failed_at = CURRENT_TIMESTAMP,
           retry_count = retry_count + 1
       WHERE job_id = $3
       RETURNING *`,
      [error, stackTrace, jobId]
    );

    return result.rows[0];
  }

  /**
   * Find job by job_id
   * @param {string} jobId - Job ID
   * @returns {Promise<object|null>} Job or null
   */
  async findByJobId(jobId) {
    const result = await query(
      'SELECT * FROM job_history WHERE job_id = $1',
      [jobId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get jobs for a video
   * @param {string} videoId - Video ID
   * @returns {Promise<array>} List of jobs
   */
  async getVideoJobs(videoId) {
    const result = await query(
      `SELECT * FROM job_history
       WHERE video_id = $1
       ORDER BY created_at DESC`,
      [videoId]
    );

    return result.rows;
  }

  /**
   * Get jobs for a user
   * @param {number} userId - User ID
   * @param {object} options - Query options
   * @returns {Promise<array>} List of jobs
   */
  async getUserJobs(userId, options = {}) {
    const {
      limit = 50,
      offset = 0,
      status = null,
      type = null
    } = options;

    let query_text = `
      SELECT jh.*, v.name as video_name
      FROM job_history jh
      LEFT JOIN videos v ON jh.video_id = v.video_id
      WHERE jh.user_id = $1
    `;

    const params = [userId];
    let paramCount = 2;

    if (status) {
      query_text += ` AND jh.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (type) {
      query_text += ` AND jh.type = $${paramCount}`;
      params.push(type);
      paramCount++;
    }

    query_text += ` ORDER BY jh.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await query(query_text, params);
    return result.rows;
  }

  /**
   * Get job statistics
   * @param {object} filters - Optional filters (userId, videoId, dateRange)
   * @returns {Promise<object>} Job statistics
   */
  async getJobStats(filters = {}) {
    const { userId, videoId, startDate, endDate } = filters;

    let query_text = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'queued' THEN 1 END) as queued,
        AVG(CASE WHEN duration IS NOT NULL THEN duration END) as avg_duration,
        MIN(CASE WHEN duration IS NOT NULL THEN duration END) as min_duration,
        MAX(CASE WHEN duration IS NOT NULL THEN duration END) as max_duration,
        ROUND(
          COUNT(CASE WHEN status = 'completed' THEN 1 END)::numeric /
          NULLIF(COUNT(*), 0) * 100,
          2
        ) as success_rate
      FROM job_history
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (userId) {
      query_text += ` AND user_id = $${paramCount}`;
      params.push(userId);
      paramCount++;
    }

    if (videoId) {
      query_text += ` AND video_id = $${paramCount}`;
      params.push(videoId);
      paramCount++;
    }

    if (startDate) {
      query_text += ` AND created_at >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }

    if (endDate) {
      query_text += ` AND created_at <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }

    const result = await query(query_text, params);
    return result.rows[0] || {
      total: 0,
      completed: 0,
      failed: 0,
      active: 0,
      queued: 0,
      avg_duration: 0,
      min_duration: 0,
      max_duration: 0,
      success_rate: 0
    };
  }

  /**
   * Get job statistics by type
   * @param {object} filters - Optional filters
   * @returns {Promise<array>} Stats grouped by type
   */
  async getStatsByType(filters = {}) {
    const { userId, startDate, endDate } = filters;

    let query_text = `
      SELECT
        type,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        AVG(CASE WHEN duration IS NOT NULL THEN duration END) as avg_duration,
        ROUND(
          COUNT(CASE WHEN status = 'completed' THEN 1 END)::numeric /
          NULLIF(COUNT(*), 0) * 100,
          2
        ) as success_rate
      FROM job_history
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (userId) {
      query_text += ` AND user_id = $${paramCount}`;
      params.push(userId);
      paramCount++;
    }

    if (startDate) {
      query_text += ` AND created_at >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }

    if (endDate) {
      query_text += ` AND created_at <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }

    query_text += ` GROUP BY type ORDER BY total DESC`;

    const result = await query(query_text, params);
    return result.rows;
  }

  /**
   * Get recent failed jobs
   * @param {number} limit - Max jobs to return
   * @returns {Promise<array>} Recent failed jobs
   */
  async getRecentFailedJobs(limit = 20) {
    const result = await query(
      `SELECT jh.*, v.name as video_name, u.username
       FROM job_history jh
       LEFT JOIN videos v ON jh.video_id = v.video_id
       LEFT JOIN users u ON jh.user_id = u.id
       WHERE jh.status = 'failed'
       ORDER BY jh.failed_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  /**
   * Get slow jobs (duration > threshold)
   * @param {number} thresholdMs - Duration threshold in milliseconds
   * @param {number} limit - Max jobs to return
   * @returns {Promise<array>} Slow jobs
   */
  async getSlowJobs(thresholdMs = 60000, limit = 20) {
    const result = await query(
      `SELECT jh.*, v.name as video_name
       FROM job_history jh
       LEFT JOIN videos v ON jh.video_id = v.video_id
       WHERE jh.status = 'completed' AND jh.duration > $1
       ORDER BY jh.duration DESC
       LIMIT $2`,
      [thresholdMs, limit]
    );

    return result.rows;
  }

  /**
   * Get job timeline (jobs per day)
   * @param {number} days - Number of days to look back
   * @param {number} userId - User ID (optional)
   * @returns {Promise<array>} Daily job counts
   */
  async getJobTimeline(days = 30, userId = null) {
    const query_text = userId
      ? `SELECT
           DATE(created_at) as date,
           COUNT(*) as total,
           COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
           COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
           AVG(CASE WHEN duration IS NOT NULL THEN duration END) as avg_duration
         FROM job_history
         WHERE created_at > CURRENT_DATE - INTERVAL '${days} days'
           AND user_id = $1
         GROUP BY DATE(created_at)
         ORDER BY date DESC`
      : `SELECT
           DATE(created_at) as date,
           COUNT(*) as total,
           COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
           COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
           AVG(CASE WHEN duration IS NOT NULL THEN duration END) as avg_duration
         FROM job_history
         WHERE created_at > CURRENT_DATE - INTERVAL '${days} days'
         GROUP BY DATE(created_at)
         ORDER BY date DESC`;

    const params = userId ? [userId] : [];
    const result = await query(query_text, params);

    return result.rows;
  }

  /**
   * Clean up old completed jobs
   * @param {number} daysToKeep - Days to keep completed jobs
   * @returns {Promise<number>} Number of deleted jobs
   */
  async cleanupOldJobs(daysToKeep = 30) {
    const result = await query(
      `DELETE FROM job_history
       WHERE status = 'completed'
         AND completed_at < CURRENT_DATE - INTERVAL '${daysToKeep} days'
       RETURNING id`,
      []
    );

    return result.rowCount;
  }

  /**
   * Get active jobs count
   * @returns {Promise<number>} Number of active jobs
   */
  async getActiveJobsCount() {
    const result = await query(
      `SELECT COUNT(*) as count FROM job_history WHERE status = 'active'`,
      []
    );

    return parseInt(result.rows[0].count);
  }
}

module.exports = new JobHistoryService();
