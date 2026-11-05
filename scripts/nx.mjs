// Ejecuta Nx sin daemon (ahorra RAM en equipos de 8 GB). Funciona igual en Windows y macOS.
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const bin = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const child = spawn(bin, ['exec', 'nx', ...args], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, NX_DAEMON: 'false' },
});
child.on('exit', (code) => process.exit(code ?? 1));
