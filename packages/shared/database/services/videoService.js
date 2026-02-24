const { query, transaction } = require('../db');

/**
 * Video Service
 * Handles all video-related database operations
 */
class VideoService {
  /**
   * Create a new video
   * @param {object} videoData - Video data
   * @returns {Promise<object>} Created video
   */
  async createVideo({ videoId, userId, name, extension, dimensions = null, metadata = {} }) {
    const result = await query(
      `INSERT INTO videos (video_id, user_id, name, extension, dimensions, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, video_id, user_id, name, extension, dimensions, metadata, created_at`,
      [videoId, userId, name, extension, JSON.stringify(dimensions), JSON.stringify(metadata)]
    );

    return result.rows[0];
  }

  /**
   * Find video by video_id
   * @param {string} videoId - Video ID
   * @returns {Promise<object|null>} Video object or null
   */
  async findByVideoId(videoId) {
    const result = await query(
      'SELECT * FROM videos WHERE video_id = $1',
      [videoId]
    );

    return result.rows[0] || null;
  }

  /**
   * Find video by ID
   * @param {number} id - Database ID
   * @returns {Promise<object|null>} Video object or null
   */
  async findById(id) {
    const result = await query(
      'SELECT * FROM videos WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Get all videos for a user
   * @param {number} userId - User ID
   * @param {object} options - Query options (limit, offset, orderBy)
   * @returns {Promise<array>} List of videos
   */
  async getUserVideos(userId, options = {}) {
    const {
      limit = 50,
      offset = 0,
      orderBy = 'created_at',
      order = 'DESC'
    } = options;

    const result = await query(
      `SELECT v.*,
              COUNT(DISTINCT vo.id) as operations_count,
              COUNT(DISTINCT CASE WHEN vo.status = 'completed' THEN vo.id END) as completed_operations
       FROM videos v
       LEFT JOIN video_operations vo ON v.video_id = vo.video_id
       WHERE v.user_id = $1
       GROUP BY v.id
       ORDER BY v.${orderBy} ${order}
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    // Fetch operations for each video and transform data for client compatibility
    const videos = await Promise.all(result.rows.map(async (video) => {
      const operations = await this.getVideoOperations(video.video_id);

      // Build resizes object from resize operations
      const resizes = {};
      operations
        .filter(op => op.operation_type === 'resize')
        .forEach(op => {
          const { width, height } = op.parameters;
          const key = `${width}x${height}`;
          resizes[key] = {
            processing: op.status === 'processing' || op.status === 'pending',
            completed: op.status === 'completed',
            failed: op.status === 'failed',
            status: op.status
          };
        });

      // Build conversions object from convert operations
      const conversions = {};
      operations
        .filter(op => op.operation_type === 'convert')
        .forEach(op => {
          const { targetFormat } = op.parameters;
          conversions[targetFormat] = {
            processing: op.status === 'processing' || op.status === 'pending',
            completed: op.status === 'completed',
            failed: op.status === 'failed',
            status: op.status,
            timestamp: op.updated_at
          };
        });

      // Transform for client compatibility
      return {
        ...video,
        videoId: video.video_id, // Client expects videoId (camelCase)
        resizes,
        conversions,
        extractedAudio: video.metadata?.extractedAudio || false
      };
    }));

    return videos;
  }

  /**
   * Update video metadata
   * @param {string} videoId - Video ID
   * @param {object} updates - Fields to update
   * @returns {Promise<object>} Updated video
   */
  async updateVideo(videoId, updates) {
    const allowedFields = ['name', 'dimensions', 'metadata'];
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        if (key === 'dimensions' || key === 'metadata') {
          fields.push(`${key} = $${paramCount}`);
          values.push(JSON.stringify(updates[key]));
        } else {
          fields.push(`${key} = $${paramCount}`);
          values.push(updates[key]);
        }
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(videoId);

    const result = await query(
      `UPDATE videos SET ${fields.join(', ')}
       WHERE video_id = $${paramCount}
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  /**
   * Delete video
   * @param {string} videoId - Video ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteVideo(videoId) {
    await query('DELETE FROM videos WHERE video_id = $1', [videoId]);
    return true;
  }

  /**
   * Add video operation (resize, convert, extract_audio)
   * @param {string} videoId - Video ID
   * @param {object} operationData - Operation details
   * @returns {Promise<object>} Created operation
   */
  async addOperation(videoId, { type, status = 'pending', parameters, resultPath = null, errorMessage = null }) {
    const result = await query(
      `INSERT INTO video_operations (video_id, operation_type, status, parameters, result_path, error_message)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [videoId, type, status, JSON.stringify(parameters), resultPath, errorMessage]
    );

    return result.rows[0];
  }

  /**
   * Update operation status
   * @param {number} operationId - Operation ID
   * @param {string} status - New status
   * @param {string} resultPath - Result file path (optional)
   * @param {string} errorMessage - Error message (optional)
   * @returns {Promise<object>} Updated operation
   */
  async updateOperationStatus(operationId, status, resultPath = null, errorMessage = null) {
    const result = await query(
      `UPDATE video_operations
       SET status = $1, result_path = $2, error_message = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [status, resultPath, errorMessage, operationId]
    );

    return result.rows[0];
  }

  /**
   * Get all operations for a video
   * @param {string} videoId - Video ID
   * @returns {Promise<array>} List of operations
   */
  async getVideoOperations(videoId) {
    const result = await query(
      `SELECT * FROM video_operations
       WHERE video_id = $1
       ORDER BY created_at DESC`,
      [videoId]
    );

    return result.rows;
  }

  /**
   * Get pending operations
   * @param {number} limit - Max operations to return
   * @returns {Promise<array>} List of pending operations
   */
  async getPendingOperations(limit = 100) {
    const result = await query(
      `SELECT vo.*, v.name as video_name, v.extension as video_extension
       FROM video_operations vo
       JOIN videos v ON vo.video_id = v.video_id
       WHERE vo.status = 'pending'
       ORDER BY vo.created_at ASC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  /**
   * Find operation by video and parameters
   * @param {string} videoId - Video ID
   * @param {string} type - Operation type
   * @param {object} parameters - Operation parameters
   * @returns {Promise<object|null>} Operation or null
   */
  async findOperation(videoId, type, parameters) {
    const result = await query(
      `SELECT * FROM video_operations
       WHERE video_id = $1 AND operation_type = $2 AND parameters = $3
       ORDER BY created_at DESC
       LIMIT 1`,
      [videoId, type, JSON.stringify(parameters)]
    );

    return result.rows[0] || null;
  }

  /**
   * Get video statistics
   * @param {string} videoId - Video ID
   * @returns {Promise<object>} Video statistics
   */
  async getVideoStats(videoId) {
    const result = await query(
      `SELECT
         COUNT(*) as total_operations,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_operations,
         COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_operations,
         COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_operations,
         COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_operations
       FROM video_operations
       WHERE video_id = $1`,
      [videoId]
    );

    return result.rows[0] || {
      total_operations: 0,
      completed_operations: 0,
      failed_operations: 0,
      processing_operations: 0,
      pending_operations: 0
    };
  }

  /**
   * Search videos by name
   * @param {number} userId - User ID
   * @param {string} searchTerm - Search term
   * @param {number} limit - Max results
   * @returns {Promise<array>} Matching videos
   */
  async searchVideos(userId, searchTerm, limit = 20) {
    const result = await query(
      `SELECT * FROM videos
       WHERE user_id = $1 AND name ILIKE $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [userId, `%${searchTerm}%`, limit]
    );

    return result.rows;
  }

  /**
   * Get total video count for user
   * @param {number} userId - User ID
   * @returns {Promise<number>} Total videos
   */
  async getUserVideoCount(userId) {
    const result = await query(
      'SELECT COUNT(*) as count FROM videos WHERE user_id = $1',
      [userId]
    );

    return parseInt(result.rows[0].count);
  }

  /**
   * Get videos with pending operations
   * @param {number} userId - User ID (optional)
   * @returns {Promise<array>} Videos with pending operations
   */
  async getVideosWithPendingOperations(userId = null) {
    const query_text = userId
      ? `SELECT DISTINCT v.*
         FROM videos v
         JOIN video_operations vo ON v.video_id = vo.video_id
         WHERE v.user_id = $1 AND vo.status IN ('pending', 'processing')
         ORDER BY v.created_at DESC`
      : `SELECT DISTINCT v.*
         FROM videos v
         JOIN video_operations vo ON v.video_id = vo.video_id
         WHERE vo.status IN ('pending', 'processing')
         ORDER BY v.created_at DESC`;

    const params = userId ? [userId] : [];
    const result = await query(query_text, params);

    return result.rows;
  }

  /**
   * Get upload statistics
   * @param {object} options - Optional filters (startDate, userId)
   * @returns {Promise<object>} Upload statistics
   */
  async getUploadStats(options = {}) {
    const { startDate, userId } = options;

    let query_text = `
      SELECT
        COUNT(*) FILTER (WHERE metadata->>'type' = 'video' OR metadata->>'type' IS NULL) as total_videos,
        COUNT(*) FILTER (WHERE metadata->>'type' = 'image') as total_images,
        COUNT(*) FILTER (WHERE (metadata->>'type' = 'video' OR metadata->>'type' IS NULL) AND created_at >= $1) as recent_videos,
        COUNT(*) FILTER (WHERE metadata->>'type' = 'image' AND created_at >= $1) as recent_images
      FROM videos
      WHERE 1=1
    `;

    const params = [startDate || new Date(0)];
    let paramCount = 2;

    if (userId) {
      query_text += ` AND user_id = $${paramCount}`;
      params.push(userId);
    }

    const result = await query(query_text, params);

    return {
      totalVideos: parseInt(result.rows[0].total_videos) || 0,
      totalImages: parseInt(result.rows[0].total_images) || 0,
      recentVideos: parseInt(result.rows[0].recent_videos) || 0,
      recentImages: parseInt(result.rows[0].recent_images) || 0
    };
  }

  /**
   * Get videos older than a specific date for pruning
   * @param {Date} olderThan - Pruning threshold
   * @returns {Promise<array>} List of old videos
   */
  async getExpiredVideos(olderThan) {
    const result = await query(
      'SELECT * FROM videos WHERE created_at < $1',
      [olderThan]
    );
    return result.rows;
  }

  /**
   * Get operations older than a specific date for pruning
   * @param {Date} olderThan - Pruning threshold
   * @returns {Promise<array>} List of old operations
   */
  async getExpiredOperations(olderThan) {
    const result = await query(
      `SELECT * FROM video_operations 
       WHERE created_at < $1 AND status = 'completed'`,
      [olderThan]
    );
    return result.rows;
  }

  /**
   * Delete a specific operation record
   * @param {number} operationId - Operation database ID
   */
  async deleteOperation(operationId) {
    await query('DELETE FROM video_operations WHERE id = $1', [operationId]);
  }
}

module.exports = new VideoService();
