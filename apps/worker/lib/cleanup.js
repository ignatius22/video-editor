const path = require('node:path');
const fs = require('node:fs/promises');
const videoService = require('@video-editor/shared/database/services/videoService');
const imageService = require('@video-editor/shared/database/services/imageService');
const util = require('@video-editor/shared/lib/util');
const config = require('@video-editor/shared/config');
const createLogger = require('@video-editor/shared/lib/logger');
const logger = createLogger('cleanup');

class StoragePruner {
  constructor() {
    this.storagePath = config.storage.path;
    // 24 hours for processed files
    this.PROCESSED_EXPIRY_MS = 24 * 60 * 60 * 1000;
    // 7 days for originals
    this.ORIGINAL_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
  }

  /**
   * Run all pruning tasks
   */
  async run() {
    logger.info('Starting storage cleanup task...');
    const startTime = Date.now();

    try {
      const stats = {
        videosDeleted: 0,
        videoOpsDeleted: 0,
        imagesDeleted: 0,
        imageOpsDeleted: 0,
        errors: 0
      };

      // 1. Prune processed video operations (> 24h)
      const oldVideoOps = await videoService.getExpiredOperations(new Date(Date.now() - this.PROCESSED_EXPIRY_MS));
      for (const op of oldVideoOps) {
        try {
          if (op.result_path) {
             await util.deleteFile(op.result_path);
          }
          await videoService.deleteOperation(op.id);
          stats.videoOpsDeleted++;
        } catch (err) {
          stats.errors++;
          logger.error({ err: err.message, opId: op.id }, 'Failed to prune video operation');
        }
      }

      // 2. Prune processed image operations (> 24h)
      const oldImageOps = await imageService.getExpiredOperations(new Date(Date.now() - this.PROCESSED_EXPIRY_MS));
      for (const op of oldImageOps) {
        try {
          if (op.result_path) {
            await util.deleteFile(op.result_path);
          }
          await imageService.deleteOperation(op.id);
          stats.imageOpsDeleted++;
        } catch (err) {
          stats.errors++;
          logger.error({ err: err.message, opId: op.id }, 'Failed to prune image operation');
        }
      }

      // 3. Prune old videos (> 7 days)
      const oldVideos = await videoService.getExpiredVideos(new Date(Date.now() - this.ORIGINAL_EXPIRY_MS));
      for (const video of oldVideos) {
        try {
          const folderPath = path.join(this.storagePath, video.video_id);
          await util.deleteFolder(folderPath);
          await videoService.deleteVideo(video.video_id);
          stats.videosDeleted++;
        } catch (err) {
          stats.errors++;
          logger.error({ err: err.message, videoId: video.video_id }, 'Failed to prune video');
        }
      }

      // 4. Prune old images (> 7 days)
      const oldImages = await imageService.getExpiredImages(new Date(Date.now() - this.ORIGINAL_EXPIRY_MS));
      for (const image of oldImages) {
        try {
          const folderPath = path.join(this.storagePath, image.image_id);
          await util.deleteFolder(folderPath);
          await imageService.deleteImage(image.image_id);
          stats.imagesDeleted++;
        } catch (err) {
          stats.errors++;
          logger.error({ err: err.message, imageId: image.image_id }, 'Failed to prune image');
        }
      }

      const duration = Date.now() - startTime;
      logger.info({ 
        ...stats, 
        durationMs: duration 
      }, 'Storage cleanup task completed');

      return stats;
    } catch (error) {
      logger.error({ err: error.message, stack: error.stack }, 'Storage cleanup task FAILED');
      throw error;
    }
  }
}

module.exports = new StoragePruner();
