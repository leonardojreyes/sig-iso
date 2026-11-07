import { createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';

/**
 * Claves públicas del emisor por HTTP. `jose` las guarda en caché y, ante un `kid` desconocido, vuelve a pedirlas con un
 * tiempo de espera entre intentos (no se puede forzar una ráfaga de peticiones al emisor con tokens falsos).
 */
export const crearJwksRemoto = (url: string): JWTVerifyGetKey => {
  const direccion = new URL(url);
  if (direccion.protocol !== 'https:' && direccion.protocol !== 'http:') throw new Error('La dirección del JWKS debe ser http o https');
  if (direccion.username || direccion.password) throw new Error('La dirección del JWKS no debe llevar credenciales');
  return createRemoteJWKSet(direccion, { cooldownDuration: 30_000, cacheMaxAge: 600_000, timeoutDuration: 5_000 });
};
