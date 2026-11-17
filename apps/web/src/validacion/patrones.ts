// Patrones de forma compartidos por la web. Una sola definición: si cambia una regla, cambia en todas las pantallas y manejadores.

/** Identificador de empresa en la dirección: minúsculas, dígitos y guion, hasta 32. */
export const SLUG = /^[a-z0-9-]{1,32}$/;

/** UUID en cualquier combinación de mayúsculas y minúsculas (quien lo use y lo compare lo pasa a minúsculas). */
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Color de marca: `#rrggbb`. */
export const COLOR = /^#[0-9A-Fa-f]{6}$/;

/** Logo: una dirección `https` o un archivo de imagen bajo `/logos/` (regla del hito H3, ver ADR 035 y migración 0014). */
export const LOGO = /^(https:\/\/[A-Za-z0-9.-]+(:[0-9]+)?\/[^\s@]*|\/logos\/[A-Za-z0-9._-]{1,100}\.(png|svg|jpe?g|webp))$/;
