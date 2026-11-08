// Lógica de `pnpm db:init`: crea los roles y las bases de PostgreSQL del proyecto de forma idempotente.
// Solo toca objetos con el prefijo del proyecto (por defecto `sigiso`); nunca los de otros proyectos.
import { randomBytes } from 'node:crypto';

const PATRON_PREFIJO = /^[a-z][a-z0-9_]{0,30}$/;

export const configuracion = (prefijo = 'sigiso') => {
  if (!PATRON_PREFIJO.test(prefijo))
    throw new Error(`Prefijo no válido: "${prefijo}" (minúsculas, dígitos y guion bajo; empieza con letra)`);
  return {
    prefijo,
    roles: {
      owner: `${prefijo}_owner`,
      app: `${prefijo}_app`,
      catalogo: `${prefijo}_catalogo`,
      plataforma: `${prefijo}_plataforma`,
      openfga: `${prefijo}_openfga`,
    },
    bases: {
      principal: prefijo,
      prueba: `${prefijo}_test`,
      openfga: prefijo === 'sigiso' ? 'openfga' : `${prefijo}_openfga`,
    },
  };
};

export const generarClave = () => randomBytes(32).toString('base64url');

export const construirUrl = ({ usuario, clave, host, puerto, base }) =>
  `postgresql://${encodeURIComponent(usuario)}:${encodeURIComponent(clave)}@${host}:${puerto}/${base}`;

export const claveDeUrl = (url) => {
  if (!url) return undefined;
  try {
    const { password } = new URL(url);
    return password ? decodeURIComponent(password) : undefined;
  } catch {
    return undefined;
  }
};

export const parsearEnv = (texto) => {
  const mapa = new Map();
  for (const linea of texto.split(/\r?\n/)) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(linea);
    if (m) mapa.set(m[1], m[2]);
  }
  return mapa;
};

/** Actualiza o agrega claves en el texto de un archivo de entorno, conservando comentarios y el resto de líneas. */
export const actualizarEnv = (texto, claves) => {
  const lineas = texto === '' ? [] : texto.replace(/\n$/, '').split('\n');
  for (const [clave, valor] of Object.entries(claves)) {
    const i = lineas.findIndex((l) => l.startsWith(`${clave}=`));
    if (i >= 0) lineas[i] = `${clave}=${valor}`;
    else lineas.push(`${clave}=${valor}`);
  }
  return `${lineas.join('\n')}\n`;
};

const ATRIBUTOS = 'LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION';

/**
 * Crea (o repara) roles y bases. `admin` es un cliente `pg` conectado como superusuario.
 * No imprime ni devuelve nada fuera del texto del archivo de entorno que contiene las claves.
 */
export const inicializar = async ({
  admin,
  config,
  textoEnv,
  host = '127.0.0.1',
  puerto = 5432,
  generar = generarClave,
}) => {
  const id = (nombre) => admin.escapeIdentifier(nombre);
  const lit = (valor) => admin.escapeLiteral(valor);
  const env = parsearEnv(textoEnv);
  const { roles, bases } = config;

  // Clave de cada rol: la que ya está en el archivo de entorno, o una nueva.
  const clavesActuales = {
    [roles.owner]: claveDeUrl(env.get('DATABASE_URL_OWNER')),
    [roles.app]: claveDeUrl(env.get('DATABASE_URL_APP')),
    [roles.catalogo]: claveDeUrl(env.get('DATABASE_URL_CATALOGO')),
    [roles.plataforma]: claveDeUrl(env.get('DATABASE_URL_PLATAFORMA')),
    [roles.openfga]: claveDeUrl(env.get('OPENFGA_DATASTORE_URI')),
  };
  const clave = Object.fromEntries(Object.values(roles).map((r) => [r, clavesActuales[r] ?? generar()]));

  const creados = { roles: [], bases: [] };

  const { rows: rolesExistentes } = await admin.query('select rolname from pg_roles where rolname = any($1)', [
    Object.values(roles),
  ]);
  const hayRol = new Set(rolesExistentes.map((f) => f.rolname));
  for (const rol of Object.values(roles)) {
    if (hayRol.has(rol)) {
      await admin.query(`ALTER ROLE ${id(rol)} ${ATRIBUTOS} PASSWORD ${lit(clave[rol])}`);
    } else {
      await admin.query(`CREATE ROLE ${id(rol)} ${ATRIBUTOS} PASSWORD ${lit(clave[rol])}`);
      creados.roles.push(rol);
    }
  }

  const duenos = { [bases.principal]: roles.owner, [bases.prueba]: roles.owner, [bases.openfga]: roles.openfga };
  const { rows: basesExistentes } = await admin.query('select datname from pg_database where datname = any($1)', [
    Object.values(bases),
  ]);
  const hayBase = new Set(basesExistentes.map((f) => f.datname));
  for (const [base, dueno] of Object.entries(duenos)) {
    if (hayBase.has(base)) {
      await admin.query(`ALTER DATABASE ${id(base)} OWNER TO ${id(dueno)}`);
    } else {
      await admin.query(`CREATE DATABASE ${id(base)} OWNER ${id(dueno)}`);
      creados.bases.push(base);
    }
  }

  // Solo los roles del proyecto pueden conectarse a sus bases.
  const conectan = {
    [bases.principal]: [roles.owner, roles.app, roles.catalogo, roles.plataforma],
    [bases.prueba]: [roles.owner, roles.app, roles.catalogo, roles.plataforma],
    [bases.openfga]: [roles.openfga],
  };
  for (const [base, lista] of Object.entries(conectan)) {
    await admin.query(`REVOKE ALL ON DATABASE ${id(base)} FROM PUBLIC`);
    for (const rol of lista) await admin.query(`GRANT CONNECT ON DATABASE ${id(base)} TO ${id(rol)}`);
  }

  const url = (rol, base) => construirUrl({ usuario: rol, clave: clave[rol], host, puerto, base });
  const nuevoTexto = actualizarEnv(textoEnv, {
    DATABASE_URL_OWNER: url(roles.owner, bases.principal),
    DATABASE_URL_APP: url(roles.app, bases.principal),
    DATABASE_URL_CATALOGO: url(roles.catalogo, bases.principal),
    DATABASE_URL_PLATAFORMA: url(roles.plataforma, bases.principal),
    DATABASE_URL_TEST: url(roles.owner, bases.prueba),
    OPENFGA_DATASTORE_URI: url(roles.openfga, bases.openfga),
  });

  return { creados, textoEnv: nuevoTexto, cambios: nuevoTexto !== textoEnv };
};
