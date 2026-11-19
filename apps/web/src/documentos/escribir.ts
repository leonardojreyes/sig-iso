// Escrituras del control documental desde la web (ADR 039). La web NO decide nada: reenvía a la API (que autoriza, valida y registra en la
// bitácora) con el token de la sesión; la empresa y la persona salen del token, nunca del formulario. Aquí solo se arma un cuerpo con una
// lista cerrada de campos. El resultado vuelve a la pantalla como un aviso de una lista cerrada.
import {
  ARCHIVO_MAX,
  SIN_CUERPO,
  TIPOS_DESCARGA,
  campo,
  descargar,
  opcional,
  reenviar,
  type Entrada,
} from '../certificacion/escribir';
import { UUID } from '../validacion/patrones';
import { CLASIFICACIONES, MOTIVOS_DEVOLUCION, MOTIVOS_REVISION, TIPOS_DOCUMENTO } from './tipos';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const LIBRERIA = /^[a-z0-9][a-z0-9-]{0,63}$/;
const ID_ESTABLE = /^[a-z0-9][a-z0-9.-]{0,40}$/;
const ROL = /^[a-z_]{3,30}$/;

const uuidDe = (f: FormData, nombre: string): string | null => {
  const v = opcional(f, nombre);
  return v && UUID.test(v) ? v.toLowerCase() : null;
};
const textoAcotado = (f: FormData, nombre: string, max: number): string | null | undefined => {
  const v = opcional(f, nombre);
  if (v === null) return undefined; // no enviado
  return v.length <= max ? v : null; // demasiado largo: el formulario no es válido
};
const versionDe = (f: FormData): number | null => {
  const v = campo(f, 'version');
  return v !== null && /^[1-9]\d{0,8}$/.test(v) ? Number(v) : null;
};
const fechaOpcional = (f: FormData, nombre: string): string | null | undefined => {
  const v = opcional(f, nombre);
  if (v === null) return undefined;
  return FECHA.test(v) ? v : null;
};

/** Pantalla del documento al que se vuelve (campo oculto `documento`, solo si es un UUID). */
const detalleDe = (f: FormData | null, id: string | null): string => {
  const d = f ? uuidDe(f, 'documento') : null;
  return d ? `documentos/${d}` : id ? `documentos/${id}` : 'documentos';
};

/** Tras una operación sobre una VERSIÓN, el documento al que se vuelve viene en el formulario (la dirección trae el id de la versión). */
const detalleDeVersion = (f: FormData | null): string => {
  const d = f ? uuidDe(f, 'documento') : null;
  return d ? `documentos/${d}` : 'documentos';
};

export const crearDocumento = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'documentos',
    volverA: () => 'documentos',
    metodoApi: 'POST',
    rutaApi: '/documentos',
    exito: 'documento_creado',
    cuerpo: (f) => {
      const tipo = campo(f, 'tipo');
      const clasificacion = campo(f, 'clasificacion');
      const titulo = opcional(f, 'titulo');
      const responsable = uuidDe(f, 'responsableId');
      const area = textoAcotado(f, 'area', 60);
      const emisor = textoAcotado(f, 'emisor', 120);
      const edicion = textoAcotado(f, 'edicionFuente', 60);
      if (!tipo || !(TIPOS_DOCUMENTO as readonly string[]).includes(tipo) || !clasificacion || !(CLASIFICACIONES as readonly string[]).includes(clasificacion)) return null;
      if (!titulo || titulo.length > 120 || !responsable || area === null || emisor === null || edicion === null) return null;
      return { tipo, titulo, clasificacion, responsableId: responsable, ...(area ? { area } : {}), ...(emisor ? { emisor } : {}), ...(edicion ? { edicionFuente: edicion } : {}) };
    },
  });

export const cambiarDocumento = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'documentos',
    volverA: detalleDe,
    conId: true,
    metodoApi: 'PUT',
    rutaApi: (_f, id) => (id ? `/documentos/${id}` : null),
    exito: 'documento_guardado',
    cuerpo: (f) => {
      const version = versionDe(f);
      const titulo = opcional(f, 'titulo');
      const clasificacion = campo(f, 'clasificacion');
      const responsable = uuidDe(f, 'responsableId');
      const area = textoAcotado(f, 'area', 60);
      const emisor = textoAcotado(f, 'emisor', 120);
      const edicion = textoAcotado(f, 'edicionFuente', 60);
      if (version === null || !titulo || titulo.length > 120 || !clasificacion || !(CLASIFICACIONES as readonly string[]).includes(clasificacion)) return null;
      if (area === null || emisor === null || edicion === null || (opcional(f, 'responsableId') !== null && !responsable)) return null;
      return {
        versionEsperada: version,
        titulo,
        clasificacion,
        ...(responsable ? { responsableId: responsable } : {}),
        area: area ?? null, // vacío = quitar el área
        emisor: emisor ?? null,
        edicionFuente: edicion ?? null,
      };
    },
  });

export const retirarDocumento = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'documentos',
    volverA: detalleDe,
    conId: true,
    metodoApi: 'POST',
    rutaApi: (_f, id) => (id ? `/documentos/${id}/retiro` : null),
    exito: 'documento_retirado',
    sinFormulario: true,
    cuerpo: () => SIN_CUERPO,
  });

export const revisarDocumento = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'documentos',
    volverA: detalleDe,
    conId: true,
    metodoApi: 'POST',
    rutaApi: (_f, id) => (id ? `/documentos/${id}/revision` : null),
    exito: 'documento_revisado',
    cuerpo: (f) => {
      const motivo = opcional(f, 'motivo');
      const proxima = fechaOpcional(f, 'proximaRevision');
      if ((motivo !== null && !(MOTIVOS_REVISION as readonly string[]).includes(motivo)) || proxima === null) return null;
      return { ...(motivo ? { motivo } : {}), ...(proxima ? { proximaRevision: proxima } : {}) };
    },
  });

export const distribuirDocumento = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'documentos',
    volverA: detalleDe,
    conId: true,
    metodoApi: 'PUT',
    rutaApi: (_f, id) => (id ? `/documentos/${id}/distribucion` : null),
    exito: 'distribucion_guardada',
    cuerpo: (f) => {
      const personas = f.getAll('usuarioIds').map((v) => (typeof v === 'string' && UUID.test(v) ? v.toLowerCase() : null));
      const roles = f.getAll('roles').map((v) => (typeof v === 'string' && ROL.test(v) ? v : null));
      if (personas.includes(null) || roles.includes(null) || personas.length > 500 || roles.length > 10) return null;
      return { usuarioIds: [...new Set(personas as string[])], roles: [...new Set(roles as string[])] };
    },
  });

const vinculoDe = (f: FormData): Record<string, string> | null => {
  const control = opcional(f, 'controlId');
  if (control !== null) return UUID.test(control) ? { controlId: control.toLowerCase() } : null;
  const libreria = opcional(f, 'libreriaCodigo');
  const id = opcional(f, 'idEstable');
  return libreria && id && LIBRERIA.test(libreria) && ID_ESTABLE.test(id) ? { libreriaCodigo: libreria, idEstable: id } : null;
};

export const vincularDocumento = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'documentos',
    volverA: detalleDe,
    conId: true,
    metodoApi: 'POST',
    rutaApi: (_f, id) => (id ? `/documentos/${id}/vinculos` : null),
    exito: 'documento_vinculado',
    cuerpo: vinculoDe,
  });

export const desvincularDocumento = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'documentos',
    volverA: detalleDe,
    conId: true,
    metodoApi: 'POST',
    rutaApi: (_f, id) => (id ? `/documentos/${id}/vinculos/eliminacion` : null),
    exito: 'documento_desvinculado',
    cuerpo: vinculoDe,
  });

/** Sube una versión: la nota va ANTES del archivo (la API decide antes de leer un solo byte). */
export const subirVersion = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'documentos',
    volverA: detalleDe,
    conId: true,
    metodoApi: 'POST',
    rutaApi: (_f, id) => (id ? `/documentos/${id}/versiones` : null),
    exito: 'version_subida',
    limiteCuerpo: ARCHIVO_MAX + 256 * 1024,
    tiempoMs: 120_000,
    cuerpo: (f) => {
      const archivo = f.get('archivo');
      if (!(archivo instanceof File) || archivo.size === 0) return null;
      if (archivo.size > ARCHIVO_MAX) return 'archivo_grande';
      const nota = opcional(f, 'nota');
      if (!nota || nota.length > 500) return null;
      const salida = new FormData();
      salida.append('nota', nota);
      salida.append('archivo', archivo, archivo.name.slice(0, 200));
      return salida;
    },
  });

export const enviarVersion = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'documentos',
    volverA: detalleDeVersion,
    conId: true,
    metodoApi: 'POST',
    rutaApi: (_f, id) => (id ? `/versiones/${id}/envio` : null),
    exito: 'version_enviada',
    cuerpo: (f) => {
      const aprobador = uuidDe(f, 'aprobadorId');
      return aprobador ? { aprobadorId: aprobador } : null;
    },
  });

export const devolverVersion = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'documentos',
    volverA: detalleDeVersion,
    conId: true,
    metodoApi: 'POST',
    rutaApi: (_f, id) => (id ? `/versiones/${id}/devolucion` : null),
    exito: 'version_devuelta',
    cuerpo: (f) => {
      const motivo = campo(f, 'motivo');
      const nota = textoAcotado(f, 'nota', 300);
      if (!motivo || !(MOTIVOS_DEVOLUCION as readonly string[]).includes(motivo) || nota === null) return null;
      return { motivo, ...(nota ? { nota } : {}) };
    },
  });

export const aprobarVersion = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'documentos',
    volverA: detalleDeVersion,
    conId: true,
    metodoApi: 'POST',
    rutaApi: (_f, id) => (id ? `/versiones/${id}/aprobacion` : null),
    exito: 'version_aprobada',
    cuerpo: (f) => {
      const proxima = fechaOpcional(f, 'proximaRevision');
      const excepcion = textoAcotado(f, 'motivoExcepcion', 300);
      if (proxima === null || excepcion === null) return null;
      return { ...(proxima ? { proximaRevision: proxima } : {}), requiereLectura: campo(f, 'requiereLectura') === 'on', ...(excepcion ? { motivoExcepcion: excepcion } : {}) };
    },
  });

export const descartarVersion = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'documentos',
    volverA: detalleDeVersion,
    conId: true,
    metodoApi: 'POST',
    rutaApi: (_f, id) => (id ? `/versiones/${id}/descarte` : null),
    exito: 'version_descartada',
    cuerpo: () => SIN_CUERPO,
  });

export const confirmarLectura = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'documentos',
    volverA: () => 'documentos',
    conId: true,
    metodoApi: 'POST',
    rutaApi: (_f, id) => (id ? `/versiones/${id}/lectura` : null),
    exito: 'lectura_confirmada',
    // No usa ningún campo del formulario: un POST vacío, sin tipo de contenido, también vale.
    sinFormulario: true,
    cuerpo: () => SIN_CUERPO,
  });

export const guardarRetencion = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'documentos',
    volverA: () => 'documentos',
    metodoApi: 'PUT',
    rutaApi: '/retencion',
    exito: 'retencion_guardada',
    cuerpo: (f) => {
      const tipo = campo(f, 'tipo');
      const anios = campo(f, 'anios');
      const motivo = opcional(f, 'motivo');
      const version = opcional(f, 'version');
      if (!tipo || !(TIPOS_DOCUMENTO as readonly string[]).includes(tipo) || !anios || !/^\d{1,3}$/.test(anios) || !motivo || motivo.length > 200) return null;
      if (version !== null && !/^[1-9]\d{0,8}$/.test(version)) return null;
      return { tipo, anios: Number(anios), motivo, ...(version ? { versionEsperada: Number(version) } : {}) };
    },
  });

/** Descarga el archivo de una versión: siempre adjunto y solo de los tipos permitidos. */
export const descargarVersion = (peticion: Request, entrada: Entrada): Promise<Response> =>
  descargar(peticion, entrada, {
    conId: true,
    rutaApi: (id) => `/versiones/${id}/archivo`,
    pantalla: 'documentos',
    tipos: TIPOS_DESCARGA,
    nombreGenerico: 'documento',
  });
