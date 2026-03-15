const { describe, test } = require('node:test');
const assert = require('node:assert');
const {
  generateKey,
  isPlaceholder,
  parseEnv,
  serializeEnv,
  getDefaultEnvContent,
} = require('../../scripts/env-utils');

describe('env-utils', () => {
  test('generateKey returns 64-char hex string', () => {
    const key = generateKey();
    assert.strictEqual(typeof key, 'string');
    assert.strictEqual(key.length, 64);
    assert.ok(/^[a-f0-9]+$/.test(key));
  });

  test('isPlaceholder returns true for empty and change-me', () => {
    assert.strictEqual(isPlaceholder(''), true);
    assert.strictEqual(isPlaceholder('change-me'), true);
    assert.strictEqual(isPlaceholder('change-me-to-a-secure-random-key'), true);
    assert.strictEqual(isPlaceholder(null), true);
  });

  test('isPlaceholder returns false for real key', () => {
    assert.strictEqual(isPlaceholder('abc123def456'), false);
    assert.strictEqual(isPlaceholder(generateKey()), false);
  });

  test('parseEnv parses key=value lines', () => {
    const content = 'MASTER_KEY=foo\nEVOLUTION_API_KEY=bar\n# comment\nPORT=3000';
    const env = parseEnv(content);
    assert.strictEqual(env.MASTER_KEY, 'foo');
    assert.strictEqual(env.EVOLUTION_API_KEY, 'bar');
    assert.strictEqual(env.PORT, '3000');
  });

  test('serializeEnv produces valid output', () => {
    const obj = { MASTER_KEY: 'x', EVOLUTION_API_KEY: 'y', PORT: '3000' };
    const out = serializeEnv(obj);
    assert.ok(out.includes('MASTER_KEY=x'));
    assert.ok(out.includes('EVOLUTION_API_KEY=y'));
    assert.ok(out.includes('PORT=3000'));
  });

  test('getDefaultEnvContent contains required keys', () => {
    const content = getDefaultEnvContent();
    assert.ok(content.includes('MASTER_KEY='));
    assert.ok(content.includes('EVOLUTION_API_KEY='));
    assert.ok(content.includes('EVOLUTION_API_URL='));
    assert.ok(content.includes('DB_PATH='));
  });
});
