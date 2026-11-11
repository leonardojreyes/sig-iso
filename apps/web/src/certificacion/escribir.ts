// Escrituras de alcance y diagnóstico desde la web. La web NO decide nada: reenvía a la API (que autoriza, valida y registra en la
// bitácora) con el token de la sesión; la empresa y la persona salen del token, nunca del formulario. Aquí solo se protege el
// formulario: método POST, `Origin` propio exacto, empresa de la dirección = empresa verificada, y se arma un cuerpo con una lista
// cerrada de campos. El resultado vuelve a la pantalla como un aviso de una lista cerrada (nunca texto de la API ni del usuario).
import type { DependenciasSesion } from '../auth/sesion';
import { crearServicioSesion, origenValido } from '../auth/sesion';

const SIN_CACHE = { 'Cache-Control': 'no-store' };

export type AvisoEscritura = 'guardado' | 'aprobado' | 'evaluado' | 'creado' | 'retirado' | 'mapeado' | 'desmapeado' | 'sin_cambios' | 'sin_permiso' | 'no_valido' | 'no_encontrado' | 'conflicto' | 'no_disponible';
const AVISOS: readonly string[] = ['guardado', 'aprobado', 'evaluado', 'creado', 'retirado', 'mapeado', 'desmapeado', 'sin_cambios', 'sin_permiso', 'no_valido', 'no_encontrado', 'conflicto', 'no_disponible'];

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
  readonly pantalla: 'alcance' | 'diagnostico' | 'controles';
  readonly metodoApi: 'PUT' | 'POST';
  /** Ruta de la API; puede depender del formulario (el id del recurso, ya validado). `null` si el formulario no trae lo mínimo. */
  readonly rutaApi: string | ((f: FormData) => string | null);
  /** Cuerpo ya armado con campos conocidos, o `null` si el formulario no trae lo mínimo. */
  readonly cuerpo: (f: FormData) => Record<string, unknown> | null;
  /** Aviso cuando la API responde 200, 201 o 204 (puede depender de cuál). */
  readonly exito: AvisoEscritura | ((estado: number) => AvisoEscritura);
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
  const rutaApi = typeof op.rutaApi === 'string' ? op.rutaApi : op.rutaApi(formulario);
  const servicio = crearServicioSesion(entrada.deps);
  const sesion = await servicio.leer(peticion);
  if (!sesion) return aIngresar([]);
  if (!cuerpo || !rutaApi) return volver('no_valido', []);
  const acceso = await servicio.obtenerAcceso(sesion);
  if (!acceso.ok) return acceso.motivo === 'expirada' ? aIngresar([acceso.limpiarCookie ?? servicio.borrarCookie()]) : volver('no_disponible', []);
  const cookies = acceso.nuevaCookie ? [acceso.nuevaCookie] : [];

  let estado: number | null;
  try {
    const r = await entrada.deps.fetchFn(`${config.apiUrl}${rutaApi}`, {
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
  if (estado === 200 || estado === 201 || estado === 204) return volver(typeof op.exito === 'function' ? op.exito(estado) : op.exito, cookies);
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

// ---- Controles de la empresa y mapeos (M3)

const UUID_FORM = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODIGO_CONTROL = /^[A-Za-z0-9][A-Za-z0-9._-]{0,19}$/;
const NORMA_FILTRO = /^[A-Za-z0-9 :./-]{1,60}$/;

/** Filtros del marco que se conservan al volver (`f_norma`, `f_retirados`), ya validados. */
const conservarControles = (f: FormData): string => {
  const p = new URLSearchParams();
  const norma = campo(f, 'f_norma');
  if (norma && NORMA_FILTRO.test(norma)) p.set('norma', norma);
  if (campo(f, 'f_retirados') === 'true') p.set('retirados', 'true');
  return p.toString();
};
const idControl = (f: FormData): string | null => {
  const id = campo(f, 'id');
  return id && UUID_FORM.test(id) ? id.toLowerCase() : null;
};
const versionControl = (f: FormData): number | null => {
  const v = campo(f, 'version');
  return v !== null && /^\d{1,9}$/.test(v) && Number(v) >= 1 ? Number(v) : null;
};

export const crearControl = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'controles',
    metodoApi: 'POST',
    rutaApi: '/controles',
    exito: 'creado',
    conservar: conservarControles,
    cuerpo: (f) => {
      const codigo = campo(f, 'codigo')?.trim();
      const nombre = campo(f, 'nombre')?.trim();
      if (!codigo || !CODIGO_CONTROL.test(codigo) || !nombre) return null;
      return { codigo, nombre, descripcion: opcional(f, 'descripcion') };
    },
  });

export const cambiarControl = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'controles',
    metodoApi: 'PUT',
    rutaApi: (f) => {
      const id = idControl(f);
      return id ? `/controles/${id}` : null;
    },
    exito: 'guardado',
    conservar: conservarControles,
    cuerpo: (f) => {
      const version = versionControl(f);
      const nombre = campo(f, 'nombre')?.trim();
      if (version === null || !nombre) return null;
      return { versionEsperada: version, nombre, descripcion: opcional(f, 'descripcion') };
    },
  });

export const retirarControl = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'controles',
    metodoApi: 'POST',
    rutaApi: (f) => {
      const id = idControl(f);
      return id ? `/controles/${id}/retiro` : null;
    },
    exito: 'retirado',
    conservar: conservarControles,
    cuerpo: (f) => {
      const version = versionControl(f);
      return version === null ? null : { versionEsperada: version };
    },
  });

/** El mapeo llega como `entrada` = «<código de librería>|<id estable>» (una sola opción del desplegable). */
const entradaDeMapeo = (f: FormData): { libreriaCodigo: string; idEstable: string } | null => {
  const [libreriaCodigo, idEstable, ...resto] = (campo(f, 'entrada') ?? '').split('|');
  return resto.length === 0 && libreriaCodigo && idEstable && CODIGO.test(libreriaCodigo) && ID.test(idEstable) ? { libreriaCodigo, idEstable } : null;
};

export const mapearControl = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'controles',
    metodoApi: 'POST',
    rutaApi: (f) => {
      const id = idControl(f);
      return id ? `/controles/${id}/mapeos` : null;
    },
    // 201 = se creó; 200 = ya existía (no es un error).
    exito: (estado) => (estado === 201 ? 'mapeado' : 'sin_cambios'),
    conservar: conservarControles,
    cuerpo: entradaDeMapeo,
  });

export const desmapearControl = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'controles',
    metodoApi: 'POST',
    rutaApi: (f) => {
      const id = idControl(f);
      return id ? `/controles/${id}/mapeos/eliminacion` : null;
    },
    exito: 'desmapeado',
    conservar: conservarControles,
    cuerpo: entradaDeMapeo,
  });
