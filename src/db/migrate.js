const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH || './data/whatsmont.db';
const resolvedPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);
const dir = path.dirname(resolvedPath);

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(resolvedPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evolution_instance_name TEXT NOT NULL UNIQUE,
    evolution_instance_id TEXT,
    label TEXT NOT NULL,
    status TEXT DEFAULT 'close',
    evolution_apikey TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_instances_evolution_name ON instances(evolution_instance_name);

  CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    token_mask TEXT NOT NULL,
    label TEXT NOT NULL,
    instance_id INTEGER NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_tokens_token_hash ON tokens(token_hash);
  CREATE INDEX IF NOT EXISTS idx_tokens_instance_id ON tokens(instance_id);
  CREATE INDEX IF NOT EXISTS idx_tokens_active ON tokens(active);
`);

console.log('Migrations applied successfully.');
db.close();
