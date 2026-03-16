const express = require('express');
const instanceService = require('../services/instanceService');
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

router.get('/:id/connection-info', (req, res, next) => {
  try {
    const row = instanceRepository.findById(Number(req.params.id));
    if (!row) return res.status(404).json({ success: false, error: 'Instância não encontrada' });
    const whatsmontBaseUrl = config.whatsmontPublicUrl || '';
    const evolutionBaseUrl = config.evolutionPublicUrl || '';
    const evolutionApiKeyMasked = maskApiKey(config.evolution.apiKey);
    const instanceName = row.evolution_instance_name || '';
    const env_example = buildEnvExample({
      whatsmontBaseUrl,
      evolutionBaseUrl,
      evolutionApiKeyMasked,
      instanceName,
    });
    res.json({
      success: true,
      data: {
        whatsmont_base_url: whatsmontBaseUrl,
        evolution_base_url: evolutionBaseUrl,
        evolution_api_key_masked: evolutionApiKeyMasked,
        instance_name: instanceName,
        env_example,
      },
    });
  } catch (e) {
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
