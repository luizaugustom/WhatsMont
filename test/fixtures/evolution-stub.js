const http = require('http');

function createEvolutionStub() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const method = req.method;

    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    const parseBody = () =>
      new Promise((resolve) => {
        let data = '';
        req.on('data', (ch) => (data += ch));
        req.on('end', () => {
          try {
            resolve(data ? JSON.parse(data) : {});
          } catch {
            resolve({});
          }
        });
      });

    if (method === 'POST' && pathname === '/instance/create') {
      parseBody().then((body) => {
        const name = body.instanceName || 'test-instance';
        send(201, {
          instance: {
            instanceName: name,
            instanceId: 'stub-' + name,
            status: 'created',
          },
          hash: { apikey: 'stub-key' },
        });
      });
      return;
    }

    if (method === 'GET' && pathname.startsWith('/instance/connect/')) {
      const name = decodeURIComponent(pathname.replace(/^\/instance\/connect\//, ''));
      send(200, { base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', code: 'stub-qr' });
      return;
    }

    if (method === 'GET' && pathname.startsWith('/instance/connectionState/')) {
      send(200, { state: 'close', instance: { state: 'close' } });
      return;
    }

    if (method === 'GET' && pathname === '/instance/fetchInstances') {
      send(200, []);
      return;
    }

    if (method === 'DELETE' && pathname.startsWith('/instance/delete/')) {
      send(200, { message: 'Instance deleted' });
      return;
    }

    send(404, { error: 'Not found' });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

module.exports = { createEvolutionStub };
