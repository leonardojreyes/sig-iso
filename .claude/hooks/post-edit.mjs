// PostToolUse (Edit|Write): formatea, lint y tipos del archivo tocado. Informa errores a Claude (exit 2).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { leerEntrada, normalizar } from './lib.mjs';

const ruta = normalizar(leerEntrada().tool_input?.file_path ?? '');
if (!/\.(ts|tsx|mjs|js|json|md|yml|yaml)$/.test(ruta) || ruta.includes('/node_modules/') || !existsSync(ruta)) process.exit(0);

const win = process.platform === 'win32';
const pnpm = win ? 'pnpm.cmd' : 'pnpm';
const correr = (args) => spawnSync(pnpm, ['exec', ...args], { encoding: 'utf8', shell: win });

correr(['prettier', '--write', '--log-level', 'silent', ruta]);

const problemas = [];
if (/\.(ts|tsx|mjs|js)$/.test(ruta)) {
  const lint = correr(['eslint', ruta]);
  if (lint.status !== 0) problemas.push(`ESLint:\n${lint.stdout}${lint.stderr}`);

  if (/\.tsx?$/.test(ruta)) {
    let dir = dirname(ruta);
    while (dir.length > 1 && !existsSync(join(dir, 'tsconfig.json'))) dir = dirname(dir);
    if (existsSync(join(dir, 'tsconfig.json')) && dir !== process.cwd()) {
      const tsc = correr(['tsc', '--noEmit', '-p', dir]);
      if (tsc.status !== 0) problemas.push(`Tipos (${dir}):\n${tsc.stdout}`.slice(0, 2000));
    }
  }
}
if (problemas.length) {
  process.stderr.write(`Corrige antes de continuar (${ruta}):\n${problemas.join('\n')}\n`);
  process.exit(2);
}
