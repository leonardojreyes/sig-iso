// Control de seguridad común a los manejadores de escritura de la web (`certificacion/escribir.ts`, `librerias/subir.ts`,
// `marca/editar.ts`, `cambio-empresa/cambiar.ts`). La web NO decide nada de negocio: aquí solo se protege el formulario. Una sola
// definición para que un arreglo de seguridad llegue a todos a la vez. El orden es siempre: método → `Origin` → empresa verificada.
import { origenValido } from './sesion';

export const SIN_CACHE = { 'Cache-Control': 'no-store' } as const;

/** Entrada que todo manejador de una pantalla de empresa recibe del proxy. */
export interface EntradaDeEmpresa {
  readonly slugDeLaDireccion: string;
  readonly slugVerificado: string | null;
}

/** 405 si el método no es el esperado; `null` si todo va bien. */
export const rechazoDeMetodo = (peticion: Request, metodo: 'GET' | 'POST'): Response | null =>
  peticion.method === metodo
    ? null
    : new Response('Método no permitido', {
        status: 405,
        headers: { Allow: metodo, ...SIN_CACHE },
      });

/** 404 (idéntico al de una empresa que no existe) si la empresa de la dirección no es la verificada; si no, `null`. */
export const rechazoDeEmpresa = (entrada: EntradaDeEmpresa): Response | null =>
  entrada.slugVerificado && entrada.slugVerificado === entrada.slugDeLaDireccion
    ? null
    : new Response(null, { status: 404, headers: SIN_CACHE });

/**
 * Guardia de un formulario que ESCRIBE: método POST, `Origin` propio exacto y, si la pantalla es de una empresa (`entrada`),
 * empresa de la dirección = empresa verificada. Devuelve la respuesta de rechazo o `null` si puede seguir.
 */
export const rechazoDeEscritura = (peticion: Request, origenPropio: string, entrada?: EntradaDeEmpresa): Response | null => {
  const metodo = rechazoDeMetodo(peticion, 'POST');
  if (metodo) return metodo;
  if (!origenValido(peticion, origenPropio))
    return new Response('Origen no permitido', {
      status: 403,
      headers: SIN_CACHE,
    });
  return entrada ? rechazoDeEmpresa(entrada) : null;
};

/** Redirección 303 sin caché, con las cookies de sesión que haya que fijar. */
export const redirigir = (ubicacion: string, cookies: readonly string[] = []): Response => {
  const cabeceras = new Headers({ Location: ubicacion, ...SIN_CACHE });
  for (const c of cookies) cabeceras.append('Set-Cookie', c);
  return new Response(null, { status: 303, headers: cabeceras });
};
