// Subir librerías de norma propias desde la web (ADR 034, M6a). La web NO decide nada: manda cada archivo YAML a la API (que
// autoriza, valida y registra en la bitácora) con el token de la sesión; la empresa y la persona salen del token. Un archivo por
// petición, hasta 20, en orden. Aquí solo se protege el formulario: método POST, `Origin` propio exacto, empresa de la dirección
// = empresa verificada, solo archivos .yaml/.yml y tamaño por archivo. El resultado se guarda en la memoria del servidor y la
// pantalla lo muestra UNA vez (no viaja en la dirección).
import type { DependenciasSesion } from '../auth/sesion';
import { crearServicioSesion, origenValido } from '../auth/sesion';
import { validarCargaLibreria } from '../api/validadores';
import { resultadosCompartidos, type ResultadoArchivo } from './resultados-carga';

const SIN_CACHE = { 'Cache-Control': 'no-store' };
/** 1 MB: lo que acepta la API por archivo. */
export const ARCHIVO_LIBRERIA_MAX = 1_048_576;
export const ARCHIVOS_MAX = 20;
const PETICION_MAX = ARCHIVOS_MAX * ARCHIVO_LIBRERIA_MAX + 512 * 1024;
const YAML = /\.ya?ml$/i;

export type AvisoNormas = 'sin_archivos' | 'archivo_grande' | 'sin_permiso' | 'no_valido' | 'no_disponible';
const AVISOS: readonly string[] = ['sin_archivos', 'archivo_grande', 'sin_permiso', 'no_valido', 'no_disponible'];
export const leerAvisoNormas = (sp: Readonly<Record<string, string | readonly string[] | undefined>>): AvisoNormas | null =>
  typeof sp.aviso === 'string' && AVISOS.includes(sp.aviso) ? (sp.aviso as AvisoNormas) : null;

/** Etiqueta del archivo para mostrar: sin caracteres raros ni longitud excesiva (el nombre lo escribe quien sube). */
export const etiquetaDeArchivo = (nombre: string): string => nombre.replace(/[^A-Za-z0-9._ -]/g, '_').slice(0, 60) || 'archivo';

export const subirLibrerias = async (
  peticion: Request,
  entrada: { slugDeLaDireccion: string; slugVerificado: string | null },
  deps: DependenciasSesion,
): Promise<Response> => {
  const { config } = deps;
  if (peticion.method !== 'POST') return new Response('Método no permitido', { status: 405, headers: { Allow: 'POST', ...SIN_CACHE } });
  if (!origenValido(peticion, config.origen)) return new Response('Origen no permitido', { status: 403, headers: SIN_CACHE });
  if (!entrada.slugVerificado || entrada.slugVerificado !== entrada.slugDeLaDireccion) return new Response(null, { status: 404, headers: SIN_CACHE });
  const slug = entrada.slugVerificado;

  const redirigir = (ubicacion: string, cookies: readonly string[] = []): Response => {
    const cabeceras = new Headers({ Location: ubicacion, ...SIN_CACHE });
    for (const c of cookies) cabeceras.append('Set-Cookie', c);
    return new Response(null, { status: 303, headers: cabeceras });
  };
  const volver = (aviso: AvisoNormas, cookies: readonly string[] = []): Response => redirigir(`${config.origen}/e/${slug}/normas?aviso=${aviso}`, cookies);
  const aIngresar = (cookies: readonly string[]): Response => redirigir(`${config.origen}/auth/login?retorno=${encodeURIComponent(`/e/${slug}/normas`)}`, cookies);

  // Una subida que ya declara más de lo posible se rechaza sin leer el cuerpo.
  const declarado = Number(peticion.headers.get('content-length'));
  if (Number.isFinite(declarado) && declarado > PETICION_MAX) return volver('archivo_grande');
  // Sin sesión no se lee ni un byte del cuerpo (la subida puede pesar decenas de MB): primero se abre la cookie, que es local.
  const servicio = crearServicioSesion(deps);
  const sesion = await servicio.leer(peticion);
  if (!sesion) return aIngresar([]);
  let formulario: FormData;
  try {
    formulario = await peticion.formData();
  } catch {
    return volver('no_valido');
  }
  const todos = formulario.getAll('archivos').filter((v): v is File => typeof v !== 'string' && v.size > 0);
  const yamls = todos.filter((f) => YAML.test(f.name)).sort((a, b) => a.name.localeCompare(b.name));
  const omitidos = todos.length - yamls.length;
  if (yamls.length === 0) return volver('sin_archivos');
  const elegidos = yamls.slice(0, ARCHIVOS_MAX);

  const acceso = await servicio.obtenerAcceso(sesion);
  if (!acceso.ok) return acceso.motivo === 'expirada' ? aIngresar([acceso.limpiarCookie ?? servicio.borrarCookie()]) : volver('no_disponible');
  const cookies = acceso.nuevaCookie ? [acceso.nuevaCookie] : [];

  const archivos: ResultadoArchivo[] = [];
  for (const archivo of elegidos) {
    const nombre = etiquetaDeArchivo(archivo.name);
    if (archivo.size > ARCHIVO_LIBRERIA_MAX) {
      archivos.push({ nombre, tipo: 'fallo', motivo: 'archivo_grande' });
      continue;
    }
    const cuerpo = new FormData();
    cuerpo.append('archivo', archivo, nombre);
    let estado: number | null;
    let json: unknown = null;
    try {
      const r = await deps.fetchFn(`${config.apiUrl}/librerias/carga`, {
        method: 'POST',
        headers: { authorization: `Bearer ${acceso.acceso}`, accept: 'application/json' },
        body: cuerpo,
        signal: AbortSignal.timeout(30_000),
        redirect: 'error',
        cache: 'no-store',
      });
      estado = r.status;
      if (estado === 200 || estado === 201) json = await r.json().catch(() => null);
    } catch {
      estado = null;
    }
    if (estado === 401) {
      deps.almacen.borrar(sesion.sid);
      return aIngresar([servicio.borrarCookie()]);
    }
    // Sin permiso no tiene sentido seguir con los demás archivos.
    if (estado === 403) return volver('sin_permiso', cookies);
    if (estado === 200 || estado === 201) {
      const carga = validarCargaLibreria(json);
      archivos.push(carga ? { nombre, tipo: 'respuesta', carga } : { nombre, tipo: 'fallo', motivo: 'no_disponible' });
    } else archivos.push({ nombre, tipo: 'fallo', motivo: estado === 413 ? 'archivo_grande' : 'no_disponible' });
  }

  const id = resultadosCompartidos().guardar(slug, { archivos, omitidos, recortado: yamls.length > ARCHIVOS_MAX }, deps.ahora().getTime());
  return redirigir(`${config.origen}/e/${slug}/normas?carga=${id}`, cookies);
};

/** La plantilla se entrega siempre como adjunto y de un tipo fijo; no usa datos de la petición. */
export const descargarPlantilla = (peticion: Request, entrada: { slugDeLaDireccion: string; slugVerificado: string | null }, contenido: string, nombre: string): Response => {
  if (peticion.method !== 'GET') return new Response('Método no permitido', { status: 405, headers: { Allow: 'GET', ...SIN_CACHE } });
  if (!entrada.slugVerificado || entrada.slugVerificado !== entrada.slugDeLaDireccion) return new Response(null, { status: 404, headers: SIN_CACHE });
  return new Response(contenido, {
    status: 200,
    headers: {
      'Content-Type': 'application/yaml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'X-Content-Type-Options': 'nosniff',
      ...SIN_CACHE,
    },
  });
};
