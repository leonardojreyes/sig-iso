// pnpm db:init — crea los roles y bases de PostgreSQL del proyecto y escribe sus URLs en .env.local.
// Idempotente. Se conecta como superusuario local (PGUSER, por defecto el usuario del sistema).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { userInfo } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { configuracion, inicializar } from './lib/db-init.mjs';

const raiz = join(import.meta.dirname, '..');
const arg = (nombre) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const archivoEnv = arg('env') ?? join(raiz, '.env.local');
const config = configuracion(arg('prefijo') ?? 'sigiso');
const host = process.env.PGHOST ?? '127.0.0.1';
const puerto = Number(process.env.PGPORT ?? 5432);

const admin = new pg.Client({ host, port: puerto, user: process.env.PGUSER ?? userInfo().username, database: 'postgres' });
try {
  await admin.connect();
} catch (error) {
  console.error(`✖ No pude conectarme a PostgreSQL en ${host}:${puerto}: ${error.message}`);
  console.error('  ¿Está corriendo? (brew services start postgresql@16). Puedes indicar otro usuario con PGUSER y PGPASSWORD.');
  process.exit(1);
}

try {
  const { rows } = await admin.query('select rolsuper from pg_roles where rolname = current_user');
  if (!rows[0]?.rolsuper) {
    console.error('✖ El usuario de conexión no es superusuario; se necesita para crear roles y bases. Indica otro con PGUSER.');
    process.exit(1);
  }

  const textoEnv = existsSync(archivoEnv) ? readFileSync(archivoEnv, 'utf8') : '';
  const r = await inicializar({ admin, config, textoEnv, host, puerto });
  if (r.cambios) writeFileSync(archivoEnv, r.textoEnv, { mode: 0o600 });

  const todos = Object.values(config.roles);
  console.log(`Roles: ${todos.map((x) => `${x}${r.creados.roles.includes(x) ? ' (creado)' : ''}`).join(', ')}`);
  console.log(`Bases: ${Object.values(config.bases).map((x) => `${x}${r.creados.bases.includes(x) ? ' (creada)' : ''}`).join(', ')}`);
  console.log(r.cambios ? `Claves escritas en ${archivoEnv} (no se muestran).` : 'Sin cambios: todo estaba al día.');
} finally {
  await admin.end();
}
