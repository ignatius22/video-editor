const pino = require('pino');

/**
 * Shared Logger Utility
 * @param {string} serviceName - Name of the service (api, worker, etc.)
 */
const createLogger = (serviceName) => {
  const isProd = process.env.NODE_ENV === 'production';
  
  const transport = !isProd ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname,service',
    }
  } : undefined;

  return pino({
    level: process.env.LOG_LEVEL || 'info',
    base: {
      service: serviceName,
      env: process.env.NODE_ENV || 'development',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => {
        return { level: label.toUpperCase() };
      },
    },
  }, transport);
};

module.exports = createLogger;
