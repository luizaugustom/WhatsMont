const express = require('express');
const instanceService = require('../services/instanceService');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const list = await instanceService.listInstances();
    res.json({ success: true, data: list });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await instanceService.getInstance(Number(req.params.id));
    if (!row) return res.status(404).json({ success: false, error: 'Instância não encontrada' });
    res.json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
});

router.get('/:id/qr', async (req, res, next) => {
  try {
    const qr = await instanceService.getQr(Number(req.params.id));
    res.json({ success: true, data: qr });
  } catch (e) {
    if (e.message === 'Instance not found') return res.status(404).json({ success: false, error: e.message });
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { instanceName, label, integration, qrcode, ...rest } = req.body || {};
    if (!instanceName || !String(instanceName).trim()) {
      return res.status(400).json({ success: false, error: 'instanceName é obrigatório' });
    }
    const row = await instanceService.createInstance({
      instanceName: String(instanceName).trim(),
      label: label ? String(label).trim() : String(instanceName).trim(),
      integration,
      qrcode,
      ...rest,
    });
    res.status(201).json({ success: true, data: row });
  } catch (e) {
    if (e.status === 409) return res.status(409).json({ success: false, error: e.message });
    // 403 da Evolution pode ser auth (Forbidden) ou nome já em uso — repassa a mensagem real
    if (e.status === 403) {
      const msg = e.body?.response?.message;
      const text = Array.isArray(msg) ? msg.join(' ') : msg || e.body?.error || e.message;
      return res.status(403).json({ success: false, error: text, details: e.body });
    }
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await instanceService.deleteInstance(Number(req.params.id));
    res.json({ success: true, data: { ok: true } });
  } catch (e) {
    if (e.message === 'Instance not found') {
      return res.status(404).json({ success: false, error: e.message });
    }
    next(e);
  }
});

module.exports = router;
