// Stop: pruebas de los módulos afectados y escaneo de secretos en archivos cambiados.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { leerEntrada } from './lib.mjs';

if (leerEntrada().stop_hook_active) process.exit(0); // evita bucles

const win = process.platform === 'win32';
const git = (args) => spawnSync('git', args, { encoding: 'utf8' }).stdout?.split('\n').filter(Boolean) ?? [];
const cambiados = [...new Set([...git(['diff', '--name-only', 'HEAD']), ...git(['ls-files', '--others', '--exclude-standard'])])]
  .map((f) => f.replaceAll('\\', '/'));
if (!cambiados.length) process.exit(0);

const problemas = [];

// 1) Escaneo de secretos (patrones comunes; gitleaks completo corre en CI, paso 0.4)
const secretos = [
  /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/,
  /\bsk-[A-Za-z0-9]{32,}\b/,
  /(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*['"][^'"\s]{12,}['"]/i,
];
for (const f of cambiados) {
  if (!/\.(ts|tsx|mjs|js|json|ya?ml|md|sql|env.*)$/.test(f) || f.endsWith('.env.example') || f.includes('.test.')) continue;
  let txt = '';
  try { txt = readFileSync(f, 'utf8'); } catch { continue; }
  if (secretos.some((r) => r.test(txt))) problemas.push(`Posible secreto en ${f}`);
}

// 2) Pruebas de los módulos/apps afectados
const proyectos = new Set(cambiados.map((f) => f.match(/^(apps|modules|packages|platform)\/([^/]+)\//)).filter(Boolean).map((m) => `${m[1]}/${m[2]}`));
for (const p of proyectos) {
  const pkg = `${p}/package.json`;
  let nombre;
  try { const j = JSON.parse(readFileSync(pkg, 'utf8')); if (!j.scripts?.test) continue; nombre = j.name; } catch { continue; }
  const r = spawnSync(win ? 'pnpm.cmd' : 'pnpm', ['--filter', nombre, 'test'], { encoding: 'utf8', shell: win });
  if (r.status !== 0) problemas.push(`Pruebas fallan en ${nombre}:\n${(r.stdout + r.stderr).slice(-1500)}`);
}

if (problemas.length) {
  process.stderr.write(`Antes de terminar corrige:\n${problemas.join('\n\n')}\n`);
  process.exit(2);
}
