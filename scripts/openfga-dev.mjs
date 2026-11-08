// pnpm openfga:start | openfga:stop | openfga:status — OpenFGA local (ADR 025). Solo Node.
// Requiere `brew install openfga` (tarea 9.1), la base `openfga` (pnpm db:init) y .env.local con OPENFGA_DATASTORE_URI.
// Escucha solo en 127.0.0.1 y exige la clave OPENFGA_API_TOKEN (se genera en .env.local la primera vez).
import { spawn, spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { actualizarEnv, generarClave, parsearEnv } from './lib/db-init.mjs';
import { puertoOcupado } from './lib/keycloak-proceso.mjs';
import { argumentosEjecucion, argumentosMigracion, entornoOpenfga } from './lib/openfga-proceso.mjs';
import { leerPid, procesoVivo } from './lib/proceso-local.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const local = join(raiz, '.local');
const archivoPid = join(local, 'openfga.pid');
const archivoLog = join(local, 'openfga.log');
const archivoEnv = join(raiz, '.env.local');
const puertoHttp = Number(process.env.OPENFGA_PORT ?? 8081);
const puertoGrpc = Number(process.env.OPENFGA_GRPC_PORT ?? 8082);
const url = `http://127.0.0.1:${puertoHttp}`;
const win = process.platform === 'win32';
const orden = win ? 'openfga.exe' : 'openfga';

const leerEnv = () => parsearEnv(existsSync(archivoEnv) ? readFileSync(archivoEnv, 'utf8') : '');
const sano = async () => {
  try {
    return (await fetch(`${url}/healthz`, { signal: AbortSignal.timeout(2000) })).ok;
  } catch {
    return false;
  }
};

const claveDeApi = () => {
  const env = leerEnv();
  const existente = env.get('OPENFGA_API_TOKEN');
  if (existente) return existente;
  const nueva = generarClave();
  mkdirSync(dirname(archivoEnv), { recursive: true });
  writeFileSync(
    archivoEnv,
    actualizarEnv(existsSync(archivoEnv) ? readFileSync(archivoEnv, 'utf8') : '', { OPENFGA_API_TOKEN: nueva }),
    { mode: 0o600 },
  );
  return nueva;
};

const arrancar = async () => {
  const previo = leerPid(archivoPid);
  if (previo && procesoVivo(previo))
    throw new Error(`OpenFGA ya está en marcha (pid ${previo}). Usa pnpm openfga:stop`);
  for (const p of [puertoHttp, puertoGrpc]) {
    if (await puertoOcupado('127.0.0.1', p)) throw new Error(`El puerto ${p} ya está en uso: no se arranca OpenFGA`);
  }
  const datastoreUri = leerEnv().get('OPENFGA_DATASTORE_URI');
  if (!datastoreUri) throw new Error('Falta OPENFGA_DATASTORE_URI: ejecuta pnpm db:init');
  const entorno = entornoOpenfga({ datastoreUri, apiToken: claveDeApi(), base: process.env, puertoHttp, puertoGrpc });
  mkdirSync(local, { recursive: true });

  const migracion = spawnSync(orden, argumentosMigracion(), { env: entorno, encoding: 'utf8', windowsHide: true });
  if (migracion.error) throw new Error('No se encontró OpenFGA: instálalo con brew install openfga');
  if (migracion.status !== 0)
    throw new Error(`La migración de OpenFGA falló (código ${migracion.status}); revisa la base «openfga»`);

  const log = openSync(archivoLog, 'w', 0o600);
  const hijo = spawn(orden, argumentosEjecucion(), {
    env: entorno,
    detached: true,
    stdio: ['ignore', log, log],
    windowsHide: true,
  });
  closeSync(log);
  let salio = null;
  hijo.once('exit', (codigo) => (salio = codigo ?? 1));
  hijo.unref();
  writeFileSync(archivoPid, `${hijo.pid}\n`);
  for (let i = 0; i < 30; i += 1) {
    if (salio !== null) throw new Error(`OpenFGA terminó al arrancar (código ${salio}); revisa .local/openfga.log`);
    if (await sano()) {
      console.log(`Listo: ${url} (HTTP) y 127.0.0.1:${puertoGrpc} (gRPC), solo en 127.0.0.1, con clave`);
      return;
    }
    await esperar(1000);
  }
  throw new Error('OpenFGA no respondió en 30 s; revisa .local/openfga.log (pnpm openfga:stop para detenerlo)');
};

const parar = async (argumentos) => {
  const pid = leerPid(archivoPid);
  if (!pid || !procesoVivo(pid)) {
    rmSync(archivoPid, { force: true });
    console.log('OpenFGA no está en marcha.');
    return;
  }
  if (win) spawnSync('taskkill', ['/pid', String(pid), '/T', ...(argumentos.includes('--forzar') ? ['/F'] : [])]);
  else process.kill(pid, argumentos.includes('--forzar') ? 'SIGKILL' : 'SIGTERM');
  for (let i = 0; i < 20; i += 1) {
    if (!procesoVivo(pid)) {
      rmSync(archivoPid, { force: true });
      console.log('OpenFGA detenido.');
      return;
    }
    await esperar(1000);
  }
  throw new Error(`OpenFGA (pid ${pid}) no terminó en 20 s; usa pnpm openfga:stop --forzar`);
};

const estado = async () => {
  const pid = leerPid(archivoPid);
  console.log(`Proceso: ${pid !== null && procesoVivo(pid) ? `en marcha (pid ${pid})` : 'detenido'}`);
  console.log(`Salud en ${url}/healthz: ${(await sano()) ? 'sí' : 'no'}`);
  if (!(await sano())) return;
  const sinClave = await fetch(`${url}/stores`).then(
    (r) => r.status,
    () => 0,
  );
  const clave = leerEnv().get('OPENFGA_API_TOKEN') ?? '';
  const conClave = await fetch(`${url}/stores`, { headers: { authorization: `Bearer ${clave}` } }).then(
    (r) => r.status,
    () => 0,
  );
  console.log(`Sin clave: ${sinClave} (debe ser 401) · con clave: ${conClave} (debe ser 200)`);
};

try {
  const [comando, ...resto] = process.argv.slice(2);
  const comandos = { start: arrancar, stop: parar, status: estado };
  if (comandos[comando]) await comandos[comando](resto);
  else {
    console.error('Uso: node scripts/openfga-dev.mjs start | stop [--forzar] | status');
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
