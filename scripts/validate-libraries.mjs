// Valida libraries/normas/**/*.yaml contra el esquema JSON (P14). Sale con código 1 si alguna falla.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse } from 'yaml';

const raiz = join(import.meta.dirname, '..');
const esquema = JSON.parse(readFileSync(join(raiz, 'packages/normas-schema/libreria-norma.schema.json'), 'utf8'));
const validar = new Ajv2020({ allErrors: true }).compile(esquema);

const archivos = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : /\.ya?ml$/.test(n) ? [p] : [];
  });

const lista = archivos(join(raiz, 'libraries/normas'));
let fallos = 0;
for (const f of lista) {
  if (!validar(parse(readFileSync(f, 'utf8')))) {
    fallos++;
    console.error(`✖ ${f}\n${JSON.stringify(validar.errors, null, 2)}`);
  } else console.log(`✔ ${f}`);
}
console.log(`${lista.length} librería(s) revisada(s), ${fallos} con errores`);
process.exit(fallos ? 1 : 0);
