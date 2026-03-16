const express = require('express');
const config = require('../config');

const router = express.Router();

function maskApiKey(key) {
  if (!key || !String(key).trim()) return '***';
  const s = String(key).trim();
  if (s.length <= 4) return '***';
  return '***' + s.slice(-4);
}

router.get('/connection', (req, res) => {
  res.json({
    success: true,
    data: {
      whatsmont_base_url: config.whatsmontPublicUrl || '',
      evolution_base_url: config.evolutionPublicUrl || '',
      evolution_api_key_masked: maskApiKey(config.evolution.apiKey),
    },
  });
});

module.exports = router;
