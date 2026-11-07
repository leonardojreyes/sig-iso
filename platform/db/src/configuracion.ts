// Lee las URLs de conexión desde el entorno. Un rol de base de datos = una URL (ver ADR 024).
// Los mensajes de error nombran la variable pero nunca repiten su valor (puede contener la contraseña).

export type RolBd = 'owner' | 'app' | 'catalogo' | 'plataforma';

export const ROLES_BD: readonly RolBd[] = ['owner', 'app', 'catalogo', 'plataforma'];

const VARIABLE: Record<RolBd, string> = {
  owner: 'DATABASE_URL_OWNER',
  app: 'DATABASE_URL_APP',
  catalogo: 'DATABASE_URL_CATALOGO',
  plataforma: 'DATABASE_URL_PLATAFORMA',
};

export class ConfiguracionBdError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ConfiguracionBdError';
  }
}

export type Entorno = Readonly<Record<string, string | undefined>>;
export type UrlsPorRol = Partial<Record<RolBd, string>>;

const analizar = (variable: string, valor: string | undefined): URL => {
  if (!valor) throw new ConfiguracionBdError(`Falta la variable de entorno ${variable}`);
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    throw new ConfiguracionBdError(`${variable} no es una URL válida`);
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') throw new ConfiguracionBdError(`${variable} debe usar el protocolo postgresql://`);
  if (!url.username) throw new ConfiguracionBdError(`${variable} debe indicar el usuario`);
  if (url.pathname.length <= 1) throw new ConfiguracionBdError(`${variable} debe indicar el nombre de la base`);
  return url;
};

/**
 * URLs de los roles pedidos. Con `prueba: true` todos los roles apuntan a la base de pruebas
 * (la que indica `DATABASE_URL_TEST`; los cuatro roles comparten clave entre `sigiso` y `sigiso_test`).
 */
export const leerUrls = (env: Entorno, roles: readonly RolBd[], opciones: { prueba?: boolean } = {}): UrlsPorRol => {
  const baseDePrueba = opciones.prueba ? analizar('DATABASE_URL_TEST', env.DATABASE_URL_TEST).pathname : undefined;
  const urls: UrlsPorRol = {};
  for (const rol of roles) {
    const variable = VARIABLE[rol];
    const url = analizar(variable, env[variable]);
    if (baseDePrueba) url.pathname = baseDePrueba;
    urls[rol] = url.toString();
  }
  return urls;
};
