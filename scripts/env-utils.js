const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PLACEHOLDERS = ['', 'change-me', 'change-me-to-a-secure-random-key'];

function generateKey() {
  return crypto.randomBytes(32).toString('hex');
}

function isPlaceholder(value) {
  if (value == null) return true;
  const v = String(value).trim();
  return !v || PLACEHOLDERS.some((p) => v === p || v.toLowerCase() === p);
}

function parseEnv(content) {
  const lines = content.split(/\r?\n/);
  const result = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function serializeEnv(obj, commentLines = []) {
  const keys = [
    'MASTER_KEY',
    'EVOLUTION_API_URL',
    'EVOLUTION_API_KEY',
    'PORT',
    'CORS_ORIGIN',
    'DB_PATH',
    'NODE_ENV',
  ];
  const lines = [...commentLines];
  for (const key of keys) {
    const v = obj[key];
    if (v !== undefined) lines.push(`${key}=${v}`);
  }
  return lines.join('\n') + '\n';
}

function getDefaultEnvContent() {
  return `MASTER_KEY=change-me-to-a-secure-random-key
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=change-me
PORT=3000
CORS_ORIGIN=http://localhost:3000
DB_PATH=./data/whatsmont.db
NODE_ENV=development
`;
}

function ensureEnvKeys(rootDir, options = {}) {
  const root = path.resolve(rootDir);
  const envPath = path.join(root, '.env');
  const examplePath = path.join(root, '.env.example');
  const skipGeneration = options.skipGeneration === true;

  let content;
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  } else if (fs.existsSync(examplePath)) {
    content = fs.readFileSync(examplePath, 'utf8');
  } else {
    content = getDefaultEnvContent();
  }

  const env = parseEnv(content);
  let updated = false;

  if (!skipGeneration && isPlaceholder(env.MASTER_KEY)) {
    env.MASTER_KEY = generateKey();
    updated = true;
  }
  if (!skipGeneration && isPlaceholder(env.EVOLUTION_API_KEY)) {
    env.EVOLUTION_API_KEY = generateKey();
    updated = true;
  }

  const out = serializeEnv(env, ['# Gerado/atualizado por ensure-env']);
  fs.writeFileSync(envPath, out, 'utf8');

  if (updated && options.onUpdated) {
    options.onUpdated(env, root);
  }

  return { env, updated };
}

module.exports = {
  generateKey,
  isPlaceholder,
  parseEnv,
  serializeEnv,
  getDefaultEnvContent,
  ensureEnvKeys,
};
