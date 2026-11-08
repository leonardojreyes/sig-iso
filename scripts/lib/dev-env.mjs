// Variables de entorno de cada servicio en desarrollo (`pnpm dev`): se leen del .env.local de la raíz y cada servicio recibe
// SOLO las que necesita (mínimo privilegio): la web no ve las bases de datos; la API no ve el secreto del cliente web ni la
// clave de sellado de la sesión. Lo que ya esté en el entorno de la terminal manda sobre el archivo.
import { parsearEnv } from './db-init.mjs';

export const SERVICIOS = Object.freeze({
  web: Object.freeze([
    'OIDC_ISSUER_URL',
    'OIDC_CLIENT_ID',
    'OIDC_CLIENT_SECRET',
    'OIDC_REDIRECT_URI',
    'SESSION_SEALING_KEY',
    'SESSION_SEALING_KEY_PREVIOUS',
  ]),
  api: Object.freeze([
    'DATABASE_URL_APP',
    'DATABASE_URL_PLATAFORMA',
    'OIDC_ISSUER_URL',
    'OIDC_AUDIENCE',
    'OIDC_JWKS_URL',
    'OIDC_CLIENT_ID',
    'CORS_ORIGINS',
    'RATE_LIMIT_PERSONA',
    'RATE_LIMIT_EMPRESA',
    'OTEL_TRACES_EXPORTER',
    'FEATURE_ADOPCION_HABILITADA',
    'API_PORT',
  ]),
});

export const entornoDeServicio = (servicio, textoEnv, base) => {
  const permitidas = SERVICIOS[servicio];
  if (!permitidas) throw new Error(`Servicio desconocido: ${String(servicio)}`);
  const deArchivo = parsearEnv(textoEnv);
  const resultado = { ...base };
  for (const nombre of permitidas) {
    if (resultado[nombre] === undefined && deArchivo.has(nombre)) resultado[nombre] = deArchivo.get(nombre);
  }
  return resultado;
};
