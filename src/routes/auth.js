const express = require('express');
const config = require('../config');

const router = express.Router();

router.post('/login', (req, res) => {
  const key = req.body?.key || req.body?.masterKey || '';
  if (!config.masterKey || key !== config.masterKey) {
    return res.status(401).json({ success: false, error: 'Chave inválida' });
  }
  res.json({ success: true, token: key });
});

module.exports = router;
