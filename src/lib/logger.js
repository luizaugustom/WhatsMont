const pino = require('pino');
const config = require('../config');

const logger = pino({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  ...(config.nodeEnv !== 'production' && {
    transport: { target: 'pino-pretty', options: { colorize: true } },
  }),
});

module.exports = logger;
