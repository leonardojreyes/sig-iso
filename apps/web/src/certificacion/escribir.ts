// Escrituras de alcance y diagnóstico desde la web. La web NO decide nada: reenvía a la API (que autoriza, valida y registra en la
// bitácora) con el token de la sesión; la empresa y la persona salen del token, nunca del formulario. Aquí solo se protege el
// formulario: método POST, `Origin` propio exacto, empresa de la dirección = empresa verificada, y se arma un cuerpo con una lista
// cerrada de campos. El resultado vuelve a la pantalla como un aviso de una lista cerrada (nunca texto de la API ni del usuario).
import type { DependenciasSesion } from '../auth/sesion';
import { crearServicioSesion, origenValido } from '../auth/sesion';

const SIN_CACHE = { 'Cache-Control': 'no-store' };

export type AvisoEscritura =
  | 'guardado'
  | 'aprobado'
  | 'evaluado'
  | 'creado'
  | 'retirado'
  | 'mapeado'
  | 'desmapeado'
  | 'evidencia_subida'
  | 'evidencia_reemplazada'
  | 'evidencia_eliminada'
  | 'declaracion_aprobada'
  | 'declaracion_no_aprobada'
  | 'sin_cambios'
  | 'sin_permiso'
  | 'no_valido'
  | 'archivo_grande'
  | 'tipo_no_permitido'
  | 'no_encontrado'
  | 'conflicto'
  | 'no_disponible';
const AVISOS: readonly string[] = [
  'guardado',
  'aprobado',
  'evaluado',
  'creado',
  'retirado',
  'mapeado',
  'desmapeado',
  'evidencia_subida',
  'evidencia_reemplazada',
  'evidencia_eliminada',
  'declaracion_aprobada',
  'declaracion_no_aprobada',
  'sin_cambios',
  'sin_permiso',
  'no_valido',
  'archivo_grande',
  'tipo_no_permitido',
  'no_encontrado',
  'conflicto',
  'no_disponible',
];

/** Aviso que viaja en la dirección (`?aviso=`); lo desconocido se ignora. */
export const leerAvisoEscritura = (sp: Readonly<Record<string, string | readonly string[] | undefined>>): AvisoEscritura | null =>
  typeof sp.aviso === 'string' && AVISOS.includes(sp.aviso) ? (sp.aviso as AvisoEscritura) : null;

interface Entrada {
  readonly slugDeLaDireccion: string;
  readonly slugVerificado: string | null;
  readonly deps: DependenciasSesion;
  /** El recurso de la dirección (por ejemplo, el control o la evidencia): se exige un UUID o responde 404, como una empresa distinta. */
  readonly id?: string;
}

const UUID_DIRECCION = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** 25 MB: lo que acepta la API por archivo. */
const ARCHIVO_MAX = 26_214_400;
/** Un cuerpo vacío a propósito (la operación de la API no lleva cuerpo). */
const SIN_CUERPO = Symbol('sin_cuerpo');
type Cuerpo = Record<string, unknown> | FormData | typeof SIN_CUERPO | 'archivo_grande' | null;
interface Operacion {
  /** Pantalla a la que se vuelve (`/e/<empresa>/<pantalla>`). */
  readonly pantalla: 'alcance' | 'diagnostico' | 'controles' | 'declaracion';
  /** Ruta (tras `/e/<empresa>/`) a la que se vuelve si no es `pantalla`; recibe el formulario (si se pudo leer) y el recurso de la dirección. */
  readonly volverA?: (f: FormData | null, id: string | null) => string;
  readonly metodoApi: 'PUT' | 'POST';
  /** Ruta de la API; puede depender del formulario (el id del recurso, ya validado). `null` si el formulario no trae lo mínimo. */
  readonly rutaApi: string | ((f: FormData, id: string | null) => string | null);
  /**
   * Cuerpo ya armado con campos conocidos (JSON o `FormData` para un archivo), `SIN_CUERPO`, `'archivo_grande'` o `null` si el
   * formulario no trae lo mínimo.
   */
  readonly cuerpo: (f: FormData, id: string | null) => Cuerpo;
  /** Exige que la dirección traiga un UUID (`entrada.id`). */
  readonly conId?: boolean;
  /** Si la petición declara más bytes que esto, se responde «archivo grande» SIN leer el cuerpo. */
  readonly limiteCuerpo?: number;
  /** Tiempo máximo de la llamada a la API; las subidas necesitan más. */
  readonly tiempoMs?: number;
  /** Aviso cuando la API responde 200, 201 o 204 (puede depender de cuál). */
  readonly exito: AvisoEscritura | ((estado: number) => AvisoEscritura);
  /** La operación no usa ningún dato del formulario: no se lee el cuerpo (un POST vacío, sin tipo de contenido, también vale). */
  readonly sinFormulario?: boolean;
  /** Aviso cuando la API responde 409, si la operación tiene uno propio (por omisión, «conflicto»). */
  readonly conflicto?: AvisoEscritura;
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
  if (!entrada.slugVerificado || entrada.slugVerificado !== entrada.slugDeLaDireccion)
    return new Response(null, { status: 404, headers: SIN_CACHE });
  const slug = entrada.slugVerificado;
  let id: string | null = null;
  if (op.conId) {
    if (!entrada.id || !UUID_DIRECCION.test(entrada.id)) return new Response(null, { status: 404, headers: SIN_CACHE });
    id = entrada.id.toLowerCase();
  }
  const destino = (f: FormData | null): string => op.volverA?.(f, id) ?? op.pantalla;

  const redirigir = (ubicacion: string, cookies: readonly string[]): Response => {
    const cabeceras = new Headers({ Location: ubicacion, ...SIN_CACHE });
    for (const c of cookies) cabeceras.append('Set-Cookie', c);
    return new Response(null, { status: 303, headers: cabeceras });
  };
  const aIngresar = (cookies: readonly string[]): Response =>
    redirigir(`${config.origen}/auth/login?retorno=${encodeURIComponent(`/e/${slug}/${destino(null)}`)}`, cookies);

  // Una subida que ya declara más bytes de los permitidos se rechaza sin leer el cuerpo (no se carga un archivo enorme en memoria).
  const declarado = Number(peticion.headers.get('content-length'));
  if (op.limiteCuerpo !== undefined && Number.isFinite(declarado) && declarado > op.limiteCuerpo)
    return redirigir(`${config.origen}/e/${slug}/${destino(null)}?aviso=archivo_grande`, []);
  // Sin sesión no se lee ni un byte del cuerpo (una subida puede pesar hasta 25 MB): primero se abre la cookie, que es local.
  const servicio = crearServicioSesion(entrada.deps);
  const sesion = await servicio.leer(peticion);
  if (!sesion) return aIngresar([]);
  let formulario: FormData;
  if (op.sinFormulario) formulario = new FormData();
  else {
    try {
      formulario = await peticion.formData();
    } catch {
      return redirigir(`${config.origen}/e/${slug}/${destino(null)}?aviso=no_valido`, []);
    }
  }
  const volver = (aviso: AvisoEscritura, cookies: readonly string[]): Response => {
    const conservado = new URLSearchParams(op.conservar?.(formulario) ?? '');
    conservado.set('aviso', aviso);
    return redirigir(`${config.origen}/e/${slug}/${destino(formulario)}?${conservado}`, cookies);
  };

  const cuerpo = op.cuerpo(formulario, id);
  const rutaApi = typeof op.rutaApi === 'string' ? op.rutaApi : op.rutaApi(formulario, id);
  if (cuerpo === 'archivo_grande') return volver('archivo_grande', []);
  if (!cuerpo || !rutaApi) return volver('no_valido', []);
  const acceso = await servicio.obtenerAcceso(sesion);
  if (!acceso.ok)
    return acceso.motivo === 'expirada' ? aIngresar([acceso.limpiarCookie ?? servicio.borrarCookie()]) : volver('no_disponible', []);
  const cookies = acceso.nuevaCookie ? [acceso.nuevaCookie] : [];

  let estado: number | null;
  try {
    const r = await entrada.deps.fetchFn(`${config.apiUrl}${rutaApi}`, {
      method: op.metodoApi,
      // Con un `FormData` no se pone Content-Type: lo arma `fetch` con el delimitador. Sin cuerpo, tampoco.
      headers: {
        authorization: `Bearer ${acceso.acceso}`,
        accept: 'application/json',
        ...(cuerpo instanceof FormData || cuerpo === SIN_CUERPO ? {} : { 'content-type': 'application/json' }),
      },
      ...(cuerpo === SIN_CUERPO ? {} : { body: cuerpo instanceof FormData ? cuerpo : JSON.stringify(cuerpo) }),
      signal: AbortSignal.timeout(op.tiempoMs ?? 10_000),
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
  if (estado === 200 || estado === 201 || estado === 204)
    return volver(typeof op.exito === 'function' ? op.exito(estado) : op.exito, cookies);
  if (estado === 400) return volver('no_valido', cookies);
  if (estado === 403) return volver('sin_permiso', cookies);
  if (estado === 404) return volver('no_encontrado', cookies);
  if (estado === 409) return volver(op.conflicto ?? 'conflicto', cookies);
  if (estado === 413) return volver('archivo_grande', cookies);
  if (estado === 415) return volver('tipo_no_permitido', cookies);
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
      if (!libreriaCodigo || !CODIGO.test(libreriaCodigo) || !idEstable || !ID.test(idEstable) || !estado || !ESTADOS.includes(estado))
        return null;
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
  return resto.length === 0 && libreriaCodigo && idEstable && CODIGO.test(libreriaCodigo) && ID.test(idEstable)
    ? { libreriaCodigo, idEstable }
    : null;
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

// ---- Evidencias con archivo (M4)

const FECHA_DIRECCION = /^\d{4}-\d{2}-\d{2}$/;
const TIPOS_EVIDENCIA = ['documento', 'registro'];
/** Un título de evidencia: 1 a 120 caracteres, ya recortado (la API aplica las mismas reglas). */
const tituloEvidencia = (f: FormData): string | null | undefined => {
  const v = opcional(f, 'titulo');
  return v === null ? undefined : v.length <= 120 ? v : null;
};

/** El archivo del formulario: presente, no vacío; `'grande'` si pasa de 25 MB; `null` si no es un archivo. */
const archivoDe = (f: FormData): File | 'grande' | null => {
  const a = f.get('archivo');
  if (!(a instanceof File) || a.size === 0) return null;
  return a.size > ARCHIVO_MAX ? 'grande' : a;
};

/**
 * Arma el cuerpo multipart para la API con los campos en el ORDEN que exige (primero los de texto, al final el archivo), sin importar
 * en qué orden los mandó el navegador. Solo pasan los campos conocidos y ya validados.
 */
const cuerpoEvidencia = (f: FormData, o: { tipoObligatorio: boolean; tituloObligatorio: boolean }): Cuerpo => {
  const archivo = archivoDe(f);
  if (archivo === 'grande') return 'archivo_grande';
  const tipo = opcional(f, 'tipo');
  const titulo = tituloEvidencia(f);
  const fechaHecho = opcional(f, 'fechaHecho');
  const vigenteHasta = opcional(f, 'vigenteHasta');
  if (!archivo || titulo === null || !fechaHecho || !FECHA_DIRECCION.test(fechaHecho)) return null;
  if ((o.tipoObligatorio && !tipo) || (tipo !== null && !TIPOS_EVIDENCIA.includes(tipo))) return null;
  if (o.tituloObligatorio && titulo === undefined) return null;
  if (vigenteHasta !== null && !FECHA_DIRECCION.test(vigenteHasta)) return null;
  const salida = new FormData();
  if (tipo) salida.append('tipo', tipo);
  if (titulo !== undefined) salida.append('titulo', titulo);
  salida.append('fechaHecho', fechaHecho);
  if (vigenteHasta) salida.append('vigenteHasta', vigenteHasta);
  salida.append('archivo', archivo, archivo.name.slice(0, 200));
  return salida;
};

/** El control al que se vuelve tras reemplazar o eliminar (campo oculto `control`), solo si es un UUID. */
const controlDeVuelta = (f: FormData | null): string | null => {
  const c = f ? campo(f, 'control') : null;
  return c && UUID_DIRECCION.test(c) ? c.toLowerCase() : null;
};
const paginaDelControl = (_f: FormData | null, id: string | null): string => (id ? `controles/${id}` : 'controles');
const paginaDeLaEvidencia = (f: FormData | null): string => {
  const c = controlDeVuelta(f);
  return c ? `controles/${c}` : 'controles';
};
const conservarHistoricas = (f: FormData): string => (campo(f, 'f_historicas') === 'true' ? 'historicas=true' : '');

export const subirEvidencia = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'controles',
    volverA: paginaDelControl,
    conId: true,
    metodoApi: 'POST',
    rutaApi: (_f, id) => (id ? `/controles/${id}/evidencias` : null),
    exito: 'evidencia_subida',
    limiteCuerpo: ARCHIVO_MAX + 256 * 1024,
    tiempoMs: 120_000,
    conservar: conservarHistoricas,
    cuerpo: (f) => cuerpoEvidencia(f, { tipoObligatorio: true, tituloObligatorio: true }),
  });

export const reemplazarEvidencia = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'controles',
    volverA: paginaDeLaEvidencia,
    conId: true,
    metodoApi: 'POST',
    rutaApi: (_f, id) => (id ? `/evidencias/${id}/reemplazo` : null),
    exito: 'evidencia_reemplazada',
    limiteCuerpo: ARCHIVO_MAX + 256 * 1024,
    tiempoMs: 120_000,
    conservar: conservarHistoricas,
    cuerpo: (f) => cuerpoEvidencia(f, { tipoObligatorio: false, tituloObligatorio: false }),
  });

export const eliminarEvidencia = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'controles',
    volverA: paginaDeLaEvidencia,
    conId: true,
    metodoApi: 'POST',
    rutaApi: (_f, id) => (id ? `/evidencias/${id}/eliminacion` : null),
    exito: 'evidencia_eliminada',
    conservar: conservarHistoricas,
    cuerpo: () => SIN_CUERPO,
  });

const TIPOS_DESCARGA: readonly string[] = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

interface ParametrosDescarga {
  /** La dirección debe traer un UUID (`entrada.id`); si no, 404. */
  readonly conId: boolean;
  /** Ruta de la API; recibe el UUID ya validado (o nulo si no se exige). */
  readonly rutaApi: (id: string | null) => string;
  /** Pantalla (tras `/e/<empresa>/`) a la que se vuelve con un aviso si algo falla. */
  readonly pantalla: string;
  readonly tipos: readonly string[];
  /** Nombre del adjunto si la API mandara una disposición que no cumple la forma esperada. */
  readonly nombreGenerico: string;
}

/**
 * Descarga de un archivo: la web NO deja pasar el token al navegador; pide el archivo a la API con el token de la sesión y se lo
 * entrega a la persona, siempre como adjunto. Del archivo solo se reenvían cabeceras de una lista cerrada y ya validadas: el tipo
 * debe ser uno de los permitidos para esa descarga y la disposición siempre es de adjunto, pase lo que pase con lo que diga la API.
 */
const descargar = async (peticion: Request, entrada: Entrada, p: ParametrosDescarga): Promise<Response> => {
  const { config } = entrada.deps;
  if (peticion.method !== 'GET') return new Response('Método no permitido', { status: 405, headers: { Allow: 'GET', ...SIN_CACHE } });
  if (!entrada.slugVerificado || entrada.slugVerificado !== entrada.slugDeLaDireccion)
    return new Response(null, { status: 404, headers: SIN_CACHE });
  let id: string | null = null;
  if (p.conId) {
    if (!entrada.id || !UUID_DIRECCION.test(entrada.id)) return new Response(null, { status: 404, headers: SIN_CACHE });
    id = entrada.id.toLowerCase();
  }
  const slug = entrada.slugVerificado;
  const redirigir = (ubicacion: string, cookies: readonly string[]): Response => {
    const cabeceras = new Headers({ Location: ubicacion, ...SIN_CACHE });
    for (const c of cookies) cabeceras.append('Set-Cookie', c);
    return new Response(null, { status: 303, headers: cabeceras });
  };
  const aIngresar = (cookies: readonly string[]): Response =>
    redirigir(`${config.origen}/auth/login?retorno=${encodeURIComponent(`/e/${slug}/${p.pantalla}`)}`, cookies);
  const aviso = (a: AvisoEscritura, cookies: readonly string[]): Response =>
    redirigir(`${config.origen}/e/${slug}/${p.pantalla}?aviso=${a}`, cookies);

  const servicio = crearServicioSesion(entrada.deps);
  const sesion = await servicio.leer(peticion);
  if (!sesion) return aIngresar([]);
  const acceso = await servicio.obtenerAcceso(sesion);
  if (!acceso.ok)
    return acceso.motivo === 'expirada' ? aIngresar([acceso.limpiarCookie ?? servicio.borrarCookie()]) : aviso('no_disponible', []);
  const cookies = acceso.nuevaCookie ? [acceso.nuevaCookie] : [];

  let r: Response;
  try {
    r = await entrada.deps.fetchFn(`${config.apiUrl}${p.rutaApi(id)}`, {
      headers: { authorization: `Bearer ${acceso.acceso}`, accept: '*/*' },
      signal: AbortSignal.timeout(120_000),
      redirect: 'error',
      cache: 'no-store',
    });
  } catch {
    return aviso('no_disponible', cookies);
  }
  if (r.status === 401) {
    entrada.deps.almacen.borrar(sesion.sid);
    return aIngresar([servicio.borrarCookie()]);
  }
  if (r.status === 403) return aviso('sin_permiso', cookies);
  if (r.status === 404) return aviso('no_encontrado', cookies);
  const tipo = r.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
  if (r.status !== 200 || !r.body || !p.tipos.includes(tipo)) return aviso('no_disponible', cookies);

  const cabeceras = new Headers({
    'Content-Type': tipo,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  });
  // Siempre adjunto: si la API mandara otra cosa, se entrega con un nombre genérico.
  const disposicion = r.headers.get('content-disposition') ?? '';
  cabeceras.set(
    'Content-Disposition',
    /^attachment; filename="[^"\r\n]{1,200}"(; filename\*=UTF-8''[A-Za-z0-9%._~!-]{1,600})?$/.test(disposicion)
      ? disposicion
      : `attachment; filename="${p.nombreGenerico}"`,
  );
  const largo = r.headers.get('content-length');
  if (largo && /^\d{1,9}$/.test(largo)) cabeceras.set('Content-Length', largo);
  for (const c of cookies) cabeceras.append('Set-Cookie', c);
  return new Response(r.body, { status: 200, headers: cabeceras });
};

/** Descarga de una evidencia: siempre adjunto, con uno de los siete tipos permitidos. */
export const descargarEvidencia = (peticion: Request, entrada: Entrada): Promise<Response> =>
  descargar(peticion, entrada, {
    conId: true,
    rutaApi: (id) => `/evidencias/${id}/archivo`,
    pantalla: 'controles',
    tipos: TIPOS_DESCARGA,
    nombreGenerico: 'archivo',
  });

const TIPO_WORD = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Descarga del borrador de la declaración en Word (sin identificador): siempre adjunto y solo del tipo Word. */
export const descargarBorradorDeclaracion = (peticion: Request, entrada: Entrada): Promise<Response> =>
  descargar(peticion, entrada, {
    conId: false,
    rutaApi: () => '/declaracion/documento',
    pantalla: 'declaracion',
    tipos: [TIPO_WORD],
    nombreGenerico: 'declaracion.docx',
  });

/** Descarga de una versión aprobada de la declaración en Word (el identificador de la versión va en la dirección). */
export const descargarVersionDeclaracion = (peticion: Request, entrada: Entrada): Promise<Response> =>
  descargar(peticion, entrada, {
    conId: true,
    rutaApi: (id) => `/declaracion/versiones/${id}/documento`,
    pantalla: 'declaracion',
    tipos: [TIPO_WORD],
    nombreGenerico: 'declaracion.docx',
  });

/** Aprueba la declaración: la API congela la versión (no lleva cuerpo; la empresa y la persona salen del token). */
export const aprobarDeclaracion = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'declaracion',
    metodoApi: 'POST',
    rutaApi: '/declaracion/aprobacion',
    exito: 'declaracion_aprobada',
    conflicto: 'declaracion_no_aprobada',
    sinFormulario: true,
    cuerpo: () => SIN_CUERPO,
  });
