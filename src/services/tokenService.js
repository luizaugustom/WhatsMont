const crypto = require('crypto');
const tokenRepository = require('../repositories/tokenRepository');
const instanceRepository = require('../repositories/instanceRepository');

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createToken({ label, instance_id }) {
  const instance = instanceRepository.findById(instance_id);
  if (!instance) throw new Error('Instance not found');
  const token = generateToken();
  const row = tokenRepository.create({ token, label, instance_id });
  return { ...row, token };
}

function listTokens() {
  return tokenRepository.findAll();
}

function getToken(id) {
  return tokenRepository.findById(id);
}

function updateToken(id, { label, instance_id, active }) {
  const row = tokenRepository.findById(id);
  if (!row) throw new Error('Token not found');
  if (instance_id !== undefined) {
    const instance = instanceRepository.findById(instance_id);
    if (!instance) throw new Error('Instance not found');
  }
  return tokenRepository.update(id, { label, instance_id, active });
}

function revokeToken(id) {
  return tokenRepository.update(id, { active: false });
}

function deleteToken(id) {
  const row = tokenRepository.findById(id);
  if (!row) throw new Error('Token not found');
  return tokenRepository.remove(id);
}

function validateToken(bearerToken) {
  if (!bearerToken || !bearerToken.startsWith('Bearer ')) return null;
  const raw = bearerToken.slice(7).trim();
  if (!raw) return null;
  const hash = tokenRepository.hashToken(raw);
  return tokenRepository.findByTokenHash(hash);
}

module.exports = {
  generateToken,
  createToken,
  listTokens,
  getToken,
  updateToken,
  revokeToken,
  deleteToken,
  validateToken,
};
