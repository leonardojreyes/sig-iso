// Arranque local de Keycloak (ADR 025): solo en 127.0.0.1, heap acotado y realm importado. Solo Node.
import { existsSync, readdirSync } from 'node:fs';
import { connect } from 'node:net';
import { join } from 'node:path';

export const HOST = '127.0.0.1';
const HEAP = '-Xms128m -Xmx512m';
// Opciones del entorno del usuario que cambiarían dónde escucha, qué base usa o cuánta memoria toma.
const HEREDABLES_PROHIBIDAS = /^(JAVA_OPTS|JAVA_OPTS_APPEND|JAVA_OPTS_KC_HEAP|JAVA_HOME|KC_.*|KEYCLOAK_.*)$/;

export const argumentosArranque = ({ puerto }) => {
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) throw new Error(`Puerto inválido: ${String(puerto)}`);
  return [
    'start-dev',
    `--http-host=${HOST}`,
    `--http-port=${puerto}`,
    `--hostname=http://${HOST}:${puerto}`,
    '--import-realm',
  ];
};

export const entornoArranque = ({ javaHome, secretos, base }) => {
  if (!secretos?.usuario || !secretos?.clave)
    throw new Error('Falta el administrador de Keycloak: ejecuta pnpm keycloak:realm');
  const limpio = Object.fromEntries(Object.entries(base).filter(([k]) => !HEREDABLES_PROHIBIDAS.test(k)));
  return {
    ...limpio,
    JAVA_HOME: javaHome,
    JAVA_OPTS_KC_HEAP: HEAP,
    KC_BOOTSTRAP_ADMIN_USERNAME: secretos.usuario,
    KC_BOOTSTRAP_ADMIN_PASSWORD: secretos.clave,
  };
};

export const rutaKc = (home, plataforma = process.platform) =>
  join(home, 'bin', plataforma === 'win32' ? 'kc.bat' : 'kc.sh');

export const encontrarJavaHome = (carpetaJre) => {
  const faltante = new Error('El JRE no está instalado: ejecuta pnpm keycloak:install');
  if (!existsSync(carpetaJre)) throw faltante;
  const jre = readdirSync(carpetaJre).find((nombre) => nombre.startsWith('jdk-'));
  if (!jre) throw faltante;
  const macos = join(carpetaJre, jre, 'Contents', 'Home');
  return existsSync(macos) ? macos : join(carpetaJre, jre);
};

export const puertoOcupado = (host, puerto) =>
  new Promise((resolver) => {
    const socket = connect({ host, port: puerto });
    socket.once('connect', () => {
      socket.destroy();
      resolver(true);
    });
    socket.once('error', () => resolver(false));
  });
