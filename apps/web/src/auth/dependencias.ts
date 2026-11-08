// Dependencias reales del flujo: configuración del entorno, reloj, fetch, claves públicas del emisor (JWKS en caché) y la memoria
// de access tokens del servidor.
import { createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';
import { almacenCompartido } from './almacen-acceso';
import { leerConfiguracion, type EntornoWeb } from './configuracion';
import type { DependenciasWeb } from './manejadores';

const jwksPorEmisor = new Map<string, JWTVerifyGetKey>();
const clavesDe = (emisor: string): JWTVerifyGetKey => {
  let claves = jwksPorEmisor.get(emisor);
  if (!claves) {
    claves = createRemoteJWKSet(new URL(`${emisor}/protocol/openid-connect/certs`), {
      cooldownDuration: 30_000,
      cacheMaxAge: 600_000,
      timeoutDuration: 5_000,
    });
    jwksPorEmisor.set(emisor, claves);
  }
  return claves;
};

export const crearDependencias = (env: EntornoWeb): DependenciasWeb => {
  const config = leerConfiguracion(env);
  return {
    config,
    ahora: () => new Date(),
    fetchFn: fetch,
    claves: clavesDe(config.emisor),
    almacen: almacenCompartido(),
  };
};

export const registrarEnServidor = (mensaje: string): void => {
  console.error(mensaje);
};
