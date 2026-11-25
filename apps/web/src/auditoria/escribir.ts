// Escrituras de la auditoría interna desde la web (ADR 040). La web NO decide nada: reenvía a la API (que autoriza, valida y registra en
// la bitácora) con el token de la sesión; la empresa y la persona salen del token, nunca del formulario. Cada acción es una entrada de una
// LISTA CERRADA con su método, su ruta de la API, un cuerpo armado con campos conocidos y el aviso de éxito. Lo desconocido responde 404.
// El resultado vuelve a la pantalla como un aviso de una lista cerrada (nunca texto de la API ni del usuario).
import {
  SIN_CUERPO,
  campo,
  descargar,
  opcional,
  reenviar,
  type AvisoEscritura,
  type Entrada,
} from '../certificacion/escribir';
import { SIN_CACHE } from '../auth/guardia-formulario';
import { UUID } from '../validacion/patrones';
import {
  FRECUENCIAS,
  IMPORTANCIAS,
  CAMBIOS_RELEVANTES,
  MOTIVOS_ANULACION,
  MOTIVOS_CAMBIO,
  RELACIONES,
  RESULTADOS,
  ROLES_EQUIPO,
  TIPOS_HALLAZGO,
} from './tipos';

type Cuerpo = Record<string, unknown> | typeof SIN_CUERPO | null;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const NORMA = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const ID_ESTABLE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;

const uuidDe = (f: FormData, nombre: string): string | null => {
  const v = opcional(f, nombre);
  return v && UUID.test(v) ? v.toLowerCase() : null;
};
const versionDe = (f: FormData): number | null => {
  const v = campo(f, 'version');
  return v !== null && /^[1-9]\d{0,8}$/.test(v) ? Number(v) : null;
};
const de = <T extends string>(f: FormData, nombre: string, lista: readonly T[]): T | null => {
  const v = opcional(f, nombre);
  return v !== null && (lista as readonly string[]).includes(v) ? (v as T) : null;
};
/** Texto obligatorio y acotado, o nulo si falta o es muy largo. */
const obligatorio = (f: FormData, nombre: string, max: number): string | null => {
  const v = opcional(f, nombre);
  return v !== null && v.length <= max ? v : null;
};
/** Texto opcional: `undefined` si no vino, nulo si es muy largo (el formulario no es válido). */
const acotado = (f: FormData, nombre: string, max: number): string | null | undefined => {
  const v = opcional(f, nombre);
  if (v === null) return undefined;
  return v.length <= max ? v : null;
};
/** Marca de «enviar nulo» (borrar un campo): se distingue de `null`, que significa «el formulario no es válido». */
const NULO = Symbol('nulo');
/** Una fecha AAAA-MM-DD que existe en el calendario (rechaza «2027-02-30»). */
const fechaReal = (v: string): boolean => {
  if (!FECHA.test(v)) return false;
  const [a, m, d] = v.split('-').map(Number) as [number, number, number];
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
};
const fechaDe = (f: FormData, nombre: string): string | null => {
  const v = opcional(f, nombre);
  return v !== null && fechaReal(v) ? v : null;
};
/** Lista cerrada opcional: `undefined` si no vino, nulo si vino con un valor que no está en la lista. */
const deOpcional = <T extends string>(f: FormData, nombre: string, lista: readonly T[]): T | null | undefined => (opcional(f, nombre) === null ? undefined : de(f, nombre, lista));
/** Para borrar: vacío envía nulo; con valor, debe ser de la lista. */
const deONulo = <T extends string>(f: FormData, nombre: string, lista: readonly T[]): T | null | typeof NULO => (opcional(f, nombre) === null ? NULO : de(f, nombre, lista));
const textoONulo = (f: FormData, nombre: string, max: number): string | null | typeof NULO => {
  const v = opcional(f, nombre);
  if (v === null) return NULO;
  return v.length <= max ? v : null;
};
const fechaONula = (f: FormData, nombre: string): string | null | typeof NULO => (opcional(f, nombre) === null ? NULO : fechaDe(f, nombre));
const uuidONulo = (f: FormData, nombre: string): string | null | typeof NULO => (opcional(f, nombre) === null ? NULO : uuidDe(f, nombre));
/** Fecha opcional: `undefined` si no vino, nulo si no es una fecha real. */
const fechaOpcional = (f: FormData, nombre: string): string | null | undefined => {
  const v = opcional(f, nombre);
  if (v === null) return undefined;
  return fechaReal(v) ? v : null;
};
const normasDe = (f: FormData): string[] | null => {
  const v = f.getAll('normas').filter((x): x is string => typeof x === 'string' && x !== '');
  return v.length >= 1 && v.length <= 10 && v.every((n) => NORMA.test(n)) ? v : null;
};
const procesosDe = (f: FormData): string[] | null => {
  const v = f.getAll('procesosIds').filter((x): x is string => typeof x === 'string' && x !== '');
  return v.length <= 200 && v.every((x) => UUID.test(x)) ? v.map((x) => x.toLowerCase()) : null;
};
/** Pares «librería|capítulo» (un capítulo o tema de una norma). */
const parCapitulo = (v: string): { libreriaCodigo: string; capitulo: string } | null => {
  const i = v.indexOf('|');
  if (i < 1) return null;
  const libreriaCodigo = v.slice(0, i);
  const capitulo = v.slice(i + 1).trim();
  return NORMA.test(libreriaCodigo) && capitulo.length >= 1 && capitulo.length <= 60 ? { libreriaCodigo, capitulo } : null;
};
const capitulosDe = (f: FormData): { libreriaCodigo: string; capitulo: string }[] | null => {
  const crudos = f.getAll('capitulos').filter((x): x is string => typeof x === 'string' && x !== '');
  const pares = crudos.map(parCapitulo);
  return pares.length <= 100 && pares.every((p) => p !== null) ? (pares as { libreriaCodigo: string; capitulo: string }[]) : null;
};
/** Requisito «librería|id estable» de un hallazgo. */
const requisitoDe = (f: FormData): { libreriaCodigo: string; idEstable: string } | null | undefined => {
  const v = opcional(f, 'requisito');
  if (v === null) return undefined;
  const i = v.indexOf('|');
  if (i < 1) return null;
  const libreriaCodigo = v.slice(0, i);
  const idEstable = v.slice(i + 1);
  return NORMA.test(libreriaCodigo) && ID_ESTABLE.test(idEstable) ? { libreriaCodigo, idEstable } : null;
};
/** Junta solo lo que vino; si algún campo presente no es válido (`null`), el formulario no es válido. */
const armar = (campos: Readonly<Record<string, unknown>>): Record<string, unknown> | null => {
  const salida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(campos)) {
    if (v === null) return null;
    if (v === NULO) salida[k] = null;
    else if (v !== undefined) salida[k] = v;
  }
  return salida;
};

interface Accion {
  readonly conId: boolean;
  readonly metodoApi: 'PUT' | 'POST';
  readonly rutaApi: (f: FormData, id: string | null) => string | null;
  readonly cuerpo: (f: FormData, id: string | null) => Cuerpo;
  readonly exito: AvisoEscritura;
  /** Ruta (tras `/e/<empresa>/`) a la que se vuelve. */
  readonly volverA: (f: FormData | null, id: string | null) => string;
  readonly sinFormulario?: boolean;
}

const aProcesos = (): string => 'auditoria/procesos';
const aPrograma = (_f: FormData | null, id: string | null): string => (id ? `auditoria/programas/${id}` : 'auditoria');
const aAuditoria = (_f: FormData | null, id: string | null): string => (id ? `auditoria/auditorias/${id}` : 'auditoria');
const aEjecucion = (_f: FormData | null, id: string | null): string => (id ? `auditoria/auditorias/${id}/ejecucion` : 'auditoria');
const aInforme = (_f: FormData | null, id: string | null): string => (id ? `auditoria/auditorias/${id}/informe` : 'auditoria');
const ruta = (plantilla: (id: string) => string) => (_f: FormData, id: string | null) => (id ? plantilla(id) : null);

/** Procesos de la empresa (alta, cambios, retiro y relaciones con personas). */
const procesos: Record<string, Accion> = {
  proceso_crear: {
    conId: false,
    metodoApi: 'POST',
    rutaApi: () => '/procesos',
    cuerpo: (f) =>
      armar({
        nombre: obligatorio(f, 'nombre', 120),
        descripcion: acotado(f, 'descripcion', 300),
        duenaId: uuidDe(f, 'duenaId'),
        importancia: deOpcional(f, 'importancia', IMPORTANCIAS),
        frecuencia: deOpcional(f, 'frecuencia', FRECUENCIAS),
      }),
    exito: 'proceso_guardado',
    volverA: aProcesos,
  },
  proceso_gestion_sig: {
    conId: false,
    metodoApi: 'POST',
    rutaApi: () => '/procesos/gestion-sig',
    cuerpo: () => SIN_CUERPO,
    exito: 'proceso_guardado',
    volverA: aProcesos,
    sinFormulario: true,
  },
  proceso_cambiar: {
    conId: true,
    metodoApi: 'PUT',
    rutaApi: ruta((id) => `/procesos/${id}`),
    cuerpo: (f) =>
      armar({
        versionEsperada: versionDe(f),
        nombre: obligatorio(f, 'nombre', 120),
        descripcion: textoONulo(f, 'descripcion', 300),
        duenaId: uuidDe(f, 'duenaId'),
        importancia: de(f, 'importancia', IMPORTANCIAS),
        frecuencia: de(f, 'frecuencia', FRECUENCIAS),
        // «Sin marca» (vacío) quita la marca; un valor desconocido no es válido.
        cambioRelevante: deONulo(f, 'cambioRelevante', CAMBIOS_RELEVANTES),
      }),
    exito: 'proceso_guardado',
    volverA: aProcesos,
  },
  proceso_retirar: {
    conId: true,
    metodoApi: 'POST',
    rutaApi: ruta((id) => `/procesos/${id}/retiro`),
    cuerpo: () => SIN_CUERPO,
    exito: 'proceso_retirado',
    volverA: aProcesos,
    sinFormulario: true,
  },
  relacion_agregar: {
    conId: true,
    metodoApi: 'POST',
    rutaApi: ruta((id) => `/procesos/${id}/relaciones`),
    cuerpo: (f) => armar({ personaId: uuidDe(f, 'personaId'), relacion: de(f, 'relacion', RELACIONES) }),
    exito: 'relacion_guardada',
    volverA: aProcesos,
  },
  relacion_quitar: {
    conId: true,
    metodoApi: 'POST',
    rutaApi: ruta((id) => `/procesos/${id}/relaciones/eliminacion`),
    cuerpo: (f) => armar({ personaId: uuidDe(f, 'personaId'), relacion: de(f, 'relacion', RELACIONES) }),
    exito: 'relacion_quitada',
    volverA: aProcesos,
  },
};

/** Programa anual: alta, cambios, motivos de lo que no entra y aprobación. */
const programas: Record<string, Accion> = {
  programa_crear: {
    conId: false,
    metodoApi: 'POST',
    rutaApi: () => '/programas',
    cuerpo: (f) => {
      const anio = campo(f, 'anio');
      return armar({
        anio: anio !== null && /^(20\d\d|2100)$/.test(anio) ? Number(anio) : null,
        objetivo: obligatorio(f, 'objetivo', 500),
        normas: normasDe(f),
      });
    },
    exito: 'programa_guardado',
    volverA: () => 'auditoria',
  },
  programa_cambiar: {
    conId: true,
    metodoApi: 'PUT',
    rutaApi: ruta((id) => `/programas/${id}`),
    cuerpo: (f) => armar({ versionEsperada: versionDe(f), objetivo: obligatorio(f, 'objetivo', 500), normas: normasDe(f) }),
    exito: 'programa_guardado',
    volverA: aPrograma,
  },
  programa_aprobar: {
    conId: true,
    metodoApi: 'POST',
    rutaApi: ruta((id) => `/programas/${id}/aprobacion`),
    cuerpo: (f) => armar({ versionEsperada: versionDe(f) }),
    exito: 'programa_aprobado',
    volverA: aPrograma,
  },
  exclusion_agregar: {
    conId: true,
    metodoApi: 'POST',
    rutaApi: ruta((id) => `/programas/${id}/exclusiones`),
    cuerpo: (f) => {
      const tipo = de(f, 'tipo', ['proceso', 'capitulo'] as const);
      const motivo = obligatorio(f, 'motivo', 300);
      if (tipo === 'proceso') return armar({ tipo, procesoId: uuidDe(f, 'procesoId'), motivo });
      const par = parCapitulo(opcional(f, 'capitulo') ?? '');
      return tipo === 'capitulo' && par ? armar({ tipo, libreriaCodigo: par.libreriaCodigo, capitulo: par.capitulo, motivo }) : null;
    },
    exito: 'programa_motivo_guardado',
    volverA: aPrograma,
  },
  exclusion_quitar: {
    conId: true,
    metodoApi: 'POST',
    rutaApi: ruta((id) => `/programas/${id}/exclusiones/eliminacion`),
    cuerpo: (f) => armar({ exclusionId: uuidDe(f, 'exclusionId') }),
    exito: 'programa_motivo_quitado',
    volverA: aPrograma,
  },
};

const alcanceDe = (f: FormData): Record<string, unknown> | null =>
  armar({ normas: normasDe(f), procesosIds: procesosDe(f), capitulos: capitulosDe(f) });
const fusionar = (a: Cuerpo, b: Cuerpo): Cuerpo => (a && b && a !== SIN_CUERPO && b !== SIN_CUERPO ? { ...a, ...b } : null);

/** Planificar una auditoría, su equipo y sus estados. */
const auditorias: Record<string, Accion> = {
  auditoria_crear: {
    conId: true, // el identificador es el del programa
    metodoApi: 'POST',
    rutaApi: ruta((id) => `/programas/${id}/auditorias`),
    cuerpo: (f) =>
      fusionar(
        armar({
          objetivo: obligatorio(f, 'objetivo', 500),
          inicio: fechaDe(f, 'inicio'),
          fin: fechaDe(f, 'fin'),
          reunionApertura: fechaOpcional(f, 'reunionApertura'),
          reunionCierre: fechaOpcional(f, 'reunionCierre'),
          motivo: deOpcional(f, 'motivo', MOTIVOS_CAMBIO),
          nota: acotado(f, 'nota', 300),
        }),
        alcanceDe(f),
      ),
    exito: 'auditoria_planificada',
    volverA: aPrograma,
  },
  auditoria_cambiar: {
    conId: true,
    metodoApi: 'PUT',
    rutaApi: ruta((id) => `/auditorias/${id}`),
    cuerpo: (f) =>
      fusionar(
        armar({
          versionEsperada: versionDe(f),
          objetivo: obligatorio(f, 'objetivo', 500),
          inicio: fechaDe(f, 'inicio'),
          fin: fechaDe(f, 'fin'),
          // Vacío quita la fecha de la reunión; una fecha mal formada no es válida.
          reunionApertura: fechaONula(f, 'reunionApertura'),
          reunionCierre: fechaONula(f, 'reunionCierre'),
        }),
        alcanceDe(f),
      ),
    exito: 'auditoria_guardada',
    volverA: aAuditoria,
  },
  auditoria_reprogramar: {
    conId: true,
    metodoApi: 'POST',
    rutaApi: ruta((id) => `/auditorias/${id}/reprogramacion`),
    cuerpo: (f) =>
      armar({
        versionEsperada: versionDe(f),
        inicio: fechaDe(f, 'inicio'),
        fin: fechaDe(f, 'fin'),
        reunionApertura: fechaOpcional(f, 'reunionApertura'),
        reunionCierre: fechaOpcional(f, 'reunionCierre'),
        motivo: de(f, 'motivo', MOTIVOS_CAMBIO),
        nota: acotado(f, 'nota', 300),
      }),
    exito: 'auditoria_reprogramada',
    volverA: aAuditoria,
  },
  auditoria_cancelar: {
    conId: true,
    metodoApi: 'POST',
    rutaApi: ruta((id) => `/auditorias/${id}/cancelacion`),
    cuerpo: (f) => armar({ versionEsperada: versionDe(f), motivo: de(f, 'motivo', MOTIVOS_CAMBIO), nota: acotado(f, 'nota', 300) }),
    exito: 'auditoria_cancelada',
    volverA: aAuditoria,
  },
  auditoria_avanzar: {
    conId: true,
    metodoApi: 'POST',
    rutaApi: ruta((id) => `/auditorias/${id}/avance`),
    cuerpo: (f) => armar({ versionEsperada: versionDe(f), estado: de(f, 'estado', ['en_preparacion', 'en_ejecucion'] as const) }),
    exito: 'auditoria_avanzada',
    volverA: aAuditoria,
  },
  equipo_designar: {
    conId: true,
    metodoApi: 'POST',
    rutaApi: ruta((id) => `/auditorias/${id}/equipo`),
    cuerpo: (f) => {
      const motivo = acotado(f, 'excepcionMotivo', 300);
      const medida = acotado(f, 'excepcionMedida', 300);
      // La excepción exige motivo Y medida compensatoria: una sola de las dos no es válida.
      const excepcion = motivo === undefined && medida === undefined ? undefined : motivo && medida ? { motivo, medida } : null;
      return armar({ personaId: uuidDe(f, 'personaId'), rol: de(f, 'rol', ROLES_EQUIPO), excepcion });
    },
    exito: 'equipo_designado',
    volverA: aAuditoria,
  },
  equipo_quitar: {
    conId: true,
    metodoApi: 'POST',
    rutaApi: ruta((id) => `/auditorias/${id}/equipo/eliminacion`),
    cuerpo: (f) => armar({ personaId: uuidDe(f, 'personaId') }),
    exito: 'equipo_quitado',
    volverA: aAuditoria,
  },
};

/** Lista de verificación, preguntas y hallazgos (con la auditoría en ejecución). */
const ejecucion: Record<string, Accion> = {
  lista_regenerar: {
    conId: true,
    metodoApi: 'POST',
    rutaApi: ruta((id) => `/auditorias/${id}/lista/regeneracion`),
    cuerpo: () => SIN_CUERPO,
    exito: 'lista_regenerada',
    volverA: aEjecucion,
    sinFormulario: true,
  },
  fila_evaluar: {
    conId: true,
    metodoApi: 'PUT',
    rutaApi: ruta((id) => `/auditorias/${id}/lista/resultado`),
    cuerpo: (f) => {
      const resultado = de(
        f,
        'resultado',
        RESULTADOS.filter((r) => r !== 'por_evaluar'),
      );
      return armar({ filaId: uuidDe(f, 'filaId'), versionEsperada: versionDe(f), resultado, nota: acotado(f, 'nota', 500) });
    },
    exito: 'fila_evaluada',
    volverA: aEjecucion,
  },
  pregunta_agregar: {
    conId: true,
    metodoApi: 'POST',
    rutaApi: ruta((id) => `/auditorias/${id}/lista/preguntas`),
    cuerpo: (f) => armar({ filaId: uuidDe(f, 'filaId'), texto: obligatorio(f, 'texto', 300) }),
    exito: 'pregunta_guardada',
    volverA: aEjecucion,
  },
  pregunta_quitar: {
    conId: true,
    metodoApi: 'POST',
    rutaApi: ruta((id) => `/auditorias/${id}/lista/preguntas/eliminacion`),
    cuerpo: (f) => armar({ preguntaId: uuidDe(f, 'preguntaId') }),
    exito: 'pregunta_quitada',
    volverA: aEjecucion,
  },
  hallazgo_registrar: {
    conId: true,
    metodoApi: 'POST',
    rutaApi: ruta((id) => `/auditorias/${id}/hallazgos`),
    cuerpo: (f) => {
      const req = requisitoDe(f);
      return armar({
        tipo: de(f, 'tipo', TIPOS_HALLAZGO),
        itemId: opcional(f, 'itemId') === null ? undefined : uuidDe(f, 'itemId'),
        procesoId: opcional(f, 'procesoId') === null ? undefined : uuidDe(f, 'procesoId'),
        libreriaCodigo: req === null ? null : req?.libreriaCodigo,
        idEstable: req === null ? null : req?.idEstable,
        enunciado: obligatorio(f, 'enunciado', 500),
        evidencia: obligatorio(f, 'evidencia', 1000),
        justificacionGravedad: acotado(f, 'justificacionGravedad', 500),
      });
    },
    exito: 'hallazgo_registrado',
    volverA: aEjecucion,
  },
  hallazgo_cambiar: {
    conId: true,
    metodoApi: 'PUT',
    rutaApi: ruta((id) => `/auditorias/${id}/hallazgos`),
    cuerpo: (f) => {
      const req = requisitoDe(f);
      return armar({
        hallazgoId: uuidDe(f, 'hallazgoId'),
        versionEsperada: versionDe(f),
        tipo: de(f, 'tipo', TIPOS_HALLAZGO),
        procesoId: uuidONulo(f, 'procesoId'),
        libreriaCodigo: req === null ? null : (req?.libreriaCodigo ?? NULO),
        idEstable: req === null ? null : (req?.idEstable ?? NULO),
        enunciado: obligatorio(f, 'enunciado', 500),
        evidencia: obligatorio(f, 'evidencia', 1000),
        justificacionGravedad: textoONulo(f, 'justificacionGravedad', 500),
      });
    },
    exito: 'hallazgo_guardado',
    volverA: aEjecucion,
  },
  hallazgo_anular: {
    conId: true,
    metodoApi: 'POST',
    rutaApi: ruta((id) => `/auditorias/${id}/hallazgos/anulacion`),
    cuerpo: (f) =>
      armar({ hallazgoId: uuidDe(f, 'hallazgoId'), versionEsperada: versionDe(f), motivo: de(f, 'motivo', MOTIVOS_ANULACION) }),
    exito: 'hallazgo_anulado',
    volverA: aEjecucion,
  },
};

/** Informe y cierre. */
const informe: Record<string, Accion> = {
  informe_emitir: {
    conId: true,
    metodoApi: 'POST',
    rutaApi: ruta((id) => `/auditorias/${id}/informe`),
    cuerpo: (f) =>
      armar({
        versionEsperada: versionDe(f),
        conclusion: obligatorio(f, 'conclusion', 1000),
        limitaciones: acotado(f, 'limitaciones', 1000),
      }),
    exito: 'informe_emitido',
    volverA: aInforme,
  },
  auditoria_cerrar: {
    conId: true,
    metodoApi: 'POST',
    rutaApi: ruta((id) => `/auditorias/${id}/cierre`),
    cuerpo: (f) => armar({ versionEsperada: versionDe(f) }),
    exito: 'auditoria_cerrada',
    volverA: aInforme,
  },
};

/** La lista CERRADA de acciones de escritura de la auditoría interna. */
export const ACCIONES_AUDITORIA: Readonly<Record<string, Accion>> = Object.freeze({
  ...procesos,
  ...programas,
  ...auditorias,
  ...ejecucion,
  ...informe,
});
export const NOMBRES_ACCIONES_AUDITORIA = Object.freeze(Object.keys(ACCIONES_AUDITORIA));
export const esAccionAuditoria = (nombre: string): boolean => Object.prototype.hasOwnProperty.call(ACCIONES_AUDITORIA, nombre);

/** Ejecuta una escritura de la lista cerrada; un nombre desconocido responde 404 (no revela nada). */
export const escribirAuditoria = (peticion: Request, entrada: Entrada, accion: string): Promise<Response> => {
  if (!esAccionAuditoria(accion)) return Promise.resolve(new Response(null, { status: 404, headers: SIN_CACHE }));
  const a = ACCIONES_AUDITORIA[accion] as Accion;
  return reenviar(peticion, entrada, {
    pantalla: 'auditoria',
    volverA: a.volverA,
    conId: a.conId,
    metodoApi: a.metodoApi,
    rutaApi: a.rutaApi,
    cuerpo: a.cuerpo,
    exito: a.exito,
    ...(a.sinFormulario ? { sinFormulario: true } : {}),
  });
};

const TIPO_WORD = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
/** Descarga del informe en Word: siempre adjunto, solo del tipo Word y desde la copia congelada (lo decide la API). */
export const descargarInformeAuditoria = (peticion: Request, entrada: Entrada): Promise<Response> =>
  descargar(peticion, entrada, {
    conId: true,
    rutaApi: (id) => `/auditorias/${id}/informe/documento`,
    pantalla: entrada.id ? `auditoria/auditorias/${entrada.id.toLowerCase()}/informe` : 'auditoria',
    tipos: [TIPO_WORD],
    nombreGenerico: 'informe-auditoria.docx',
  });

