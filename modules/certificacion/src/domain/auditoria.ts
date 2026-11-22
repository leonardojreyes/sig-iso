import { ErrorCertificacion } from './errores.js';
import { fechaValida } from './fechas.js';

// Auditoría interna (ADR 040): estados, transiciones y fechas del programa y de la auditoría. Reglas puras: sin base de datos y sin
// reloj propio (la fecha de «hoy» llega ya en hora de Ecuador).

export const ESTADOS_AUDITORIA = ['planificada', 'en_preparacion', 'en_ejecucion', 'informe_emitido', 'cerrada', 'cancelada'] as const;
export type EstadoAuditoria = (typeof ESTADOS_AUDITORIA)[number];
export const ESTADOS_PROGRAMA = ['sin_aprobar', 'aprobado'] as const;
export type EstadoPrograma = (typeof ESTADOS_PROGRAMA)[number];
/** Motivos cerrados (con una nota breve) para cancelar, reprogramar o cambiar un programa aprobado. */
export const MOTIVOS_CAMBIO_AUDITORIA = ['sin_recursos', 'cambio_de_alcance', 'reprogramada', 'otro'] as const;
export type MotivoCambioAuditoria = (typeof MOTIVOS_CAMBIO_AUDITORIA)[number];

export const OBJETIVO_AUDITORIA_MAX = 500;
export const NOTA_CAMBIO_MAX = 300;
export const ANIO_MIN = 2000;
export const ANIO_MAX = 2100;

/** Solo avanzan: planificada → en preparación → en ejecución → informe emitido → cerrada. Cancelar se puede hasta estar en ejecución. */
const SIGUIENTE: Readonly<Record<EstadoAuditoria, readonly EstadoAuditoria[]>> = {
  planificada: ['en_preparacion', 'cancelada'],
  en_preparacion: ['en_ejecucion', 'cancelada'],
  en_ejecucion: ['informe_emitido', 'cancelada'],
  informe_emitido: ['cerrada'],
  cerrada: [],
  cancelada: [],
};

export const esEstadoAuditoria = (v: unknown): v is EstadoAuditoria => (ESTADOS_AUDITORIA as readonly unknown[]).includes(v);
export const puedeTransitar = (desde: EstadoAuditoria, hasta: EstadoAuditoria): boolean => SIGUIENTE[desde].includes(hasta);

/** Informe emitido, cerrada y cancelada no se modifican (una cancelada no se reabre; un error se corrige con una complementaria). */
export const esAuditoriaInmutable = (estado: EstadoAuditoria): boolean =>
  estado === 'informe_emitido' || estado === 'cerrada' || estado === 'cancelada';
/** Mientras no avanza a «en ejecución» se pueden cambiar criterios, alcance y equipo. */
export const admiteCambioDeAlcance = (estado: EstadoAuditoria): boolean => estado === 'planificada' || estado === 'en_preparacion';
/** Solo en ejecución se evalúan filas y se registran o anulan hallazgos. */
export const admiteEjecucion = (estado: EstadoAuditoria): boolean => estado === 'en_ejecucion';
/** Cuenta para la cobertura y el prerrequisito de la Etapa 2: solo las cerradas (con informe). */
export const cuentaParaCobertura = (estado: EstadoAuditoria): boolean => estado === 'cerrada';

/** «AI-2027-01»: correlativo por empresa y año. Nunca se reutiliza (una auditoría se cancela, no se borra). */
export const codigoDeAuditoria = (anio: number, numero: number): string => `AI-${anio}-${String(numero).padStart(2, '0')}`;

export const validarAnio = (anio: unknown): number => {
  if (typeof anio !== 'number' || !Number.isInteger(anio) || anio < ANIO_MIN || anio > ANIO_MAX)
    throw new ErrorCertificacion('anio', ['año no válido']);
  return anio;
};

export const validarFechas = (inicio: unknown, fin: unknown): { inicio: string; fin: string } => {
  if (!fechaValida(inicio)) throw new ErrorCertificacion('inicio', ['fecha no válida']);
  if (!fechaValida(fin)) throw new ErrorCertificacion('fin', ['fecha no válida']);
  if (fin < inicio) throw new ErrorCertificacion('fin', ['no puede ser anterior al inicio']);
  return { inicio, fin };
};

export const validarObjetivo = (v: unknown): string => {
  if (typeof v !== 'string' || v.trim() === '') throw new ErrorCertificacion('objetivo', ['obligatorio']);
  const t = v.trim();
  if (t.length > OBJETIVO_AUDITORIA_MAX) throw new ErrorCertificacion('objetivo', [`máximo ${OBJETIVO_AUDITORIA_MAX} caracteres`]);
  return t;
};

/** Motivo cerrado y nota breve (opcional salvo «otro»). La nota es texto de la empresa y NO va a la bitácora. */
export const validarMotivoCambio = (motivo: unknown, nota: unknown): { motivo: MotivoCambioAuditoria; nota: string | null } => {
  if (!(MOTIVOS_CAMBIO_AUDITORIA as readonly unknown[]).includes(motivo)) throw new ErrorCertificacion('motivo', ['motivo no válido']);
  const texto = typeof nota === 'string' && nota.trim() !== '' ? nota.trim() : null;
  if (nota !== undefined && nota !== null && typeof nota !== 'string') throw new ErrorCertificacion('nota', ['debe ser texto']);
  if (texto !== null && texto.length > NOTA_CAMBIO_MAX) throw new ErrorCertificacion('nota', [`máximo ${NOTA_CAMBIO_MAX} caracteres`]);
  if (motivo === 'otro' && texto === null) throw new ErrorCertificacion('nota', ['obligatoria con el motivo «otro»']);
  return { motivo: motivo as MotivoCambioAuditoria, nota: texto };
};

export interface DatosParaTransicion {
  readonly desde: EstadoAuditoria;
  readonly hasta: EstadoAuditoria;
  /** Hoy en Ecuador (`AAAA-MM-DD`). */
  readonly hoy: string;
  readonly inicio: string;
  readonly reunionApertura: string | null;
  readonly reunionCierre: string | null;
}

/**
 * Comprueba una transición de estado y devuelve el primer motivo por el que no procede (o null si procede):
 * solo avanza; «en ejecución» exige haber llegado la fecha de inicio y la fecha de la reunión de apertura; «informe emitido» exige la
 * fecha de la reunión de cierre; cerrar no antes de la fecha de inicio. Cancelar no pide nada más (el motivo lo valida el caso de uso).
 */
export const motivoDeBloqueoDeTransicion = (d: DatosParaTransicion): string | null => {
  if (!fechaValida(d.hoy)) throw new ErrorCertificacion('hoy', ['fecha no válida']);
  if (!puedeTransitar(d.desde, d.hasta))
    return d.desde === 'cancelada' ? 'una auditoría cancelada no se reabre' : 'transición no permitida';
  if (d.hasta === 'en_ejecucion') {
    if (d.hoy < d.inicio) return 'aún no llega la fecha de inicio';
    if (d.reunionApertura === null) return 'falta la fecha de la reunión de apertura';
  }
  if (d.hasta === 'informe_emitido' && d.reunionCierre === null) return 'falta la fecha de la reunión de cierre';
  if (d.hasta === 'cerrada' && d.hoy < d.inicio) return 'no se cierra antes de la fecha de inicio';
  return null;
};

/** Un programa aprobado vuelve a «sin aprobar» si cambia su objetivo o sus normas; agregar o reprogramar auditorías exige motivo aparte. */
export const estadoTrasCambioDePrograma = (actual: EstadoPrograma, cambioObjetivoONormas: boolean): EstadoPrograma =>
  actual === 'aprobado' && cambioObjetivoONormas ? 'sin_aprobar' : actual;

/** La auditoría es combinada cuando los criterios abarcan más de una norma. */
export const esCombinada = (normas: readonly string[]): boolean => new Set(normas).size > 1;

/** Trimestre (1 a 4) de una fecha `AAAA-MM-DD`, para la línea de tiempo del programa. */
export const trimestreDe = (fecha: string): 1 | 2 | 3 | 4 => {
  if (!fechaValida(fecha)) throw new ErrorCertificacion('fecha', ['fecha no válida']);
  return (Math.floor((Number(fecha.slice(5, 7)) - 1) / 3) + 1) as 1 | 2 | 3 | 4;
};
