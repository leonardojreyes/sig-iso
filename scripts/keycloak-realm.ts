// pnpm keycloak:realm — genera el realm de desarrollo resuelto en .local/realm/ (ignorado por git) a partir de la plantilla
// de infra/keycloak/, las cuentas de prueba de la siembra y secretos generados (ADR 025). Idempotente: no cambia los secretos
// ya entregados. Escribe en .env.local los secretos del cliente web, del administrador y de la cuenta de eventos.
// No imprime ninguna contraseña ni secreto: solo dónde quedaron.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { actualizarEnv } from './lib/db-init.mjs';
import { DATOS_SIEMBRA } from './lib/datos-siembra.ts';
import { generarSecretos, resolverRealm } from './lib/realm-keycloak.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const leerJson = (ruta: string) => JSON.parse(readFileSync(ruta, 'utf8'));
const escribirPrivado = (ruta: string, texto: string) => {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, texto, { mode: 0o600 });
};

try {
  const origenWeb = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
  const archivoSecretos = join(raiz, '.local', 'secretos-keycloak.json');
  const archivoRealm = join(raiz, '.local', 'realm', 'sigiso-realm.json');
  const archivoEnv = join(raiz, '.env.local');

  const secretos = generarSecretos({
    existentes: existsSync(archivoSecretos) ? leerJson(archivoSecretos) : {},
    aliases: DATOS_SIEMBRA.usuarios.map((u) => u.alias),
  });
  escribirPrivado(archivoSecretos, `${JSON.stringify(secretos, null, 2)}\n`);

  const realm = resolverRealm({
    plantilla: leerJson(join(raiz, 'infra', 'keycloak', 'realm-sigiso.plantilla.json')),
    perfil: leerJson(join(raiz, 'infra', 'keycloak', 'perfil-usuario.json')),
    valores: { WEB_ORIGIN: origenWeb, ...secretos.marcadores },
    usuarios: DATOS_SIEMBRA.usuarios,
    clavesUsuarios: secretos.usuarios,
  });
  escribirPrivado(archivoRealm, `${JSON.stringify(realm, null, 2)}\n`);

  const textoEnv = existsSync(archivoEnv) ? readFileSync(archivoEnv, 'utf8') : '';
  escribirPrivado(
    archivoEnv,
    actualizarEnv(textoEnv, {
      OIDC_CLIENT_SECRET: secretos.marcadores.OIDC_CLIENT_SECRET,
      KEYCLOAK_ADMIN_USER: 'sigiso-admin',
      KEYCLOAK_ADMIN_PASSWORD: secretos.adminPassword,
      KEYCLOAK_EVENTS_CLIENT_ID: 'sigiso-events',
      KEYCLOAK_EVENTS_CLIENT_SECRET: secretos.marcadores.KEYCLOAK_EVENTS_CLIENT_SECRET,
    }),
  );

  console.log('Realm resuelto: .local/realm/sigiso-realm.json (ignorado por git)');
  console.log('Contraseñas de las cuentas de prueba: .local/secretos-keycloak.json (ignorado por git)');
  console.log('Secretos del cliente web, del administrador y de eventos: .env.local');
} catch (error) {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
