// Escrituras de los activos desde la web (ADR 038). La web NO decide nada: reenvía a la API (que autoriza, valida y registra en la bitácora)
// con el token de la sesión; la empresa y la persona salen del token. Solo se arma un cuerpo con una lista cerrada de campos.
import { campo, opcional, reenviar, type Entrada } from '../certificacion/escribir';
import { UUID } from '../validacion/patrones';
import { CLASIFICACIONES_ACTIVO, TIPOS_ACTIVO } from './tipos';

const uuidDe = (f: FormData, nombre: string): string | null => {
  const v = opcional(f, nombre);
  return v && UUID.test(v) ? v.toLowerCase() : null;
};
const textoAcotado = (f: FormData, nombre: string, max: number): string | null | undefined => {
  const v = opcional(f, nombre);
  if (v === null) return undefined;
  return v.length <= max ? v : null;
};
const versionDe = (f: FormData): number | null => {
  const v = campo(f, 'version');
  return v !== null && /^[1-9]\d{0,8}$/.test(v) ? Number(v) : null;
};
const detalle = (_f: FormData | null, id: string | null): string => (id ? `activos/${id}` : 'activos');
/** Tras ligar o desligar se vuelve al riesgo (campo oculto `riesgoId`, solo si es un UUID). */
const alRiesgo = (f: FormData | null): string => {
  const r = f ? uuidDe(f, 'riesgoId') : null;
  return r ? `riesgos/${r}` : 'riesgos';
};

export const crearActivo = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'activos',
    volverA: () => 'activos',
    metodoApi: 'POST',
    rutaApi: '/activos',
    exito: 'activo_creado',
    cuerpo: (f) => {
      const nombre = opcional(f, 'nombre');
      const tipo = campo(f, 'tipo');
      const clasificacion = campo(f, 'clasificacion');
      const responsable = uuidDe(f, 'responsableId');
      const descripcion = textoAcotado(f, 'descripcion', 500);
      if (!nombre || nombre.length > 120 || !tipo || !(TIPOS_ACTIVO as readonly string[]).includes(tipo) || !clasificacion || !(CLASIFICACIONES_ACTIVO as readonly string[]).includes(clasificacion) || !responsable || descripcion === null) return null;
      return { nombre, tipo, clasificacion, responsableId: responsable, ...(descripcion ? { descripcion } : {}) };
    },
  });

export const cambiarActivo = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'activos',
    volverA: detalle,
    conId: true,
    metodoApi: 'PUT',
    rutaApi: (_f, id) => (id ? `/activos/${id}` : null),
    exito: 'activo_guardado',
    cuerpo: (f) => {
      const version = versionDe(f);
      const nombre = opcional(f, 'nombre');
      const tipo = campo(f, 'tipo');
      const clasificacion = campo(f, 'clasificacion');
      const responsable = uuidDe(f, 'responsableId');
      const descripcion = textoAcotado(f, 'descripcion', 500);
      if (version === null || !nombre || nombre.length > 120 || !tipo || !(TIPOS_ACTIVO as readonly string[]).includes(tipo) || !clasificacion || !(CLASIFICACIONES_ACTIVO as readonly string[]).includes(clasificacion) || !responsable || descripcion === null) return null;
      return { versionEsperada: version, nombre, tipo, clasificacion, responsableId: responsable, descripcion: descripcion ?? null };
    },
  });

export const retirarActivo = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'activos',
    volverA: detalle,
    conId: true,
    metodoApi: 'POST',
    rutaApi: (_f, id) => (id ? `/activos/${id}/retiro` : null),
    exito: 'activo_retirado',
    cuerpo: (f) => {
      const version = versionDe(f);
      return version === null ? null : { versionEsperada: version };
    },
  });

export const ligarActivo = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'riesgos',
    volverA: alRiesgo,
    metodoApi: 'POST',
    rutaApi: (f) => {
      const r = uuidDe(f, 'riesgoId');
      return r ? `/riesgos/${r}/activos` : null;
    },
    exito: 'activo_ligado',
    cuerpo: (f) => {
      const a = uuidDe(f, 'activoId');
      return a ? { activoId: a } : null;
    },
  });

export const desligarActivo = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'riesgos',
    volverA: alRiesgo,
    metodoApi: 'POST',
    rutaApi: (f) => {
      const r = uuidDe(f, 'riesgoId');
      return r ? `/riesgos/${r}/activos/eliminacion` : null;
    },
    exito: 'activo_desligado',
    cuerpo: (f) => {
      const a = uuidDe(f, 'activoId');
      return a ? { activoId: a } : null;
    },
  });
