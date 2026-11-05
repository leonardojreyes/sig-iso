// Levanta api (3001) y web (3000) en paralelo. Ctrl+C detiene ambos.
import { spawn, spawnSync } from 'node:child_process';

const win = process.platform === 'win32';
const bin = win ? 'pnpm.cmd' : 'pnpm';
// Los tokens de diseño se compilan a CSS antes de arrancar (dist/ no se versiona).
spawnSync(bin, ['--filter', '@sig/tokens', 'build:tokens'], { stdio: 'inherit', shell: win });

const procs = [
  ['api', ['--filter', '@sig/api', 'dev']],
  ['web', ['--filter', '@sig/web', 'dev']],
].map(([name, args]) => {
  const p = spawn(bin, args, { stdio: 'inherit', shell: win });
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
