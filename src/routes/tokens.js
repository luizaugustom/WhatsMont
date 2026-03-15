const express = require('express');
const tokenService = require('../services/tokenService');

const router = express.Router();

router.get('/', (req, res, next) => {
  try {
    const list = tokenService.listTokens();
    res.json({ success: true, data: list });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const row = tokenService.getToken(Number(req.params.id));
    if (!row) return res.status(404).json({ success: false, error: 'Token não encontrado' });
    res.json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
});

router.post('/', (req, res, next) => {
  try {
    const { label, instance_id } = req.body || {};
    if (!label || !String(label).trim()) {
      return res.status(400).json({ success: false, error: 'label é obrigatório' });
    }
    if (!instance_id) {
      return res.status(400).json({ success: false, error: 'instance_id é obrigatório' });
    }
    const created = tokenService.createToken({
      label: String(label).trim(),
      instance_id: Number(instance_id),
    });
    res.status(201).json({
      success: true,
      data: {
        id: created.id,
        label: created.label,
        instance_id: created.instance_id,
        token: created.token,
        token_mask: created.token_mask,
        active: created.active,
        created_at: created.created_at,
      },
    });
  } catch (e) {
    if (e.message === 'Instance not found') {
      return res.status(404).json({ success: false, error: e.message });
    }
    next(e);
  }
});

router.patch('/:id', (req, res, next) => {
  try {
    const { label, instance_id, active } = req.body || {};
    const row = tokenService.updateToken(Number(req.params.id), {
      label: label !== undefined ? String(label).trim() : undefined,
      instance_id: instance_id !== undefined ? Number(instance_id) : undefined,
      active,
    });
    if (!row) return res.status(404).json({ success: false, error: 'Token não encontrado' });
    res.json({ success: true, data: row });
  } catch (e) {
    if (e.message === 'Token not found' || e.message === 'Instance not found') {
      return res.status(404).json({ success: false, error: e.message });
    }
    next(e);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    const row = tokenService.getToken(Number(req.params.id));
    if (!row) return res.status(404).json({ success: false, error: 'Token não encontrado' });
    tokenService.deleteToken(Number(req.params.id));
    res.json({ success: true, data: { ok: true } });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
