// GET a la API con el token de la sesión. El token solo viaja del servidor de la web a la API; nunca al navegador.
export type RespuestaApi =
  | { readonly ok: true; readonly json: unknown }
  | { readonly ok: false; readonly motivo: 'no_autenticado' | 'sin_permiso' | 'no_disponible' };

// Solo rutas propias de la API: empieza con una sola barra, sin barras invertidas, espacios, puntos de ruta ni fragmento.
const RUTA = /^\/(?!\/)[A-Za-z0-9._~!$&'()*+,;=:@%/?-]*$/;

export const consultarApi = async (p: {
  ruta: string;
  acceso: string;
  apiUrl: string;
  fetchFn: typeof fetch;
}): Promise<RespuestaApi> => {
  if (
    !RUTA.test(p.ruta) ||
    p.ruta
      .split('?')[0]!
      .split('/')
      .some((s) => s === '..' || s === '.')
  )
    return { ok: false, motivo: 'no_disponible' };
  try {
    const r = await p.fetchFn(`${p.apiUrl}${p.ruta}`, {
      headers: { authorization: `Bearer ${p.acceso}`, accept: 'application/json' },
      signal: AbortSignal.timeout(5_000),
      redirect: 'error',
      cache: 'no-store',
    });
    if (r.status === 401) return { ok: false, motivo: 'no_autenticado' };
    if (r.status === 403) return { ok: false, motivo: 'sin_permiso' };
    if (r.status !== 200) return { ok: false, motivo: 'no_disponible' };
    return { ok: true, json: await r.json() };
  } catch {
    return { ok: false, motivo: 'no_disponible' };
  }
};
