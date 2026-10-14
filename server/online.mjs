import http from 'http';
import path from 'path';
import { pathToFileURL } from 'url';
import { handleOnline } from './online-http.mjs';

export function listenOnline(port = 8787) {
  const server = http.createServer((req, res) => {
    handleOnline(req, res).catch(() => {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end('{"error":"bad-world"}');
      }
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') resolve(false);
      else reject(err);
    });
    server.listen(port, '0.0.0.0', () => {
      console.log(`Toast Time online levels listening on ${port}`);
      resolve(true);
    });
  });
}

const launchedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (launchedDirectly) {
  listenOnline(8787).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
