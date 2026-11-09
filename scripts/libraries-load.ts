// pnpm libraries:load — carga al catálogo global las librerías de libraries/normas/ (ADR 026). Corre con el rol `sigiso_catalogo`,
// valida cada archivo (esquema y control de texto), es idempotente y rechaza una versión ya cargada con otro contenido.
// Opciones: `--dir <carpeta>` y `--prueba` (base de pruebas). Solo corre contra una base local. No imprime el contenido de los archivos.
import { join } from 'node:path';
import { Bitacora, BitacoraKysely } from '@sig/auditoria';
import { GestorPools, leerUrls } from '@sig/db';
import { exigirBaseLocal } from './lib/datos-siembra.js';
import { cargarCatalogo, evaluarCarpeta } from './lib/carga-catalogo.js';

const i = process.argv.indexOf('--dir');
const dir =
  i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : join(import.meta.dirname, '..', 'libraries', 'normas');
const prueba = process.argv.includes('--prueba');

let pools: GestorPools | undefined;
try {
  const urls = leerUrls(process.env, ['app', 'plataforma', 'catalogo'], { prueba });
  exigirBaseLocal(urls.catalogo!, process.env);
  const evaluaciones = evaluarCarpeta(dir);
  if (evaluaciones.length === 0) throw new Error('No hay archivos .yaml ni .yml en la carpeta de librerías');
  pools = new GestorPools(urls, { max: 3 });
  const resultados = await cargarCatalogo(
    {
      catalogo: pools.db('catalogo'),
      bitacora: new Bitacora(new BitacoraKysely({ app: pools.db('app'), plataforma: pools.db('plataforma') })),
    },
    evaluaciones,
  );
  let rechazadas = 0;
  for (const r of resultados) {
    const nombre = r.codigo ? `${r.codigo}@${r.version}` : r.archivo;
    if (r.estado === 'cargada') console.log(`✔ ${nombre}: cargada (${r.entradas} entradas)`);
    else if (r.estado === 'ya_cargada') console.log(`= ${nombre}: ya estaba cargada, sin cambios`);
    else {
      rechazadas += 1;
      console.error(`✖ ${nombre}: rechazada (${r.estado})`);
      for (const e of r.errores) console.error(`    ${e.ruta || '(librería)'}: ${e.codigo}`);
      if (r.estado === 'hash_distinto')
        console.error('    Esa versión ya está cargada con otro contenido: publica una versión nueva.');
    }
  }
  if (rechazadas > 0) process.exitCode = 1;
} catch (error) {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await pools?.cerrar();
}
