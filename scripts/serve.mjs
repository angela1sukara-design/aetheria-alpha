import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
if (!process.argv.includes('--built')) { const built = spawnSync(process.execPath, [path.join(root, 'scripts/build.mjs')], { stdio: 'inherit' }); if (built.status !== 0) process.exit(1); }
const directory = path.join(root, 'dist'); const port = Number(process.env.PORT || 4173);
const packageInfo = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(directory, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(directory + path.sep)) { res.writeHead(403); res.end(); return; }
    if (!(await stat(file)).isFile()) throw new Error('not found');
    res.writeHead(200, { 'Content-Type': (types[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Close the previous game server window, then run start_game.bat again.` : error.message);
  process.exitCode = 1;
});
server.listen(port, '0.0.0.0', () => {
  const url = `http://localhost:${port}/`;
  console.log(`Aetheria Alpha ${packageInfo.version}: ${url}`);
  if (process.argv.includes('--open') && process.platform === 'win32') spawn('cmd.exe', ['/c', 'start', '', url], { stdio: 'ignore' });
});
