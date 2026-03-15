const path = require('path');
const fs = require('fs');
const { ensureEnvKeys } = require('./env-utils');

const root = path.resolve(__dirname, '..');

const { updated, env } = ensureEnvKeys(root, {
  onUpdated(envData, rootDir) {
    console.log('Chaves geradas automaticamente em .env');
    console.log('MASTER_KEY (guarde para acessar o painel):', envData.MASTER_KEY);
    const keyPath = path.join(rootDir, '.master-key.txt');
    fs.writeFileSync(keyPath, envData.MASTER_KEY + '\n', 'utf8');
    console.log('Chave master também salva em:', keyPath);
  },
});

if (require.main === module) {
  process.exit(0);
}
