/**
 * Span Attribute Builders
 * Semantic conventions for video processing operations
 */

const path = require('path');

/**
 * Build attributes for FFmpeg operations
 */
function buildFFmpegAttributes(operation, params) {
  const attributes = {
    'ffmpeg.operation': operation,
    'ffmpeg.command': 'ffmpeg',
  };

  switch (operation) {
    case 'makeThumbnail':
      attributes['ffmpeg.input.path'] = sanitizePath(params.fullPath);
      attributes['ffmpeg.output.path'] = sanitizePath(params.thumbnailPath);
      attributes['ffmpeg.thumbnail.timestamp'] = 5;
      break;

    case 'getDimensions':
      attributes['ffmpeg.command'] = 'ffprobe';
      attributes['ffmpeg.input.path'] = sanitizePath(params.fullPath);
      break;

    case 'extractAudio':
      attributes['ffmpeg.input.path'] = sanitizePath(params.originalVideoPath);
      attributes['ffmpeg.output.path'] = sanitizePath(params.targetAudioPath);
      attributes['ffmpeg.audio.codec'] = 'copy';
      break;

    case 'resize':
      attributes['ffmpeg.input.path'] = sanitizePath(params.originalVideoPath);
      attributes['ffmpeg.output.path'] = sanitizePath(params.targetVideoPath);
      attributes['ffmpeg.video.width'] = params.width;
      attributes['ffmpeg.video.height'] = params.height;
      attributes['ffmpeg.video.scale'] = `${params.width}x${params.height}`;
      break;

    case 'convertFormat':
      attributes['ffmpeg.input.path'] = sanitizePath(params.originalVideoPath);
      attributes['ffmpeg.output.path'] = sanitizePath(params.targetVideoPath);
      attributes['ffmpeg.input.format'] = getFileExtension(params.originalVideoPath);
      attributes['ffmpeg.output.format'] = params.targetFormat;
      if (params.videoCodec) {
        attributes['ffmpeg.video.codec'] = params.videoCodec;
      }
      if (params.audioCodec) {
        attributes['ffmpeg.audio.codec'] = params.audioCodec;
      }
      break;

    case 'watermarkVideo':
      attributes['ffmpeg.input.path'] = sanitizePath(params.originalVideoPath);
      attributes['ffmpeg.output.path'] = sanitizePath(params.targetVideoPath);
      attributes['ffmpeg.watermark.text'] = params.text;
      if (params.options) {
        attributes['ffmpeg.watermark.position'] = `${params.options.x || 0},${params.options.y || 0}`;
        attributes['ffmpeg.watermark.font_size'] = params.options.fontSize || 24;
      }
      break;

    case 'addImageWatermark':
      attributes['ffmpeg.input.path'] = sanitizePath(params.originalVideoPath);
      attributes['ffmpeg.watermark.path'] = sanitizePath(params.watermarkImagePath);
      attributes['ffmpeg.output.path'] = sanitizePath(params.targetVideoPath);
      if (params.options) {
        attributes['ffmpeg.watermark.position'] = params.options.position || 'bottom-right';
        attributes['ffmpeg.watermark.opacity'] = params.options.opacity || 1.0;
      }
      break;

    case 'trimVideo':
      attributes['ffmpeg.input.path'] = sanitizePath(params.originalVideoPath);
      attributes['ffmpeg.output.path'] = sanitizePath(params.targetVideoPath);
      attributes['ffmpeg.trim.start_time'] = params.startTime;
      attributes['ffmpeg.trim.end_time'] = params.endTime;
      attributes['ffmpeg.trim.duration'] = params.endTime - params.startTime;
      break;

    case 'createGif':
      attributes['ffmpeg.input.path'] = sanitizePath(params.originalVideoPath);
      attributes['ffmpeg.output.path'] = sanitizePath(params.targetGifPath);
      if (params.options) {
        attributes['ffmpeg.gif.fps'] = params.options.fps || 10;
        attributes['ffmpeg.gif.width'] = params.options.width || 480;
        if (params.options.startTime !== undefined) {
          attributes['ffmpeg.gif.start_time'] = params.options.startTime;
        }
        if (params.options.duration !== undefined) {
          attributes['ffmpeg.gif.duration'] = params.options.duration;
        }
      }
      break;

    case 'cropImage':
      attributes['ffmpeg.input.path'] = sanitizePath(params.originalImagePath);
      attributes['ffmpeg.output.path'] = sanitizePath(params.targetImagePath);
      attributes['ffmpeg.image.crop.width'] = params.width;
      attributes['ffmpeg.image.crop.height'] = params.height;
      attributes['ffmpeg.image.crop.x'] = params.x || 0;
      attributes['ffmpeg.image.crop.y'] = params.y || 0;
      break;

    case 'resizeImage':
      attributes['ffmpeg.input.path'] = sanitizePath(params.originalImagePath);
      attributes['ffmpeg.output.path'] = sanitizePath(params.targetImagePath);
      attributes['ffmpeg.image.width'] = params.width;
      attributes['ffmpeg.image.height'] = params.height;
      break;

    case 'convertImageFormat':
      attributes['ffmpeg.input.path'] = sanitizePath(params.originalImagePath);
      attributes['ffmpeg.output.path'] = sanitizePath(params.targetImagePath);
      attributes['ffmpeg.input.format'] = getFileExtension(params.originalImagePath);
      attributes['ffmpeg.output.format'] = params.targetFormat;
      break;
  }

  return attributes;
}

/**
 * Build attributes for Bull Queue jobs
 */
function buildQueueAttributes(jobData) {
  return {
    'queue.name': 'video-processing',
    'queue.job.type': jobData.type,
    'queue.job.id': jobData.jobId,
    'queue.job.priority': jobData.priority || 'normal',
    'video.id': jobData.videoId || jobData.imageId,
  };
}

/**
 * Build error attributes
 */
function buildErrorAttributes(error, exitCode = null) {
  // Handle both string and Error object
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorType = typeof error === 'string' ? 'Error' : (error.name || 'Error');

  const attributes = {
    'error': true,
    'error.type': errorType,
    'error.message': errorMessage,
  };

  if (typeof error === 'object' && error.stack) {
    attributes['error.stack'] = error.stack;
  }

  if (exitCode !== null) {
    attributes['ffmpeg.exit_code'] = exitCode;
  }

  return attributes;
}

/**
 * Sanitize file path (remove user data, keep structure)
 */
function sanitizePath(filePath) {
  if (!filePath) return '';

  // Replace storage path with placeholder
  const sanitized = filePath.replace(/^\.\/storage\//, '{storage}/');
  return path.basename(path.dirname(sanitized)) + '/' + path.basename(sanitized);
}

/**
 * Get file extension from path
 */
function getFileExtension(filePath) {
  return path.extname(filePath).substring(1).toLowerCase();
}

module.exports = {
  buildFFmpegAttributes,
  buildQueueAttributes,
  buildErrorAttributes,
};
