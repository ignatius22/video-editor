const { query, transaction } = require('../db');

/**
 * Image Service
 * Handles all image-related database operations
 */
class ImageService {
  /**
   * Create a new image
   * @param {object} imageData - Image data
   * @returns {Promise<object>} Created image
   */
  async createImage({ imageId, userId, name, extension, dimensions = null, metadata = {} }) {
    const result = await query(
      `INSERT INTO images (image_id, user_id, name, extension, dimensions, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, image_id, user_id, name, extension, dimensions, metadata, created_at`,
      [imageId, userId, name, extension, JSON.stringify(dimensions), JSON.stringify(metadata)]
    );

    return result.rows[0];
  }

  /**
   * Find image by image_id
   * @param {string} imageId - Image ID
   * @returns {Promise<object|null>} Image object or null
   */
  async findByImageId(imageId) {
    const result = await query(
      'SELECT * FROM images WHERE image_id = $1',
      [imageId]
    );

    return result.rows[0] || null;
  }

  /**
   * Find image by ID
   * @param {number} id - Database ID
   * @returns {Promise<object|null>} Image object or null
   */
  async findById(id) {
    const result = await query(
      'SELECT * FROM images WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Get all images for a user
   * @param {number} userId - User ID
   * @param {object} options - Query options (limit, offset, orderBy)
   * @returns {Promise<array>} List of images
   */
  async getUserImages(userId, options = {}) {
    const {
      limit = 50,
      offset = 0,
      orderBy = 'created_at',
      order = 'DESC'
    } = options;

    const result = await query(
      `SELECT i.*,
              COUNT(DISTINCT io.id) as operations_count,
              COUNT(DISTINCT CASE WHEN io.status = 'completed' THEN io.id END) as completed_operations
       FROM images i
       LEFT JOIN image_operations io ON i.image_id = io.image_id
       WHERE i.user_id = $1
       GROUP BY i.id
       ORDER BY i.${orderBy} ${order}
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    // Fetch operations for each image and transform data for client compatibility
    const images = await Promise.all(result.rows.map(async (image) => {
      const operations = await this.getImageOperations(image.image_id);

      // Build crops object from crop operations
      const crops = {};
      operations
        .filter(op => op.operation_type === 'crop')
        .forEach(op => {
          const { width, height, x, y } = op.parameters;
          const key = `${width}x${height}x${x}x${y}`;
          crops[key] = {
            processing: op.status === 'processing' || op.status === 'pending',
            completed: op.status === 'completed',
            failed: op.status === 'failed',
            status: op.status,
            parameters: op.parameters
          };
        });

      // Build resizes object from resize operations
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
        .filter(op => op.operation_type === 'convert-image')
        .forEach(op => {
          const { targetFormat } = op.parameters;
          conversions[targetFormat] = {
            processing: op.status === 'processing' || op.status === 'pending',
            completed: op.status === 'completed',
            failed: op.status === 'failed',
            status: op.status
          };
        });

      // Transform for client compatibility
      return {
        ...image,
        imageId: image.image_id, // Client expects imageId (camelCase)
        crops,
        resizes,
        conversions
      };
    }));

    return images;
  }

  /**
   * Update image metadata
   * @param {string} imageId - Image ID
   * @param {object} updates - Fields to update
   * @returns {Promise<object>} Updated image
   */
  async updateImage(imageId, updates) {
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

    values.push(imageId);

    const result = await query(
      `UPDATE images SET ${fields.join(', ')}
       WHERE image_id = $${paramCount}
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  /**
   * Delete image
   * @param {string} imageId - Image ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteImage(imageId) {
    await query('DELETE FROM images WHERE image_id = $1', [imageId]);
    return true;
  }

  /**
   * Add image operation (crop, resize)
   * @param {string} imageId - Image ID
   * @param {object} operationData - Operation details
   * @returns {Promise<object>} Created operation
   */
  async addOperation(imageId, { type, status = 'pending', parameters, resultPath = null, errorMessage = null }) {
    const result = await query(
      `INSERT INTO image_operations (image_id, operation_type, status, parameters, result_path, error_message)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [imageId, type, status, JSON.stringify(parameters), resultPath, errorMessage]
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
      `UPDATE image_operations
       SET status = $1, result_path = $2, error_message = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [status, resultPath, errorMessage, operationId]
    );

    return result.rows[0];
  }

  /**
   * Get all operations for an image
   * @param {string} imageId - Image ID
   * @returns {Promise<array>} List of operations
   */
  async getImageOperations(imageId) {
    const result = await query(
      `SELECT * FROM image_operations
       WHERE image_id = $1
       ORDER BY created_at ASC`,
      [imageId]
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
      `SELECT io.*, i.name as image_name, i.extension as image_extension
       FROM image_operations io
       JOIN images i ON io.image_id = i.image_id
       WHERE io.status = 'pending'
       ORDER BY io.created_at ASC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  /**
   * Find operation by image and parameters
   * @param {string} imageId - Image ID
   * @param {string} type - Operation type
   * @param {object} parameters - Operation parameters
   * @returns {Promise<object|null>} Operation or null
   */
  async findOperation(imageId, type, parameters) {
    const result = await query(
      `SELECT * FROM image_operations
       WHERE image_id = $1 AND operation_type = $2 AND parameters @> $3::jsonb AND parameters <@ $3::jsonb
       ORDER BY created_at DESC
       LIMIT 1`,
      [imageId, type, JSON.stringify(parameters)]
    );

    return result.rows[0] || null;
  }

  /**
   * Get image statistics
   * @param {string} imageId - Image ID
   * @returns {Promise<object>} Image statistics
   */
  async getImageStats(imageId) {
    const result = await query(
      `SELECT
         COUNT(*) as total_operations,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_operations,
         COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_operations,
         COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_operations,
         COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_operations
       FROM image_operations
       WHERE image_id = $1`,
      [imageId]
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
   * Search images by name
   * @param {number} userId - User ID
   * @param {string} searchTerm - Search term
   * @param {number} limit - Max results
   * @returns {Promise<array>} Matching images
   */
  async searchImages(userId, searchTerm, limit = 20) {
    const result = await query(
      `SELECT * FROM images
       WHERE user_id = $1 AND name ILIKE $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [userId, `%${searchTerm}%`, limit]
    );

    return result.rows;
  }

  /**
   * Get total image count for user
   * @param {number} userId - User ID
   * @returns {Promise<number>} Total images
   */
  async getUserImageCount(userId) {
    const result = await query(
      'SELECT COUNT(*) as count FROM images WHERE user_id = $1',
      [userId]
    );

    return parseInt(result.rows[0].count);
  }

  /**
   * Get images with pending operations
   * @param {number} userId - User ID (optional)
   * @returns {Promise<array>} Images with pending operations
   */
  async getImagesWithPendingOperations(userId = null) {
    const query_text = userId
      ? `SELECT DISTINCT i.*
         FROM images i
         JOIN image_operations io ON i.image_id = io.image_id
         WHERE i.user_id = $1 AND io.status IN ('pending', 'processing')
         ORDER BY i.created_at DESC`
      : `SELECT DISTINCT i.*
         FROM images i
         JOIN image_operations io ON i.image_id = io.image_id
         WHERE io.status IN ('pending', 'processing')
         ORDER BY i.created_at DESC`;

    const params = userId ? [userId] : [];
    const result = await query(query_text, params);

    return result.rows;
  }
}

module.exports = new ImageService();
