const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const isTest = process.env.NODE_ENV === 'test';

if (isTest) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
} else {
  const { ensureEnvKeys } = require(path.join(root, 'scripts', 'env-utils.js'));
  const { updated, env } = ensureEnvKeys(root, {
    onUpdated(envData, rootDir) {
      const keyPath = path.join(rootDir, '.master-key.txt');
      fs.writeFileSync(keyPath, envData.MASTER_KEY + '\n', 'utf8');
      console.log('Chaves geradas automaticamente. MASTER_KEY em .master-key.txt');
    },
  });
  require('dotenv').config({ path: envPath });
}
