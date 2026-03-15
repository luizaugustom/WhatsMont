const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      stdio: opts.silent ? 'pipe' : 'inherit',
      shell: opts.shell ?? false,
      ...opts,
    });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`))));
  });
}

async function main() {
  console.log('WhatsMont: garantindo variáveis de ambiente...');
  require('./ensure-env.js');
  require('dotenv').config({ path: path.join(root, '.env') });

  console.log('WhatsMont: subindo Evolution API (Docker)...');
  try {
    await run('docker', ['compose', 'up', '-d', 'evolution-api'], { silent: false });
  } catch (e) {
    try {
      await run('docker-compose', ['up', '-d', 'evolution-api'], { silent: false });
    } catch (e2) {
      console.warn('Aviso: não foi possível subir o Docker. Certifique-se de que o Docker está instalado e que docker-compose está disponível.');
      console.warn('Você pode subir a Evolution manualmente: docker compose up -d evolution-api');
    }
  }

  console.log('Aguardando Evolution API (5s)...');
  await new Promise((r) => setTimeout(r, 5000));

  console.log('WhatsMont: iniciando painel...');
  const node = process.execPath;
  const serverPath = path.join(root, 'src', 'server.js');
  const child = spawn(node, [serverPath], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' },
  });
  child.on('error', (err) => {
    console.error(err);
    process.exit(1);
  });
  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
