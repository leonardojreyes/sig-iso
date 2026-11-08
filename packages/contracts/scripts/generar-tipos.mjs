// Genera src/generado/api.d.ts desde openapi.yaml. Con --check no escribe: falla si el archivo está desactualizado.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const entrada = join(raiz, 'openapi.yaml');
const salida = join(raiz, 'src', 'generado', 'api.d.ts');
const cabecera =
  '// ARCHIVO GENERADO desde openapi.yaml con `pnpm --filter @sig/contracts generar`. No editar a mano.\n\n';

export const generar = async () => {
  const ast = await openapiTS(new URL(`file://${entrada}`));
  return cabecera + astToString(ast).replace(/\r\n/g, '\n');
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const nuevo = await generar();
  if (process.argv.includes('--check')) {
    const actual = existsSync(salida) ? readFileSync(salida, 'utf8').replace(/\r\n/g, '\n') : '';
    if (actual !== nuevo) {
      console.error('Los tipos generados están desactualizados: ejecute `pnpm --filter @sig/contracts generar`.');
      process.exit(1);
    }
    console.log('Tipos generados al día.');
  } else {
    mkdirSync(dirname(salida), { recursive: true });
    writeFileSync(salida, nuevo);
    console.log(`Generado ${salida}`);
  }
}
