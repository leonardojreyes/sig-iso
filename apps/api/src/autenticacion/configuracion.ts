// Configuración de autenticación y CORS desde el entorno. Los errores nombran la variable pero nunca repiten su valor
// (puede llevar credenciales). Valores por defecto: ver docs/fase0/variables-de-entorno.md.

export type Entorno = Readonly<Record<string, string | undefined>>;

export interface ConfiguracionAuth {
  readonly emisor: string;
  readonly audiencia: string;
  readonly clienteAutorizado: string;
  readonly jwksUrl: string;
}

export class ConfiguracionInvalidaError extends Error {
  constructor(variable: string, motivo: string) {
    super(`Configuración no válida en ${variable}: ${motivo}`);
    this.name = 'ConfiguracionInvalidaError';
  }
}

const EMISOR_POR_DEFECTO = 'http://127.0.0.1:8080/realms/sigiso';

const direccion = (variable: string, valor: string): URL => {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    throw new ConfiguracionInvalidaError(variable, 'no es una URL válida');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new ConfiguracionInvalidaError(variable, 'debe usar http o https');
  if (url.username || url.password) throw new ConfiguracionInvalidaError(variable, 'no debe llevar credenciales');
  return url;
};

const texto = (env: Entorno, variable: string, porDefecto: string): string => {
  const valor = env[variable];
  if (valor === undefined) return porDefecto;
  if (valor.trim() === '') throw new ConfiguracionInvalidaError(variable, 'no puede estar vacía');
  return valor.trim();
};

export const leerConfiguracionAuth = (env: Entorno): ConfiguracionAuth => {
  const emisor = direccion('OIDC_ISSUER_URL', texto(env, 'OIDC_ISSUER_URL', EMISOR_POR_DEFECTO)).toString().replace(/\/+$/, '');
  const jwks = env.OIDC_JWKS_URL === undefined ? `${emisor}/protocol/openid-connect/certs` : direccion('OIDC_JWKS_URL', env.OIDC_JWKS_URL).toString();
  return {
    emisor,
    audiencia: texto(env, 'OIDC_AUDIENCE', 'sigiso-api'),
    clienteAutorizado: texto(env, 'OIDC_CLIENT_ID', 'sigiso-web'),
    jwksUrl: jwks,
  };
};

/**
 * Orígenes que pueden llamar a la API desde un navegador (`CORS_ORIGINS`, separados por comas). Por omisión NINGUNO: la web
 * llama desde su servidor (patrón BFF, ADR 027). Solo se admiten orígenes exactos: nada de `*`, `null` ni rutas.
 */
export const leerOrigenesCors = (env: Entorno): string[] => {
  const crudo = env.CORS_ORIGINS?.trim();
  if (!crudo) return [];
  const origenes = new Set<string>();
  for (const parte of crudo.split(',')) {
    const valor = parte.trim();
    let url: URL;
    try {
      url = new URL(valor);
    } catch {
      throw new ConfiguracionInvalidaError('CORS_ORIGINS', 'cada origen debe ser una URL como http://localhost:3000');
    }
    const exacto = (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === valor && !url.username && !url.password;
    if (!exacto) throw new ConfiguracionInvalidaError('CORS_ORIGINS', 'cada origen debe ser exacto (esquema, host y puerto; sin ruta, credenciales, * ni null)');
    origenes.add(valor);
  }
  return [...origenes];
};

export interface ConfiguracionLimites {
  /** Solicitudes por minuto de cada persona. */
  readonly persona: number;
  /** Solicitudes por minuto de cada empresa, sumadas todas sus personas. */
  readonly empresa: number;
}

const entero = (env: Entorno, variable: string, porDefecto: number): number => {
  const crudo = env[variable];
  if (crudo === undefined) return porDefecto;
  if (!/^[0-9]{1,6}$/.test(crudo) || Number(crudo) < 1 || Number(crudo) > 100_000) {
    throw new ConfiguracionInvalidaError(variable, 'debe ser un entero entre 1 y 100000');
  }
  return Number(crudo);
};

/** Límite de frecuencia (`RATE_LIMIT_PERSONA` y `RATE_LIMIT_EMPRESA`, por minuto). La empresa nunca puede tener menos que una persona. */
export const leerConfiguracionLimites = (env: Entorno): ConfiguracionLimites => {
  const persona = entero(env, 'RATE_LIMIT_PERSONA', 120);
  const empresa = entero(env, 'RATE_LIMIT_EMPRESA', 600);
  if (empresa < persona) throw new ConfiguracionInvalidaError('RATE_LIMIT_EMPRESA', 'no puede ser menor que RATE_LIMIT_PERSONA');
  return { persona, empresa };
};
