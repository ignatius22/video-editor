/**
 * FFmpeg Instrumentation
 * Wraps FFmpeg operations with OpenTelemetry spans
 */

const api = require('@opentelemetry/api');
const { buildFFmpegAttributes, buildErrorAttributes } = require('../utils/attributes');
const config = require('../config');

const tracer = api.trace.getTracer('ffmpeg-instrumentation', '1.0.0');

/**
 * Wrap an FFmpeg operation with a span
 * @param {string} operationName - Name of the FFmpeg operation
 * @param {Function} operation - Async function that executes FFmpeg
 * @param {Object} params - Parameters passed to the operation
 */
async function instrumentFFmpegOperation(operationName, operation, params) {
  // If telemetry disabled, execute without instrumentation
  if (!config.enabled) {
    return await operation();
  }

  return await tracer.startActiveSpan(`ffmpeg.${operationName}`, async (span) => {
    try {
      // Set span attributes
      const attributes = buildFFmpegAttributes(operationName, params);
      span.setAttributes(attributes);

      // Execute the FFmpeg operation
      const startTime = Date.now();
      const result = await operation();
      const duration = Date.now() - startTime;

      // Add success attributes
      span.setAttribute('ffmpeg.duration_ms', duration);
      span.setAttribute('ffmpeg.exit_code', 0);

      span.setStatus({ code: api.SpanStatusCode.OK });

      return result;
    } catch (error) {
      // Convert string errors to Error objects (FF.js rejects with strings)
      const errorObj = typeof error === 'string' ? new Error(error) : error;
      const errorMessage = typeof error === 'string' ? error : error.message;

      // Extract exit code from error message if present
      const exitCodeMatch = errorMessage?.match(/code:\s*(\d+)/);
      const exitCode = exitCodeMatch ? parseInt(exitCodeMatch[1]) : null;

      // Set error attributes
      const errorAttributes = buildErrorAttributes(errorObj, exitCode);
      span.setAttributes(errorAttributes);

      // Record exception
      span.recordException(errorObj);
      span.setStatus({
        code: api.SpanStatusCode.ERROR,
        message: errorMessage,
      });

      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Create an instrumented version of the FF module
 */
function createInstrumentedFF(FF) {
  return {
    makeThumbnail: (fullPath, thumbnailPath) => {
      return instrumentFFmpegOperation(
        'makeThumbnail',
        () => FF.makeThumbnail(fullPath, thumbnailPath),
        { fullPath, thumbnailPath }
      );
    },

    getDimensions: (fullPath) => {
      return instrumentFFmpegOperation(
        'getDimensions',
        () => FF.getDimensions(fullPath),
        { fullPath }
      );
    },

    extractAudio: (originalVideoPath, targetAudioPath) => {
      return instrumentFFmpegOperation(
        'extractAudio',
        () => FF.extractAudio(originalVideoPath, targetAudioPath),
        { originalVideoPath, targetAudioPath }
      );
    },

    resize: (originalVideoPath, targetVideoPath, width, height) => {
      return instrumentFFmpegOperation(
        'resize',
        () => FF.resize(originalVideoPath, targetVideoPath, width, height),
        { originalVideoPath, targetVideoPath, width, height }
      );
    },

    convertFormat: (originalVideoPath, targetVideoPath, targetFormat) => {
      // Determine codec based on format (matching FF.js logic)
      let videoCodec, audioCodec;
      switch (targetFormat.toLowerCase()) {
        case 'mp4':
        case 'mov':
          videoCodec = 'libx264';
          audioCodec = 'aac';
          break;
        case 'avi':
          videoCodec = 'mpeg4';
          audioCodec = 'libmp3lame';
          break;
        case 'webm':
          videoCodec = 'libvpx-vp9';
          audioCodec = 'libopus';
          break;
        case 'mkv':
          videoCodec = 'libx264';
          audioCodec = 'aac';
          break;
        default:
          videoCodec = 'libx264';
          audioCodec = 'aac';
      }

      return instrumentFFmpegOperation(
        'convertFormat',
        () => FF.convertFormat(originalVideoPath, targetVideoPath, targetFormat),
        { originalVideoPath, targetVideoPath, targetFormat, videoCodec, audioCodec }
      );
    },

    watermarkVideo: (originalVideoPath, targetVideoPath, text, options = {}) => {
      return instrumentFFmpegOperation(
        'watermarkVideo',
        () => FF.watermarkVideo(originalVideoPath, targetVideoPath, text, options),
        { originalVideoPath, targetVideoPath, text, options }
      );
    },

    addImageWatermark: (originalVideoPath, watermarkImagePath, targetVideoPath, options = {}) => {
      return instrumentFFmpegOperation(
        'addImageWatermark',
        () => FF.addImageWatermark(originalVideoPath, watermarkImagePath, targetVideoPath, options),
        { originalVideoPath, watermarkImagePath, targetVideoPath, options }
      );
    },

    trimVideo: (originalVideoPath, targetVideoPath, startTime, endTime) => {
      return instrumentFFmpegOperation(
        'trimVideo',
        () => FF.trimVideo(originalVideoPath, targetVideoPath, startTime, endTime),
        { originalVideoPath, targetVideoPath, startTime, endTime }
      );
    },

    createGif: (originalVideoPath, targetGifPath, options = {}) => {
      return instrumentFFmpegOperation(
        'createGif',
        () => FF.createGif(originalVideoPath, targetGifPath, options),
        { originalVideoPath, targetGifPath, options }
      );
    },

    cropImage: (originalImagePath, targetImagePath, width, height, x = 0, y = 0) => {
      return instrumentFFmpegOperation(
        'cropImage',
        () => FF.cropImage(originalImagePath, targetImagePath, width, height, x, y),
        { originalImagePath, targetImagePath, width, height, x, y }
      );
    },

    resizeImage: (originalImagePath, targetImagePath, width, height) => {
      return instrumentFFmpegOperation(
        'resizeImage',
        () => FF.resizeImage(originalImagePath, targetImagePath, width, height),
        { originalImagePath, targetImagePath, width, height }
      );
    },

    convertImageFormat: (originalImagePath, targetImagePath, targetFormat) => {
      return instrumentFFmpegOperation(
        'convertImageFormat',
        () => FF.convertImageFormat(originalImagePath, targetImagePath, targetFormat),
        { originalImagePath, targetImagePath, targetFormat }
      );
    },
  };
}

module.exports = {
  instrumentFFmpegOperation,
  createInstrumentedFF,
};
