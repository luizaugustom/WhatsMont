const logger = require('../lib/logger');

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Erro interno do servidor';

  if (status >= 500) logger.error({ err, req: { method: req.method, url: req.url } }, message);

  res.status(status).json({
    success: false,
    error: message,
  });
}

module.exports = errorHandler;
