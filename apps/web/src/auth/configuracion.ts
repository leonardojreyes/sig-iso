// Configuración del ingreso (OIDC) de la web. Se lee del entorno en cada solicitud (no al importar el módulo): una variable que
// falta falla esa solicitud con un error claro, nunca deja pasar un ingreso a medias. Los mensajes nombran la variable, jamás su valor.
import { createHash } from 'node:crypto';
import { seCreaClave, type ClaveSellado } from './sellado';

export interface ConfiguracionIngreso {
  readonly emisor: string;
  readonly clienteId: string;
  readonly clienteSecreto: string;
  readonly redirectUri: string;
  readonly origen: string;
  /** Con HTTPS la cookie es Secure y lleva el prefijo __Host-. En desarrollo local (http) no puede serlo en todos los navegadores. */
  readonly seguro: boolean;
  readonly nombreCookie: string;
  readonly nombreCookieSesion: string;
  /** Dirección de la API (servidor a servidor). */
  readonly apiUrl: string;
  readonly clavesSellado: readonly ClaveSellado[];
}

export type EntornoWeb = Readonly<Record<string, string | undefined>>;

const direccion = (variable: string, valor: string, { permiteRuta }: { permiteRuta: boolean }): URL => {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    throw new Error(`${variable} no es una dirección válida`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error(`${variable} debe ser http o https`);
  if (url.username || url.password) throw new Error(`${variable} no debe llevar credenciales`);
  if (url.search || url.hash) throw new Error(`${variable} no debe llevar consulta ni fragmento`);
  if (!permiteRuta && url.pathname !== '/') throw new Error(`${variable} no debe llevar ruta`);
  return url;
};

const idDeClave = (secreto: string): string => createHash('sha256').update(secreto).digest('base64url').slice(0, 8);

export const leerConfiguracion = (env: EntornoWeb): ConfiguracionIngreso => {
  const emisor = direccion('OIDC_ISSUER_URL', env.OIDC_ISSUER_URL ?? 'http://127.0.0.1:8080/realms/sigiso', {
    permiteRuta: true,
  });
  const redirect = direccion('OIDC_REDIRECT_URI', env.OIDC_REDIRECT_URI ?? 'http://localhost:3000/auth/callback', {
    permiteRuta: true,
  });

  const api = direccion('API_URL', env.API_URL ?? 'http://127.0.0.1:3001', { permiteRuta: false });

  const clienteSecreto = env.OIDC_CLIENT_SECRET;
  if (!clienteSecreto) throw new Error('Falta OIDC_CLIENT_SECRET (pnpm keycloak:realm lo genera)');

  const activa = env.SESSION_SEALING_KEY;
  if (!activa || !seCreaClave(activa)) throw new Error('SESSION_SEALING_KEY falta o no es de 32 bytes en base64url');
  const claves: ClaveSellado[] = [{ id: idDeClave(activa), secreto: activa }];
  const anterior = env.SESSION_SEALING_KEY_PREVIOUS;
  if (anterior !== undefined && anterior !== '') {
    if (!seCreaClave(anterior)) throw new Error('SESSION_SEALING_KEY_PREVIOUS no es de 32 bytes en base64url');
    if (anterior !== activa) claves.push({ id: idDeClave(anterior), secreto: anterior });
  }

  const seguro = redirect.protocol === 'https:';
  return {
    emisor: emisor.toString().replace(/\/+$/, ''),
    clienteId: env.OIDC_CLIENT_ID || 'sigiso-web',
    clienteSecreto,
    redirectUri: redirect.toString(),
    origen: redirect.origin,
    seguro,
    nombreCookie: seguro ? '__Host-sig-oidc' : 'sig-oidc',
    nombreCookieSesion: seguro ? '__Host-sig-sesion' : 'sig-sesion',
    apiUrl: api.origin,
    clavesSellado: claves,
  };
};
