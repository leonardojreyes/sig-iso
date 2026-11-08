// pnpm keycloak:install | keycloak:start | keycloak:stop | keycloak:status — Keycloak local (ADR 025). Solo Node.
// Uso: node scripts/keycloak-dev.mjs install [--si] | start | stop [--forzar] | status | reset --si
// install pide confirmación antes de descargar (sin terminal interactiva exige --si). start solo escucha en 127.0.0.1.
import { spawn, spawnSync } from 'node:child_process';
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { setTimeout as esperar } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parsearEnv } from './lib/db-init.mjs';
import {
  KEYCLOAK,
  descargarConFetch,
  elegirJre,
  extraerArchivo,
  formatearPlan,
  instalarPaquete,
  listarEntradas,
} from './lib/keycloak-dev.mjs';
import {
  HOST,
  argumentosArranque,
  encontrarJavaHome,
  entornoArranque,
  puertoOcupado,
  rutaKc,
} from './lib/keycloak-proceso.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const local = join(raiz, '.local');
const destinos = { keycloak: join(local, 'keycloak'), jre: join(local, 'jre') };
const home = join(destinos.keycloak, `keycloak-${KEYCLOAK.version}`);
const descargas = join(local, 'descargas');
const archivoPid = join(local, 'keycloak.pid');
const archivoLog = join(local, 'keycloak.log');
const archivoRealm = join(local, 'realm', 'sigiso-realm.json');
const puerto = Number(process.env.KEYCLOAK_PORT ?? 8080);
const win = process.platform === 'win32';

const confirmar = async (pregunta) => {
  if (!process.stdin.isTTY) return false;
  const lector = createInterface({ input: process.stdin, output: process.stdout });
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

const leerPid = () => {
  try {
    const pid = Number(readFileSync(archivoPid, 'utf8').trim());
    return Number.isInteger(pid) && pid > 1 ? pid : null;
  } catch {
    return null;
  }
};
const vivo = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
};
const urlRealm = `http://${HOST}:${puerto}/realms/sigiso/.well-known/openid-configuration`;
const listo = async () => {
  try {
    return (await fetch(urlRealm, { signal: AbortSignal.timeout(2000) })).ok;
  } catch {
    return false;
  }
};

const arrancar = async () => {
  if (!existsSync(home)) throw new Error('Keycloak no está instalado: ejecuta pnpm keycloak:install');
  if (!existsSync(archivoRealm)) throw new Error('Falta el realm resuelto: ejecuta pnpm keycloak:realm');
  const pidPrevio = leerPid();
  if (pidPrevio && vivo(pidPrevio))
    throw new Error(`Keycloak ya está en marcha (pid ${pidPrevio}). Usa pnpm keycloak:stop`);
  if (await puertoOcupado(HOST, puerto)) throw new Error(`El puerto ${puerto} ya está en uso: no se arranca Keycloak`);

  const env = parsearEnv(existsSync(join(raiz, '.env.local')) ? readFileSync(join(raiz, '.env.local'), 'utf8') : '');
  const entorno = entornoArranque({
    javaHome: encontrarJavaHome(destinos.jre),
    secretos: { usuario: env.get('KEYCLOAK_ADMIN_USER'), clave: env.get('KEYCLOAK_ADMIN_PASSWORD') },
    base: process.env,
    nivelLog: process.env.KEYCLOAK_LOG_LEVEL,
  });
  mkdirSync(join(home, 'data', 'import'), { recursive: true });
  copyFileSync(archivoRealm, join(home, 'data', 'import', 'sigiso-realm.json'));

  const log = openSync(archivoLog, 'w', 0o600);
  const hijo = spawn(rutaKc(home), argumentosArranque({ puerto }), {
    env: entorno,
    detached: true,
    stdio: ['ignore', log, log],
    windowsHide: true,
    shell: win,
  });
  closeSync(log);
  let salio = null;
  hijo.once('exit', (codigo) => (salio = codigo ?? 1));
  hijo.unref();
  writeFileSync(archivoPid, `${hijo.pid}\n`);
  console.log(`Keycloak arrancando (pid ${hijo.pid}); registro en .local/keycloak.log`);
  for (let i = 0; i < 90; i += 1) {
    if (salio !== null) throw new Error(`Keycloak terminó al arrancar (código ${salio}); revisa .local/keycloak.log`);
    if (await listo()) {
      console.log(`Listo: ${urlRealm.replace('/.well-known/openid-configuration', '')} (solo en ${HOST})`);
      return;
    }
    await esperar(2000);
  }
  throw new Error(
    'Keycloak no respondió en 3 minutos; revisa .local/keycloak.log (sigue en marcha: pnpm keycloak:stop)',
  );
};

const parar = async (argumentos) => {
  const pid = leerPid();
  if (!pid || !vivo(pid)) {
    rmSync(archivoPid, { force: true });
    console.log('Keycloak no está en marcha.');
    return;
  }
  if (win) spawnSync('taskkill', ['/pid', String(pid), '/T', ...(argumentos.includes('--forzar') ? ['/F'] : [])]);
  else process.kill(pid, argumentos.includes('--forzar') ? 'SIGKILL' : 'SIGTERM');
  for (let i = 0; i < 30; i += 1) {
    if (!vivo(pid)) {
      rmSync(archivoPid, { force: true });
      console.log('Keycloak detenido.');
      return;
    }
    await esperar(1000);
  }
  throw new Error(`Keycloak (pid ${pid}) no terminó en 30 s; usa pnpm keycloak:stop --forzar`);
};

const estado = async () => {
  const pid = leerPid();
  const enMarcha = pid !== null && vivo(pid);
  console.log(`Proceso: ${enMarcha ? `en marcha (pid ${pid})` : 'detenido'}`);
  console.log(`Respuesta del realm sigiso en ${HOST}:${puerto}: ${(await listo()) ? 'sí' : 'no'}`);
};

// Borra la base de desarrollo de Keycloak (cuentas y sesiones) para volver a importar el realm. Solo dentro de .local/.
const reiniciar = (argumentos) => {
  const pid = leerPid();
  if (pid && vivo(pid)) throw new Error('Detén Keycloak antes (pnpm keycloak:stop)');
  if (!argumentos.includes('--si'))
    throw new Error('Esto borra la base de desarrollo de Keycloak en .local/. Repite con --si');
  rmSync(join(home, 'data', 'h2'), { recursive: true, force: true });
  rmSync(join(home, 'data', 'import'), { recursive: true, force: true });
  console.log('Base de desarrollo de Keycloak borrada: el próximo arranque importa el realm de nuevo.');
};

try {
  const [orden, ...resto] = process.argv.slice(2);
  const ordenes = { install: instalar, start: arrancar, stop: parar, status: estado, reset: reiniciar };
  if (ordenes[orden]) await ordenes[orden](resto);
  else {
    console.error('Uso: node scripts/keycloak-dev.mjs install [--si] | start | stop [--forzar] | status | reset --si');
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
