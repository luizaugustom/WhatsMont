const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const errorHandler = require('./middlewares/errorHandler');
const apiRoutes = require('./routes');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.use('/api/v1', apiRoutes);

const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.use(errorHandler);

module.exports = app;
