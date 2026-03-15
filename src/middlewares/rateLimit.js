const rateLimit = require('express-rate-limit');
const config = require('../config');

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isProduction ? 100 : 500,
  message: { success: false, error: 'Muitas requisições. Tente novamente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const tokenLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { success: false, error: 'Limite de requisições por token excedido.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) return auth;
    return req.ip;
  },
});

module.exports = {
  generalLimiter,
  tokenLimiter,
};
