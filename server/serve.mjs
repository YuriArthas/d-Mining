import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const base = resolve(root);
const port = Number(process.env.PORT ?? 4175);
if (!existsSync(join(base, 'index.html'))) throw new Error('Run npm run build first.');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary' };

createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
  let url, pathname;
  try { url = new URL(request.url, 'http://localhost'); pathname = decodeURIComponent(url.pathname); }
  catch { response.writeHead(400); response.end('Invalid URL'); return; }
  let file = resolve(base, '.' + pathname);
  if ((file !== base && !file.startsWith(base + sep)) || pathname.includes('\0')) { response.writeHead(403); response.end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!pathname.endsWith('/')) { response.writeHead(308, { Location: url.pathname + '/' + url.search }); response.end(); return; }
    file = join(file, 'index.html');
  }
  if (!existsSync(file) || !statSync(file).isFile()) { response.writeHead(404); response.end('Not found'); return; }
  response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache', 'Content-Length': statSync(file).size });
  if (request.method === 'HEAD') { response.end(); return; }
  createReadStream(file).on('error', () => response.destroy()).pipe(response);
}).listen(port, '127.0.0.1', () => console.log(`Mining: http://127.0.0.1:${port}`));
