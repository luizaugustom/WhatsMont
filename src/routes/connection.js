const express = require('express');
const evolutionService = require('../services/evolutionService');

const router = express.Router();

router.get('/status', async (req, res, next) => {
  try {
    const instanceName = req.evolutionInstanceName;
    let state = 'close';
    try {
      const data = await evolutionService.connectionState(instanceName, false);
      state = (data && data.instance && data.instance.state) || data?.state || state;
    } catch {
      // keep close
    }
    res.json({ success: true, data: { state, instanceName } });
  } catch (e) {
    next(e);
  }
});

router.get('/qr', async (req, res, next) => {
  try {
    const instanceName = req.evolutionInstanceName;
    const data = await evolutionService.connectInstance(instanceName);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
