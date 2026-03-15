const express = require('express');
const authAdmin = require('../middlewares/authAdmin');
const authToken = require('../middlewares/authToken');
const { generalLimiter, tokenLimiter } = require('../middlewares/rateLimit');

const authRoutes = require('./auth');
const instancesRoutes = require('./instances');
const tokensRoutes = require('./tokens');
const connectionRoutes = require('./connection');
const healthRoutes = require('./health');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', generalLimiter, authRoutes);

router.use('/instances', generalLimiter, authAdmin, instancesRoutes);
router.use('/tokens', generalLimiter, authAdmin, tokensRoutes);

router.use('/connection', tokenLimiter, authToken, connectionRoutes);

module.exports = router;
