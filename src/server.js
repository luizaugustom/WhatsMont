require('./ensure-env-bootstrap');

const path = require('path');
const fs = require('fs');
const config = require('./config');
const logger = require('./lib/logger');

const dbPath = path.isAbsolute(config.dbPath) ? config.dbPath : path.resolve(process.cwd(), config.dbPath);
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

require('./db');
require('./db/migrate');

const app = require('./app');

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, dbPath }, 'WhatsMont listening');
});

server.on('error', (err) => {
  logger.error(err, 'Server error');
  process.exit(1);
});
