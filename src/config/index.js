require('dotenv').config();

const config = {
  masterKey: process.env.MASTER_KEY || '',
  evolution: {
    url: (process.env.EVOLUTION_API_URL || 'http://localhost:8080').replace(/\/$/, ''),
    apiKey: process.env.EVOLUTION_API_KEY || '',
  },
  port: parseInt(process.env.PORT || '3000', 10),
  corsOrigin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : ['http://localhost:3000'],
  dbPath: process.env.DB_PATH || './data/whatsmont.db',
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
};

module.exports = config;
