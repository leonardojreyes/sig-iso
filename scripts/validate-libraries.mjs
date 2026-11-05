// pnpm libraries:validate — valida libraries/normas/**/*.yaml con el esquema v2 y sus reglas (P14, ADR 026).
// Sale con código 1 si alguna falla. No imprime el contenido de las librerías, solo códigos y rutas.
// Uso: node --import tsx scripts/validate-libraries.mjs [--dir <carpeta>]
import { join } from 'node:path';
import { validarDirectorio } from './lib/validar-librerias.mjs';

const i = process.argv.indexOf('--dir');
const dir = i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : join(import.meta.dirname, '..', 'libraries/normas');

const resultados = validarDirectorio(dir);
let fallos = 0;
for (const r of resultados) {
  if (r.ok) {
    console.log(`✔ ${r.archivo}`);
    continue;
  }
  fallos++;
  console.error(`✖ ${r.archivo}`);
  for (const e of r.errores) console.error(`    ${e.ruta === '' ? '(librería)' : e.ruta}  ${e.codigo}${e.entrada ? `  [entrada ${e.entrada}]` : ''}`);
}
console.log(`${resultados.length} librería(s) revisada(s), ${fallos} con errores`);
process.exit(fallos ? 1 : 0);
