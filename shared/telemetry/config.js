/**
 * OpenTelemetry Configuration
 * Environment-based configuration for telemetry collection
 */

module.exports = {
  enabled: process.env.OTEL_ENABLED === 'true',

  serviceName: process.env.OTEL_SERVICE_NAME || 'video-editor',
  serviceVersion: process.env.OTEL_SERVICE_VERSION || '2.0.0',
  environment: process.env.NODE_ENV || 'development',

  exporter: {
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'localhost:4317',
    protocol: 'grpc',
    headers: process.env.OTEL_EXPORTER_OTLP_HEADERS || '',
  },

  sampling: {
    // Sample 100% in dev, 10% in production (configurable)
    probability: parseFloat(process.env.OTEL_TRACE_SAMPLING_PROBABILITY ||
      (process.env.NODE_ENV === 'production' ? '0.1' : '1.0'))
  },

  ffmpeg: {
    // Capture stderr output as span events
    captureStderr: process.env.OTEL_FFMPEG_CAPTURE_STDERR !== 'false',
    // Maximum stderr characters to capture (prevent huge spans)
    maxStderrLength: parseInt(process.env.OTEL_FFMPEG_MAX_STDERR_LENGTH || '2000')
  }
};
