// Escrituras de alcance y diagnóstico desde la web. La web NO decide nada: reenvía a la API (que autoriza, valida y registra en la
// bitácora) con el token de la sesión; la empresa y la persona salen del token, nunca del formulario. Aquí solo se protege el
// formulario: método POST, `Origin` propio exacto, empresa de la dirección = empresa verificada, y se arma un cuerpo con una lista
// cerrada de campos. El resultado vuelve a la pantalla como un aviso de una lista cerrada (nunca texto de la API ni del usuario).
import type { DependenciasSesion } from '../auth/sesion';
import { crearServicioSesion, origenValido } from '../auth/sesion';

const SIN_CACHE = { 'Cache-Control': 'no-store' };

export type AvisoEscritura = 'guardado' | 'aprobado' | 'evaluado' | 'sin_cambios' | 'sin_permiso' | 'no_valido' | 'no_encontrado' | 'conflicto' | 'no_disponible';
const AVISOS: readonly string[] = ['guardado', 'aprobado', 'evaluado', 'sin_cambios', 'sin_permiso', 'no_valido', 'no_encontrado', 'conflicto', 'no_disponible'];

/** Aviso que viaja en la dirección (`?aviso=`); lo desconocido se ignora. */
export const leerAvisoEscritura = (sp: Readonly<Record<string, string | readonly string[] | undefined>>): AvisoEscritura | null =>
  typeof sp.aviso === 'string' && AVISOS.includes(sp.aviso) ? (sp.aviso as AvisoEscritura) : null;

interface Entrada {
  readonly slugDeLaDireccion: string;
  readonly slugVerificado: string | null;
  readonly deps: DependenciasSesion;
}
interface Operacion {
  /** Pantalla a la que se vuelve (`/e/<empresa>/<pantalla>`). */
  readonly pantalla: 'alcance' | 'diagnostico';
  readonly metodoApi: 'PUT' | 'POST';
  readonly rutaApi: string;
  /** Cuerpo ya armado con campos conocidos, o `null` si el formulario no trae lo mínimo. */
  readonly cuerpo: (f: FormData) => Record<string, unknown> | null;
  /** Estado 200 → aviso (puede depender de la respuesta). */
  readonly exito: AvisoEscritura;
  /** Se conserva en la dirección al volver (filtros de la pantalla), ya validado. */
  readonly conservar?: (f: FormData) => string;
}

const campo = (f: FormData, nombre: string): string | null => {
  const v = f.get(nombre);
  return typeof v === 'string' ? v : null;
};
const opcional = (f: FormData, nombre: string): string | null => {
  const v = campo(f, nombre)?.trim();
  return v ? v : null;
};

const reenviar = async (peticion: Request, entrada: Entrada, op: Operacion): Promise<Response> => {
  const { config } = entrada.deps;
  if (peticion.method !== 'POST') return new Response('Método no permitido', { status: 405, headers: { Allow: 'POST', ...SIN_CACHE } });
  if (!origenValido(peticion, config.origen)) return new Response('Origen no permitido', { status: 403, headers: SIN_CACHE });
  if (!entrada.slugVerificado || entrada.slugVerificado !== entrada.slugDeLaDireccion) return new Response(null, { status: 404, headers: SIN_CACHE });
  const slug = entrada.slugVerificado;

  const redirigir = (ubicacion: string, cookies: readonly string[]): Response => {
    const cabeceras = new Headers({ Location: ubicacion, ...SIN_CACHE });
    for (const c of cookies) cabeceras.append('Set-Cookie', c);
    return new Response(null, { status: 303, headers: cabeceras });
  };
  const aIngresar = (cookies: readonly string[]): Response =>
    redirigir(`${config.origen}/auth/login?retorno=${encodeURIComponent(`/e/${slug}/${op.pantalla}`)}`, cookies);

  let formulario: FormData;
  try {
    formulario = await peticion.formData();
  } catch {
    return redirigir(`${config.origen}/e/${slug}/${op.pantalla}?aviso=no_valido`, []);
  }
  const volver = (aviso: AvisoEscritura, cookies: readonly string[]): Response => {
    const conservado = new URLSearchParams(op.conservar?.(formulario) ?? '');
    conservado.set('aviso', aviso);
    return redirigir(`${config.origen}/e/${slug}/${op.pantalla}?${conservado}`, cookies);
  };

  const cuerpo = op.cuerpo(formulario);
  const servicio = crearServicioSesion(entrada.deps);
  const sesion = await servicio.leer(peticion);
  if (!sesion) return aIngresar([]);
  if (!cuerpo) return volver('no_valido', []);
  const acceso = await servicio.obtenerAcceso(sesion);
  if (!acceso.ok) return acceso.motivo === 'expirada' ? aIngresar([acceso.limpiarCookie ?? servicio.borrarCookie()]) : volver('no_disponible', []);
  const cookies = acceso.nuevaCookie ? [acceso.nuevaCookie] : [];

  let estado: number | null;
  try {
    const r = await entrada.deps.fetchFn(`${config.apiUrl}${op.rutaApi}`, {
      method: op.metodoApi,
      headers: { authorization: `Bearer ${acceso.acceso}`, accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
      cache: 'no-store',
    });
    estado = r.status;
  } catch {
    estado = null;
  }
  if (estado === 401) {
    entrada.deps.almacen.borrar(sesion.sid);
    return aIngresar([servicio.borrarCookie()]);
  }
  if (estado === 200) return volver(op.exito, cookies);
  if (estado === 400) return volver('no_valido', cookies);
  if (estado === 403) return volver('sin_permiso', cookies);
  if (estado === 404) return volver('no_encontrado', cookies);
  if (estado === 409) return volver('conflicto', cookies);
  return volver('no_disponible', cookies);
};

const NORMA = /^[A-Za-z0-9 :./-]{1,60}$/;

export const guardarAlcance = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'alcance',
    metodoApi: 'PUT',
    rutaApi: '/alcances',
    exito: 'guardado',
    cuerpo: (f) => {
      const norma = campo(f, 'norma');
      const texto = campo(f, 'texto')?.trim();
      return norma && NORMA.test(norma) && texto ? { norma, texto } : null;
    },
  });

export const aprobarAlcance = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'alcance',
    metodoApi: 'POST',
    rutaApi: '/alcances/aprobacion',
    exito: 'aprobado',
    cuerpo: (f) => {
      const norma = campo(f, 'norma');
      return norma && NORMA.test(norma) ? { norma } : null;
    },
  });

const ESTADOS = ['cumple', 'parcial', 'no_cumple', 'no_aplica'];
const CODIGO = /^[a-z0-9-]{1,64}$/;
const ID = /^[a-z0-9][a-z0-9.-]{0,40}$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const evaluarEntrada = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'diagnostico',
    metodoApi: 'PUT',
    rutaApi: '/diagnostico/evaluaciones',
    exito: 'evaluado',
    // Se vuelve al diagnóstico con los mismos filtros (el formulario los trae como campos ocultos `f_*`).
    conservar: (f) => {
      const p = new URLSearchParams();
      for (const k of ['q', 'norma', 'tipo', 'estado'] as const) {
        const v = campo(f, `f_${k}`);
        if (v && v.length <= 80) p.set(k, v);
      }
      return p.toString();
    },
    cuerpo: (f) => {
      const libreriaCodigo = campo(f, 'libreriaCodigo');
      const idEstable = campo(f, 'idEstable');
      const estado = campo(f, 'estado');
      if (!libreriaCodigo || !CODIGO.test(libreriaCodigo) || !idEstable || !ID.test(idEstable) || !estado || !ESTADOS.includes(estado)) return null;
      const version = campo(f, 'version');
      if (version !== null && !/^\d{1,9}$/.test(version)) return null;
      const fecha = opcional(f, 'fechaObjetivo');
      if (fecha !== null && !FECHA.test(fecha)) return null;
      const responsable = opcional(f, 'responsableId');
      if (responsable !== null && !UUID.test(responsable)) return null;
      return {
        libreriaCodigo,
        idEstable,
        estado,
        comentario: opcional(f, 'comentario'),
        fechaObjetivo: fecha,
        ...(responsable ? { responsableId: responsable } : {}),
        versionEsperada: version === null ? 0 : Number(version),
      };
    },
  });
