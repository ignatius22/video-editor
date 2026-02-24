const pino = require('pino');

/**
 * Shared Logger Utility
 * @param {string} serviceName - Name of the service (api, worker, etc.)
 */
const createLogger = (serviceName) => {
  const isProd = process.env.NODE_ENV === 'production';
  
  const pinoOptions = {
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
  };

  if (!isProd) {
    pinoOptions.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname,service',
      }
    };
  }

  return pino(pinoOptions);
};

module.exports = createLogger;
