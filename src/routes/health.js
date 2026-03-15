const express = require('express');
const evolutionService = require('../services/evolutionService');

const router = express.Router();

/**
 * GET /health
 * Health check para proxy e monitoramento.
 * Retorna 200 com status do app e da Evolution API (quando configurada).
 */
router.get('/', async (_req, res) => {
  let evolutionOk = false;
  try {
    await evolutionService.fetchInstances();
    evolutionOk = true;
  } catch {
    // Evolution inacessível; app continua ok
  }
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      evolution: evolutionOk,
    },
  });
});

module.exports = router;
