const db = require('../db');

function findAll() {
  return db.prepare('SELECT * FROM instances ORDER BY created_at DESC').all();
}

function findById(id) {
  return db.prepare('SELECT * FROM instances WHERE id = ?').get(id);
}

function findByEvolutionName(evolutionInstanceName) {
  return db.prepare('SELECT * FROM instances WHERE evolution_instance_name = ?').get(evolutionInstanceName);
}

function create({ evolution_instance_name, evolution_instance_id, label, status = 'close', evolution_apikey }) {
  const stmt = db.prepare(`
    INSERT INTO instances (evolution_instance_name, evolution_instance_id, label, status, evolution_apikey)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    evolution_instance_name,
    evolution_instance_id || null,
    label,
    status,
    evolution_apikey || null
  );
  return findById(result.lastInsertRowid);
}

function updateStatus(id, status) {
  db.prepare('UPDATE instances SET status = ?, updated_at = datetime("now") WHERE id = ?').run(status, id);
  return findById(id);
}

function update(id, { label, evolution_instance_id, status }) {
  const row = findById(id);
  if (!row) return null;
  const updates = [];
  const params = [];
  if (label !== undefined) {
    updates.push('label = ?');
    params.push(label);
  }
  if (evolution_instance_id !== undefined) {
    updates.push('evolution_instance_id = ?');
    params.push(evolution_instance_id);
  }
  if (status !== undefined) {
    updates.push('status = ?');
    params.push(status);
  }
  if (updates.length === 0) return row;
  updates.push('updated_at = datetime("now")');
  params.push(id);
  db.prepare(`UPDATE instances SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  return findById(id);
}

function remove(id) {
  return db.prepare('DELETE FROM instances WHERE id = ?').run(id);
}

module.exports = {
  findAll,
  findById,
  findByEvolutionName,
  create,
  update,
  updateStatus,
  remove,
};
