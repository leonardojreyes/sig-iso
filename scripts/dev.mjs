// Levanta api (3001) y web (3000) en paralelo. Ctrl+C detiene ambos. `pnpm dev web` o `pnpm dev api` levanta solo uno.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { entornoDeServicio } from './lib/dev-env.mjs';

const win = process.platform === 'win32';
const bin = win ? 'pnpm.cmd' : 'pnpm';
// Los tokens de diseño se compilan a CSS antes de arrancar (dist/ no se versiona).
spawnSync(bin, ['--filter', '@sig/tokens', 'build:tokens'], { stdio: 'inherit', shell: win });

// Cada servicio recibe del .env.local solo las variables que necesita (ver scripts/lib/dev-env.mjs).
const archivoEnv = join(dirname(fileURLToPath(import.meta.url)), '..', '.env.local');
const textoEnv = existsSync(archivoEnv) ? readFileSync(archivoEnv, 'utf8') : '';

const solo = process.argv[2];
if (solo !== undefined && !['api', 'web'].includes(solo)) {
  console.error('Uso: pnpm dev [api|web]');
  process.exit(1);
}
const procs = [
  ['api', ['--filter', '@sig/api', 'dev']],
  ['web', ['--filter', '@sig/web', 'dev']],
]
  .filter(([name]) => solo === undefined || name === solo)
  .map(([name, args]) => {
    const p = spawn(bin, args, { stdio: 'inherit', shell: win, env: entornoDeServicio(name, textoEnv, process.env) });
    p.on('exit', (code) => {
      console.log(`[${name}] terminó con código ${code}`);
      shutdown(code ?? 1);
    });
    return p;
  });

let closing = false;
function shutdown(code) {
  if (closing) return;
  closing = true;
  for (const p of procs) p.kill();
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
console.log('\n  Web:     http://localhost:3000\n  API doc: http://localhost:3001/docs\n');
