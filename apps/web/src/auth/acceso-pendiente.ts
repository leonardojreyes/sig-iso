// Lee el código de solicitud de acceso que dejó el ingreso de una cuenta SIN rol (ADR 036). La cookie va sellada y dura poco; no es una
// sesión: solo permite mostrarle a esa persona el código que debe entregarle al administrador SIG. Ante cualquier duda, `null`.
import type { ConfiguracionIngreso } from './configuracion';
import { leerCookie } from './flujo';
import { abrirSello } from './sellado';

const CODIGO = /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/;

export interface CodigoDeAcceso {
  readonly codigo: string;
  readonly venceEn: Date;
}

export const leerCodigoDeAcceso = async (cookie: string | null, config: ConfiguracionIngreso, ahora: Date): Promise<CodigoDeAcceso | null> => {
  if (!cookie) return null;
  const valor = leerCookie(new Request('http://interno.invalid/', { headers: { cookie } }), config.nombreCookieAcceso);
  if (valor === null || valor === 'repetida' || valor === '') return null;
  try {
    const c = await abrirSello<{ v?: unknown; t?: unknown; c?: unknown; e?: unknown }>(valor, { claves: config.clavesSellado, ahora });
    // La etiqueta `t` separa esta cookie de la de sesión (misma clave de sellado): cada lector solo acepta la suya.
    if (c.v !== 1 || c.t !== 'acceso' || typeof c.c !== 'string' || !CODIGO.test(c.c) || typeof c.e !== 'string') return null;
    const venceEn = new Date(c.e);
    if (!Number.isFinite(venceEn.getTime()) || venceEn.getTime() <= ahora.getTime()) return null;
    return { codigo: c.c, venceEn };
  } catch {
    return null;
  }
};
