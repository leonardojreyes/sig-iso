// Verifica licencias de dependencias (regla 5.9). Falla con AGPL/SSPL/BSL/GPL salvo excepción con ADR.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const win = process.platform === 'win32';
const r = spawnSync(win ? 'pnpm.cmd' : 'pnpm', ['licenses', 'list', '--json'], { encoding: 'utf8', shell: win, maxBuffer: 1 << 28 });
if (r.status !== 0) { console.error(r.stderr); process.exit(2); }

const porLicencia = JSON.parse(r.stdout);
const prohibidas = /(^|[^L])GPL|AGPL|SSPL|BUSL|Business Source|Commons Clause|Elastic License/i;
const excepciones = existsSync('docs/security/licencias-excepciones.json')
  ? JSON.parse(readFileSync('docs/security/licencias-excepciones.json', 'utf8')) // { "paquete": "ADR-0xx" }
  : {};

let fallos = 0;
for (const [licencia, paquetes] of Object.entries(porLicencia)) {
  if (!prohibidas.test(licencia)) continue;
  for (const p of paquetes) {
    if (excepciones[p.name]) continue;
    fallos++;
    console.error(`✖ ${p.name}@${p.versions?.join(',')} — licencia ${licencia} no permitida (requiere ADR de excepción)`);
  }
}
const total = Object.values(porLicencia).reduce((n, l) => n + l.length, 0);
console.log(`${total} paquetes revisados, ${fallos} con licencia no permitida`);
process.exit(fallos ? 1 : 0);
