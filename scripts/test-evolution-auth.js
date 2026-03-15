/**
 * Testa se a Evolution API está aceitando a EVOLUTION_API_KEY do .env.
 * Uso: node scripts/test-evolution-auth.js
 * Deve retornar 200 e listar instâncias (ou array vazio). 403 = chave rejeitada.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const config = require('../src/config');

const url = `${config.evolution.url.replace(/\/$/, '')}/instance/fetchInstances`;
const key = (config.evolution.apiKey || '').trim();

if (!key) {
  console.error('ERRO: EVOLUTION_API_KEY não está definida no .env');
  process.exit(1);
}

console.log('URL:', url);
console.log('ApiKey (primeiros 8 chars):', key.slice(0, 8) + '...');
console.log('');

fetch(url, {
  method: 'GET',
  headers: { apikey: key, 'Content-Type': 'application/json' },
})
  .then(async (res) => {
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    console.log('Status:', res.status, res.statusText);
    console.log('Resposta:', JSON.stringify(data, null, 2));
    if (res.ok) {
      console.log('\nOK: Autenticação aceita pela Evolution API.');
    } else {
      console.log('\nFALHA: Evolution API rejeitou a requisição. Verifique AUTHENTICATION_API_KEY no container.');
      console.log('Confira no container: docker exec evolution-api env | findstr AUTHENTICATION');
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('Erro de rede:', err.message);
    process.exit(1);
  });
