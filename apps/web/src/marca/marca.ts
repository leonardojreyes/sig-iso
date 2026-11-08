// Marca real de la empresa de la sesión (GET /empresa/marca). La respuesta de la API se valida igual que cualquier dato externo:
// forma exacta, color #RRGGBB y logo solo https sin credenciales o ruta propia. Lo inválido no se corrige: se rechaza.
import { esIdEmpresa, type Empresa } from './tipos';

const COLOR = /^#[0-9A-Fa-f]{6}$/;
const LOGO = /^(https:\/\/[A-Za-z0-9.-]+(:[0-9]+)?\/[^\s@]*|\/[^/\\\s][^\s@]*)$/;
const CLAVES = ['ajustadoPorContraste', 'colorOriginal', 'colorPrimario', 'logoUrl', 'nombre'];

export interface MarcaValidada {
  readonly nombre: string;
  readonly primario: string;
  readonly logoUrl: string | undefined;
}

export const validarMarca = (cuerpo: unknown): MarcaValidada | null => {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) return null;
  const m = cuerpo as Record<string, unknown>;
  if (Object.keys(m).sort().join(',') !== CLAVES.join(',')) return null;
  if (typeof m.nombre !== 'string' || m.nombre.length < 1 || m.nombre.length > 120) return null;
  if (typeof m.colorPrimario !== 'string' || !COLOR.test(m.colorPrimario)) return null;
  if (typeof m.colorOriginal !== 'string' || !COLOR.test(m.colorOriginal)) return null;
  if (typeof m.ajustadoPorContraste !== 'boolean') return null;
  let logoUrl: string | undefined;
  if (m.logoUrl !== null) {
    if (typeof m.logoUrl !== 'string' || m.logoUrl.length > 2048 || !LOGO.test(m.logoUrl)) return null;
    logoUrl = m.logoUrl;
  }
  return { nombre: m.nombre, primario: m.colorPrimario, logoUrl };
};

export type ResultadoMarca =
  | { readonly ok: true; readonly empresa: Empresa }
  | { readonly ok: false; readonly motivo: 'no_autenticado' | 'no_disponible' };

export const cargarMarca = async (p: {
  slug: string;
  acceso: string;
  apiUrl: string;
  fetchFn: typeof fetch;
}): Promise<ResultadoMarca> => {
  // El slug ya viene verificado, pero se vuelve a comprobar: va a ser el identificador del CSS.
  if (!esIdEmpresa(p.slug)) return { ok: false, motivo: 'no_disponible' };
  try {
    const r = await p.fetchFn(`${p.apiUrl}/empresa/marca`, {
      headers: { authorization: `Bearer ${p.acceso}`, accept: 'application/json' },
      signal: AbortSignal.timeout(5_000),
      redirect: 'error',
      cache: 'no-store',
    });
    if (r.status === 401) return { ok: false, motivo: 'no_autenticado' };
    if (r.status !== 200) return { ok: false, motivo: 'no_disponible' };
    const marca = validarMarca(await r.json());
    if (!marca) return { ok: false, motivo: 'no_disponible' };
    return { ok: true, empresa: { id: p.slug, ...marca } };
  } catch {
    return { ok: false, motivo: 'no_disponible' };
  }
};
