const fs = require('fs');
const path = require('path');
const os = require('os');
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert');
const { createEvolutionStub } = require('../fixtures/evolution-stub');

const MASTER_KEY = 'test-master-key';
const EVOLUTION_API_KEY = 'test-evolution-key';

let app;
let stubServer;
let stubUrl;

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.MASTER_KEY = MASTER_KEY;
  process.env.EVOLUTION_API_KEY = EVOLUTION_API_KEY;

  const { server, url } = await createEvolutionStub();
  stubServer = server;
  stubUrl = url;
  process.env.EVOLUTION_API_URL = stubUrl;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whatsmont-test-'));
  process.env.DB_PATH = path.join(tmpDir, 'test.db');
  fs.mkdirSync(path.dirname(process.env.DB_PATH), { recursive: true });

  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  const dbPath = process.env.DB_PATH;
  const resolvedPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const Database = require('better-sqlite3');
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
  db.close();

  delete require.cache[require.resolve('../../src/config')];
  delete require.cache[require.resolve('../../src/db')];
  delete require.cache[require.resolve('../../src/routes/index')];
  delete require.cache[require.resolve('../../src/routes/auth')];
  delete require.cache[require.resolve('../../src/routes/instances')];
  delete require.cache[require.resolve('../../src/routes/tokens')];
  delete require.cache[require.resolve('../../src/routes/connection')];
  delete require.cache[require.resolve('../../src/routes/health')];
  delete require.cache[require.resolve('../../src/app')];
  app = require('../../src/app');
});

after(() => {
  if (stubServer) stubServer.close();
});

describe('Health', () => {
  test('GET /api/v1/health returns 200 and status ok', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app).get('/api/v1/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data?.status, 'ok');
    assert.strictEqual(typeof res.body.data?.evolution, 'boolean');
  });
});

describe('Auth', () => {
  test('POST /api/v1/auth/login with correct key returns 200 and token', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app).post('/api/v1/auth/login').send({ key: MASTER_KEY });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.token);
  });

  test('POST /api/v1/auth/login with wrong key returns 401', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app).post('/api/v1/auth/login').send({ key: 'wrong-key' });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
  });

  test('POST /api/v1/auth/login with masterKey in body returns 200', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app).post('/api/v1/auth/login').send({ masterKey: MASTER_KEY });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.token, MASTER_KEY);
  });
});

describe('Instances (admin)', () => {
  test('GET /api/v1/instances without auth returns 401', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app).get('/api/v1/instances');
    assert.strictEqual(res.status, 401);
  });

  test('GET /api/v1/instances with auth returns 200 and array', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app).get('/api/v1/instances').set('Authorization', 'Bearer ' + MASTER_KEY);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });

  test('POST /api/v1/instances creates instance and returns 201', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app)
      .post('/api/v1/instances')
      .set('Authorization', 'Bearer ' + MASTER_KEY)
      .send({ instanceName: 'test-instance-' + Date.now(), label: 'Test', integration: 'WHATSAPP-BAILEYS', qrcode: true });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.id);
    assert.ok(res.body.data.evolution_instance_name);
  });

  test('GET /api/v1/instances/:id and GET /api/v1/instances/:id/qr with auth', async () => {
    const request = (await import('supertest')).default;
    const createRes = await request(app)
      .post('/api/v1/instances')
      .set('Authorization', 'Bearer ' + MASTER_KEY)
      .send({ instanceName: 'test-qr-' + Date.now(), label: 'QR Test', qrcode: false });
    assert.strictEqual(createRes.status, 201);
    const id = createRes.body.data.id;

    const getRes = await request(app).get('/api/v1/instances/' + id).set('Authorization', 'Bearer ' + MASTER_KEY);
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.body.data.id, id);

    const qrRes = await request(app).get('/api/v1/instances/' + id + '/qr').set('Authorization', 'Bearer ' + MASTER_KEY);
    assert.strictEqual(qrRes.status, 200);
    assert.strictEqual(qrRes.body.success, true);
  });

  test('DELETE /api/v1/instances/:id with auth returns 200', async () => {
    const request = (await import('supertest')).default;
    const createRes = await request(app)
      .post('/api/v1/instances')
      .set('Authorization', 'Bearer ' + MASTER_KEY)
      .send({ instanceName: 'test-del-' + Date.now(), label: 'Del Test', qrcode: false });
    assert.strictEqual(createRes.status, 201);
    const id = createRes.body.data.id;

    const delRes = await request(app).delete('/api/v1/instances/' + id).set('Authorization', 'Bearer ' + MASTER_KEY);
    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(delRes.body.success, true);
  });

  test('POST /api/v1/instances without instanceName returns 400', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app)
      .post('/api/v1/instances')
      .set('Authorization', 'Bearer ' + MASTER_KEY)
      .send({ label: 'No Name' });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  test('POST /api/v1/instances with duplicate instanceName returns 409', async () => {
    const request = (await import('supertest')).default;
    const name = 'dup-instance-' + Date.now();
    await request(app)
      .post('/api/v1/instances')
      .set('Authorization', 'Bearer ' + MASTER_KEY)
      .send({ instanceName: name, label: 'First', qrcode: false });
    const res = await request(app)
      .post('/api/v1/instances')
      .set('Authorization', 'Bearer ' + MASTER_KEY)
      .send({ instanceName: name, label: 'Second', qrcode: false });
    assert.strictEqual(res.status, 409);
    assert.ok(res.body.error?.includes('already exists'));
  });

  test('GET /api/v1/instances/:id with invalid id returns 404', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app).get('/api/v1/instances/99999').set('Authorization', 'Bearer ' + MASTER_KEY);
    assert.strictEqual(res.status, 404);
  });

  test('DELETE /api/v1/instances/:id with invalid id returns 404', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app).delete('/api/v1/instances/99999').set('Authorization', 'Bearer ' + MASTER_KEY);
    assert.strictEqual(res.status, 404);
  });

  test('GET /api/v1/instances/:id/qr with invalid id returns 404', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app).get('/api/v1/instances/99999/qr').set('Authorization', 'Bearer ' + MASTER_KEY);
    assert.strictEqual(res.status, 404);
  });
});

describe('Tokens (admin)', () => {
  let instanceId;

  before(async () => {
    const request = (await import('supertest')).default;
    const res = await request(app)
      .post('/api/v1/instances')
      .set('Authorization', 'Bearer ' + MASTER_KEY)
      .send({ instanceName: 'test-token-inst-' + Date.now(), label: 'Token Inst', qrcode: false });
    instanceId = res.body.data.id;
  });

  test('GET /api/v1/tokens with auth returns 200', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app).get('/api/v1/tokens').set('Authorization', 'Bearer ' + MASTER_KEY);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
  });

  test('POST /api/v1/tokens creates token and returns token in body once', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app)
      .post('/api/v1/tokens')
      .set('Authorization', 'Bearer ' + MASTER_KEY)
      .send({ label: 'Test Token', instance_id: instanceId });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.token);
    assert.ok(res.body.data.id);
    assert.strictEqual(res.body.data.instance_id, instanceId);
  });

  test('PATCH /api/v1/tokens/:id revoke (active: false)', async () => {
    const request = (await import('supertest')).default;
    const createRes = await request(app)
      .post('/api/v1/tokens')
      .set('Authorization', 'Bearer ' + MASTER_KEY)
      .send({ label: 'Revoke Token', instance_id: instanceId });
    const id = createRes.body.data.id;
    const res = await request(app)
      .patch('/api/v1/tokens/' + id)
      .set('Authorization', 'Bearer ' + MASTER_KEY)
      .send({ active: false });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.active, 0);
  });

  test('DELETE /api/v1/tokens/:id returns 200', async () => {
    const request = (await import('supertest')).default;
    const createRes = await request(app)
      .post('/api/v1/tokens')
      .set('Authorization', 'Bearer ' + MASTER_KEY)
      .send({ label: 'Delete Token', instance_id: instanceId });
    const id = createRes.body.data.id;
    const res = await request(app).delete('/api/v1/tokens/' + id).set('Authorization', 'Bearer ' + MASTER_KEY);
    assert.strictEqual(res.status, 200);
  });

  test('POST /api/v1/tokens without label returns 400', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app)
      .post('/api/v1/tokens')
      .set('Authorization', 'Bearer ' + MASTER_KEY)
      .send({ instance_id: instanceId });
    assert.strictEqual(res.status, 400);
  });

  test('POST /api/v1/tokens without instance_id returns 400', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app)
      .post('/api/v1/tokens')
      .set('Authorization', 'Bearer ' + MASTER_KEY)
      .send({ label: 'No Instance' });
    assert.strictEqual(res.status, 400);
  });

  test('POST /api/v1/tokens with invalid instance_id returns 404', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app)
      .post('/api/v1/tokens')
      .set('Authorization', 'Bearer ' + MASTER_KEY)
      .send({ label: 'Bad Inst', instance_id: 99999 });
    assert.strictEqual(res.status, 404);
  });

  test('GET /api/v1/tokens/:id with invalid id returns 404', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app).get('/api/v1/tokens/99999').set('Authorization', 'Bearer ' + MASTER_KEY);
    assert.strictEqual(res.status, 404);
  });

  test('PATCH /api/v1/tokens/:id with invalid id returns 404', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app)
      .patch('/api/v1/tokens/99999')
      .set('Authorization', 'Bearer ' + MASTER_KEY)
      .send({ active: false });
    assert.strictEqual(res.status, 404);
  });
});

describe('Connection (external token)', () => {
  let connectionToken;
  let instanceId;

  before(async () => {
    const request = (await import('supertest')).default;
    const instRes = await request(app)
      .post('/api/v1/instances')
      .set('Authorization', 'Bearer ' + MASTER_KEY)
      .send({ instanceName: 'test-conn-' + Date.now(), label: 'Conn Inst', qrcode: false });
    instanceId = instRes.body.data.id;
    const tokenRes = await request(app)
      .post('/api/v1/tokens')
      .set('Authorization', 'Bearer ' + MASTER_KEY)
      .send({ label: 'Connection Token', instance_id: instanceId });
    connectionToken = tokenRes.body.data.token;
  });

  test('GET /api/v1/connection/status without token returns 401', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app).get('/api/v1/connection/status');
    assert.strictEqual(res.status, 401);
  });

  test('GET /api/v1/connection/status with valid token returns 200 and state', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app).get('/api/v1/connection/status').set('Authorization', 'Bearer ' + connectionToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.state);
  });

  test('GET /api/v1/connection/qr with valid token returns 200', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app).get('/api/v1/connection/qr').set('Authorization', 'Bearer ' + connectionToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data);
  });

  test('GET /api/v1/connection/status with revoked token returns 401', async () => {
    const request = (await import('supertest')).default;
    const tokenRes = await request(app)
      .post('/api/v1/tokens')
      .set('Authorization', 'Bearer ' + MASTER_KEY)
      .send({ label: 'Revoked Conn', instance_id: instanceId });
    const token = tokenRes.body.data.token;
    await request(app)
      .patch('/api/v1/tokens/' + tokenRes.body.data.id)
      .set('Authorization', 'Bearer ' + MASTER_KEY)
      .send({ active: false });
    const res = await request(app).get('/api/v1/connection/status').set('Authorization', 'Bearer ' + token);
    assert.strictEqual(res.status, 401);
  });

  test('GET /api/v1/connection/qr with invalid token returns 401', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app).get('/api/v1/connection/qr').set('Authorization', 'Bearer invalid-token');
    assert.strictEqual(res.status, 401);
  });
});
