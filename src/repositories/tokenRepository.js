const crypto = require('crypto');

const db = require('../db');

const MASK_LEN = 8;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function maskToken(token) {
  if (!token || token.length < MASK_LEN) return '****';
  return '****' + token.slice(-MASK_LEN);
}

function findAll() {
  return db
    .prepare(
      `SELECT t.id, t.token_mask, t.label, t.instance_id, t.active, t.created_at, i.label as instance_label, i.evolution_instance_name
       FROM tokens t
       LEFT JOIN instances i ON t.instance_id = i.id
       ORDER BY t.created_at DESC`
    )
    .all();
}

function findById(id) {
  return db.prepare('SELECT * FROM tokens WHERE id = ?').get(id);
}

function findByTokenHash(tokenHash) {
  return db
    .prepare(
      `SELECT t.*, i.evolution_instance_name, i.label as instance_label
       FROM tokens t
       JOIN instances i ON t.instance_id = i.id
       WHERE t.token_hash = ? AND t.active = 1`
    )
    .get(tokenHash);
}

function create({ token, label, instance_id }) {
  const tokenHash = hashToken(token);
  const tokenMask = maskToken(token);
  const stmt = db.prepare(`
    INSERT INTO tokens (token_hash, token_mask, label, instance_id)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(tokenHash, tokenMask, label, instance_id);
  return findById(result.lastInsertRowid);
}

function update(id, { label, instance_id, active }) {
  const row = findById(id);
  if (!row) return null;
  const updates = [];
  const params = [];
  if (label !== undefined) {
    updates.push('label = ?');
    params.push(label);
  }
  if (instance_id !== undefined) {
    updates.push('instance_id = ?');
    params.push(instance_id);
  }
  if (active !== undefined) {
    updates.push('active = ?');
    params.push(active ? 1 : 0);
  }
  if (updates.length === 0) return row;
  params.push(id);
  db.prepare(`UPDATE tokens SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  return findById(id);
}

function remove(id) {
  return db.prepare('DELETE FROM tokens WHERE id = ?').run(id);
}

module.exports = {
  hashToken,
  maskToken,
  findAll,
  findById,
  findByTokenHash,
  create,
  update,
  remove,
};
