const express = require('express');
const tokenService = require('../services/tokenService');
const instanceRepository = require('../repositories/instanceRepository');
const config = require('../config');

const router = express.Router();

function maskApiKey(key) {
  if (!key || !String(key).trim()) return '***';
  const s = String(key).trim();
  return s.length <= 4 ? '***' : '***' + s.slice(-4);
}

function buildEnvExample(opts) {
  const { whatsmontBaseUrl, evolutionBaseUrl, evolutionApiKeyMasked, instanceName, whatsmontTokenNote } = opts;
  const lines = [
    '# Variáveis para API externa (status/QR + envio de mensagens)',
    '',
    `WHATSMONT_BASE_URL=${whatsmontBaseUrl || 'https://whatsmont.seudominio.com'}`,
    `# ${whatsmontTokenNote || 'Token obtido ao criar um token vinculado a esta instância no painel'}`,
    'WHATSMONT_TOKEN=',
    '',
    `EVOLUTION_BASE_URL=${evolutionBaseUrl || 'http://localhost:8080'}`,
    `# Mesma do .env do servidor Evolution (ex.: ${evolutionApiKeyMasked})`,
    'EVOLUTION_API_KEY=',
    '',
    `EVOLUTION_INSTANCE_NAME=${instanceName || 'minha-instancia'}`,
    '',
    '# Se a Evolution estiver em subpath (ex.: /v1), inclua em EVOLUTION_BASE_URL.',
    '# Evolution API v1: body de envio é textMessage: { text: "..." }.',
  ];
  return lines.join('\n');
}

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

router.get('/:id/connection-info', (req, res, next) => {
  try {
    const token = tokenService.getToken(Number(req.params.id));
    if (!token) return res.status(404).json({ success: false, error: 'Token não encontrado' });
    const instance = instanceRepository.findById(token.instance_id);
    if (!instance) return res.status(404).json({ success: false, error: 'Instância do token não encontrada' });
    const whatsmontBaseUrl = config.whatsmontPublicUrl || '';
    const evolutionBaseUrl = config.evolutionPublicUrl || '';
    const evolutionApiKeyMasked = maskApiKey(config.evolution.apiKey);
    const instanceName = instance.evolution_instance_name || '';
    const whatsmontTokenNote = `Valor que você salvou ao criar este token (lembrete: ${token.token_mask || '****'})`;
    const env_example = buildEnvExample({
      whatsmontBaseUrl,
      evolutionBaseUrl,
      evolutionApiKeyMasked,
      instanceName,
      whatsmontTokenNote,
    });
    res.json({
      success: true,
      data: {
        whatsmont_base_url: whatsmontBaseUrl,
        evolution_base_url: evolutionBaseUrl,
        evolution_api_key_masked: evolutionApiKeyMasked,
        instance_name: instanceName,
        token_mask: token.token_mask || '',
        env_example,
      },
    });
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
