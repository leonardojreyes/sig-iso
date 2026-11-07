// pnpm keycloak:install — instala Keycloak 26.8.2 y su JRE Temurin 21 en .local/ (ADR 025). Solo Node.
// Uso: node scripts/keycloak-dev.mjs install [--si]
// Antes de descargar muestra tamaños y pide confirmación; sin terminal interactiva exige --si.
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  KEYCLOAK,
  descargarConFetch,
  elegirJre,
  extraerArchivo,
  formatearPlan,
  instalarPaquete,
  listarEntradas,
} from './lib/keycloak-dev.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const local = join(raiz, '.local');
const destinos = { keycloak: join(local, 'keycloak'), jre: join(local, 'jre') };
const descargas = join(local, 'descargas');

const confirmar = async (pregunta) => {
  if (!process.stdin.isTTY) return false;
  const lector = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    return /^(s|si|sí|y|yes)$/i.test((await lector.question(`${pregunta} [s/N] `)).trim());
  } finally {
    lector.close();
  }
};

const instalar = async (argumentos) => {
  const jre = elegirJre(process.platform, process.arch);
  const paquetes = [
    { paquete: KEYCLOAK, destino: destinos.keycloak },
    { paquete: jre, destino: destinos.jre },
  ];
  console.log(formatearPlan(paquetes.map(({ paquete }) => paquete)));
  console.log(`Destino (ignorado por git): ${local}`);
  if (!argumentos.includes('--si') && !(await confirmar('¿Descargar e instalar?'))) {
    console.log('Cancelado: no se descargó nada. (Sin terminal interactiva usa --si.)');
    process.exitCode = 1;
    return;
  }
  for (const { paquete, destino } of paquetes) {
    console.log(`→ ${paquete.nombre}…`);
    const { yaInstalado } = await instalarPaquete({
      paquete,
      destino,
      descargas,
      descargar: descargarConFetch,
      listar: listarEntradas,
      extraer: extraerArchivo,
    });
    console.log(
      yaInstalado ? '  ya instalado con la misma huella' : `  verificado (SHA-256) e instalado en ${destino}`,
    );
  }
};

try {
  const [orden, ...resto] = process.argv.slice(2);
  if (orden === 'install') await instalar(resto);
  else {
    console.error('Uso: node scripts/keycloak-dev.mjs install [--si]');
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
