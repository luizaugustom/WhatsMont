const config = require('../config');

const EVOLUTION_URL = config.evolution.url;
const EVOLUTION_API_KEY = config.evolution.apiKey;
const TIMEOUT_MS = 15000;

const connectionStateCache = new Map();
const CACHE_TTL_MS = 45000;

function getCacheKey(instanceName) {
  return `state:${instanceName}`;
}

function invalidateConnectionCache(instanceName) {
  if (instanceName) connectionStateCache.delete(getCacheKey(instanceName));
  else connectionStateCache.clear();
}

async function request(method, path, body = null, retries = 1) {
  if (!EVOLUTION_API_KEY || !String(EVOLUTION_API_KEY).trim()) {
    const err = new Error('EVOLUTION_API_KEY não configurada no .env');
    err.status = 500;
    throw err;
  }
  const url = `${EVOLUTION_URL}${path}`;
  const key = String(EVOLUTION_API_KEY).trim();
  const options = {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  };
  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        const err = new Error(data?.message || data?.error || res.statusText || `HTTP ${res.status}`);
        err.status = res.status;
        err.body = data;
        throw err;
      }
      return data;
    } catch (e) {
      lastError = e;
      const isRetryable = e.status >= 500 || e.name === 'TimeoutError' || e.code === 'ECONNREFUSED';
      if (attempt < retries && isRetryable) continue;
      throw lastError;
    }
  }
  throw lastError;
}

async function createInstance({ instanceName, integration = 'WHATSAPP-BAILEYS', qrcode = true, ...rest }) {
  invalidateConnectionCache(instanceName);
  return request('POST', '/instance/create', {
    instanceName,
    integration,
    qrcode,
    ...rest,
  });
}

async function connectInstance(instanceName) {
  invalidateConnectionCache(instanceName);
  return request('GET', `/instance/connect/${encodeURIComponent(instanceName)}`);
}

async function connectionState(instanceName, useCache = true) {
  const key = getCacheKey(instanceName);
  if (useCache) {
    const cached = connectionStateCache.get(key);
    if (cached && Date.now() < cached.expires) return cached.data;
  }
  const data = await request('GET', `/instance/connectionState/${encodeURIComponent(instanceName)}`);
  connectionStateCache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
  return data;
}

async function fetchInstances() {
  return request('GET', '/instance/fetchInstances');
}

async function deleteInstance(instanceName) {
  invalidateConnectionCache(instanceName);
  return request('DELETE', `/instance/delete/${encodeURIComponent(instanceName)}`);
}

module.exports = {
  createInstance,
  connectInstance,
  connectionState,
  fetchInstances,
  deleteInstance,
  invalidateConnectionCache,
};
