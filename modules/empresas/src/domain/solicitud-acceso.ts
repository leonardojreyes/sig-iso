// Solicitud de acceso (ADR 036, MVP M7): una persona autenticada que aún no tiene rol en la empresa pide acceso y recibe un CÓDIGO CORTO
// para entregárselo al administrador SIG. Aquí vive solo lo puro: el alfabeto, la forma del código y los plazos. La aleatoriedad llega
// de fuera (la aplicación pasa `crypto.getRandomValues`), así el dominio no depende de nada.

/** 31 caracteres sin ambiguos: sin 0, O, 1, I ni L (se confunden al dictarlos o copiarlos). */
export const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** `XXXX-XXXX` del alfabeto anterior. Es la misma regla que la restricción de la tabla `solicitud_acceso` (migración 0015). */
export const FORMA_CODIGO = /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/;

/** Una solicitud vence a los 7 días. */
export const VIDA_SOLICITUD_MS = 7 * 24 * 3600 * 1000;

/** Tope de solicitudes vigentes por empresa: acota el abuso de quien ya tiene una cuenta de Keycloak pero no un rol. */
export const TOPE_SOLICITUDES_VIGENTES = 50;

/** Fuente de bytes aleatorios (por ejemplo, `(n) => crypto.getRandomValues(new Uint8Array(n))`). */
export type Aleatorio = (n: number) => Uint8Array;

// 31 * 8 = 248: solo se aceptan bytes menores que 248. Así `byte % 31` reparte igual entre los 31 caracteres (sin sesgo por módulo).
const LIMITE_SIN_SESGO = 248;

/** Genera un código `XXXX-XXXX` con descarte de bytes sesgados (muestreo por rechazo). */
export const generarCodigo = (aleatorio: Aleatorio): string => {
  let caracteres = '';
  while (caracteres.length < 8) {
    for (const byte of aleatorio(16)) {
      if (byte >= LIMITE_SIN_SESGO) continue;
      caracteres += ALFABETO_CODIGO[byte % ALFABETO_CODIGO.length];
      if (caracteres.length === 8) break;
    }
  }
  return `${caracteres.slice(0, 4)}-${caracteres.slice(4)}`;
};
