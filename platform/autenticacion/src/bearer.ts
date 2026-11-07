/** Tamaño máximo aceptado de un token en la cabecera (un access token de Keycloak ronda 1–2 KB). */
export const TOKEN_MAX = 8192;

const BEARER = /^bearer ([A-Za-z0-9_.-]+)$/i;

/**
 * Extrae el token de la cabecera `Authorization: Bearer <token>`. Devuelve `null` si no hay exactamente un token bien formado
 * (esquema distinto, espacios de más, saltos de línea, caracteres ajenos a un JWT, cabecera repetida o demasiado grande).
 */
export const extraerBearer = (cabecera: unknown): string | null => {
  if (typeof cabecera !== 'string' || cabecera.length > TOKEN_MAX + 7) return null;
  const m = BEARER.exec(cabecera);
  const token = m?.[1];
  return token && token.length <= TOKEN_MAX ? token : null;
};
