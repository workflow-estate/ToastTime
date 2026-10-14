import { listLevels, publishLevel } from './online-store.mjs';

const MESSAGES = {
  'bad-world': 'Could not publish that level.',
  'bad-json': 'Could not publish that level.',
};

function send(req, res, status, body) {
  const payload = JSON.stringify(body);
  const origin = req.headers.origin || '*';
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 200000) {
        reject(Object.assign(new Error('too-big'), { code: 'bad-json' }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('bad-json'), { code: 'bad-json' }));
      }
    });
    req.on('error', () => reject(Object.assign(new Error('bad-json'), { code: 'bad-json' })));
  });
}

export async function handleOnline(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  if (!url.pathname.startsWith('/api/online')) return false;
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    res.end();
    return true;
  }
  try {
    if (req.method === 'GET' && url.pathname === '/api/online/levels') {
      send(req, res, 200, { levels: await listLevels() });
      return true;
    }
    if (req.method === 'POST' && url.pathname === '/api/online/levels') {
      const body = await readBody(req);
      const level = await publishLevel(body.world);
      send(req, res, 200, { level });
      return true;
    }
    send(req, res, 404, { error: 'missing' });
  } catch (err) {
    const code = err.code || 'bad-world';
    const status = 400;
    send(req, res, status, { error: code, message: MESSAGES[code] || 'Could not publish that level.' });
  }
  return true;
}
