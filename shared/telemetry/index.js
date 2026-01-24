/**
 * Telemetry Module
 * Main entry point for OpenTelemetry instrumentation
 */

const { initializeTelemetry, shutdownTelemetry } = require('./tracer');
const { createInstrumentedFF } = require('./instrumentation/ffmpeg');
const {
  injectTraceContext,
  extractTraceContextAndStartSpan,
  createEnqueueSpan
} = require('./instrumentation/queue');
const config = require('./config');

module.exports = {
  // Initialization
  initializeTelemetry,
  shutdownTelemetry,

  // Configuration
  config,

  // FFmpeg instrumentation
  createInstrumentedFF,

  // Queue instrumentation
  injectTraceContext,
  extractTraceContextAndStartSpan,
  createEnqueueSpan,
};
