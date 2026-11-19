import { ErrorCertificacion } from './errores.js';
import { fechaValida } from './fechas.js';

// Control documental (ADR 039): reglas puras de documentos y versiones. Sin base de datos, sin archivos y sin reloj propio.

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export const TIPOS_DOCUMENTO = ['politica', 'procedimiento', 'instructivo', 'formato', 'manual', 'externo', 'otro'] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];
export const CLASIFICACIONES = ['publica', 'interna', 'confidencial', 'restringida'] as const;
export type Clasificacion = (typeof CLASIFICACIONES)[number];
export const ESTADOS_VERSION = ['borrador', 'en_revision', 'aprobada', 'obsoleta', 'descartada'] as const;
export type EstadoVersion = (typeof ESTADOS_VERSION)[number];
export const MOTIVOS_DEVOLUCION = ['incompleta', 'incorrecta', 'otro'] as const;
export type MotivoDevolucion = (typeof MOTIVOS_DEVOLUCION)[number];
export const MOTIVOS_REVISION = ['periodica', 'auditoria', 'cambio_de_contexto'] as const;
export type MotivoRevision = (typeof MOTIVOS_REVISION)[number];

export const TITULO_DOCUMENTO_MAX = 120;
export const AREA_DOCUMENTO_MAX = 60;
export const EMISOR_MAX = 120;
export const EDICION_FUENTE_MAX = 60;
export const NOTA_VERSION_MAX = 500;
export const MOTIVO_EXCEPCION_MAX = 300;
export const NOTA_DEVOLUCION_MAX = 300;
export const MOTIVO_RETENCION_MAX = 200;
export const ANIOS_RETENCION_MAX = 100;
/** Avisar con esta antelación (días) que una revisión está por vencer. */
export const DIAS_POR_VENCER = 30;
/** Topes que acotan las respuestas y evitan acumular sin sentido. */
export const DESTINATARIOS_POR_DOCUMENTO_MAX = 500;
export const VINCULOS_POR_DOCUMENTO_MAX = 50;

const PREFIJOS: Readonly<Record<TipoDocumento, string>> = {
  politica: 'POL',
  procedimiento: 'PRO',
  instructivo: 'INS',
  formato: 'FOR',
  manual: 'MAN',
  externo: 'EXT',
  otro: 'OTR',
};

/** «POL-001»: correlativo por empresa y tipo. Nunca se reutiliza (el documento se retira, no se borra). */
export const codigoDeDocumento = (tipo: TipoDocumento, numero: number): string => `${PREFIJOS[tipo]}-${String(numero).padStart(3, '0')}`;

export const esTipoDocumento = (v: unknown): v is TipoDocumento => (TIPOS_DOCUMENTO as readonly unknown[]).includes(v);

const texto = (v: unknown, campo: string, max: number, obligatorio: boolean): string | null => {
  if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '' && !obligatorio)) {
    if (obligatorio) throw new ErrorCertificacion(campo);
    return null;
  }
  if (typeof v !== 'string') throw new ErrorCertificacion(campo);
  const t = v.trim();
  if (t.length < 1 || t.length > max || CONTROL.test(t)) throw new ErrorCertificacion(campo);
  return t;
};

export interface EntradaDocumento {
  readonly tipo?: unknown;
  readonly titulo?: unknown;
  readonly area?: unknown;
  readonly clasificacion?: unknown;
  readonly emisor?: unknown;
  readonly edicionFuente?: unknown;
}

export interface DatosDocumentoValidos {
  readonly tipo: TipoDocumento;
  readonly titulo: string;
  readonly area: string | null;
  readonly clasificacion: Clasificacion;
  readonly emisor: string | null;
  readonly edicionFuente: string | null;
}

/** Valida y normaliza los datos de un documento. Solo el de origen externo lleva emisor y edición de la fuente. */
export const validarDatosDocumento = (e: EntradaDocumento): DatosDocumentoValidos => {
  if (!esTipoDocumento(e.tipo)) throw new ErrorCertificacion('tipo');
  if (!(CLASIFICACIONES as readonly unknown[]).includes(e.clasificacion)) throw new ErrorCertificacion('clasificacion');
  const emisor = texto(e.emisor, 'emisor', EMISOR_MAX, false);
  const edicionFuente = texto(e.edicionFuente, 'edicionFuente', EDICION_FUENTE_MAX, false);
  if (e.tipo !== 'externo' && (emisor !== null || edicionFuente !== null))
    throw new ErrorCertificacion(emisor !== null ? 'emisor' : 'edicionFuente', ['solo_externo']);
  return {
    tipo: e.tipo,
    titulo: texto(e.titulo, 'titulo', TITULO_DOCUMENTO_MAX, true) as string,
    area: texto(e.area, 'area', AREA_DOCUMENTO_MAX, false),
    clasificacion: e.clasificacion as Clasificacion,
    emisor,
    edicionFuente,
  };
};

/** La nota de cambios de una versión es obligatoria (la primera dice «versión inicial»). */
export const validarNotaVersion = (v: unknown): string => texto(v, 'nota', NOTA_VERSION_MAX, true) as string;

export const validarMotivoExcepcion = (v: unknown): string => texto(v, 'motivoExcepcion', MOTIVO_EXCEPCION_MAX, true) as string;

export const validarMotivoRetencion = (v: unknown): string => texto(v, 'motivo', MOTIVO_RETENCION_MAX, true) as string;

export const validarAniosRetencion = (v: unknown): number => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > ANIOS_RETENCION_MAX) throw new ErrorCertificacion('anios');
  return v;
};

// ---- Versiones y su flujo --------------------------------------------------------------------------------------------------------

/** Lo mínimo de una versión que necesitan las reglas del flujo. */
export interface VersionFlujo {
  readonly estado: EstadoVersion;
  readonly autorId: string;
  readonly aprobadorId: string | null;
}

export interface VersionAprobada {
  readonly aprobadaPor: string;
  readonly aprobadaEn: Date;
  /** Aprobó su propio texto (único administrador): queda marcado en el historial. */
  readonly porSuAutor: boolean;
  readonly motivoExcepcion: string | null;
  readonly requiereLectura: boolean;
}

const exigirEstado = (v: VersionFlujo, esperado: EstadoVersion): void => {
  if (v.estado !== esperado) throw new ErrorCertificacion('estado', ['no_permitido_en_este_estado']);
};

/** Un borrador se envía a revisión nombrando quién lo aprueba (debe ser otra persona o, si es el único administrador, él mismo). */
export const enviarARevision = (v: VersionFlujo, aprobadorId: string): { estado: 'en_revision'; aprobadorId: string } => {
  exigirEstado(v, 'borrador');
  return { estado: 'en_revision', aprobadorId };
};

/** El aprobador devuelve la versión a borrador con un motivo de lista cerrada y una nota breve opcional. */
export const devolverABorrador = (
  v: VersionFlujo,
  motivo: unknown,
  nota: unknown,
): { estado: 'borrador'; motivo: MotivoDevolucion; nota: string | null } => {
  exigirEstado(v, 'en_revision');
  if (!(MOTIVOS_DEVOLUCION as readonly unknown[]).includes(motivo)) throw new ErrorCertificacion('motivo');
  return { estado: 'borrador', motivo: motivo as MotivoDevolucion, nota: texto(nota, 'nota', NOTA_DEVOLUCION_MAX, false) };
};

export const descartarBorrador = (v: VersionFlujo): { estado: 'descartada' } => {
  exigirEstado(v, 'borrador');
  return { estado: 'descartada' };
};

export interface EntradaAprobacion {
  readonly aprobadorId: string;
  readonly ahora: Date;
  /** Administradores activos de la empresa (con rol y sin baja): decide si la excepción del único administrador es posible. */
  readonly administradoresActivos: number;
  readonly motivoExcepcion?: unknown;
  readonly requiereLectura?: unknown;
}

/**
 * Aprobar: solo una versión en revisión. El aprobador debe ser el que se nombró al enviarla. **No puede ser el autor**, salvo la
 * excepción registrada: si la empresa tiene UN solo administrador activo, puede aprobar su propia versión con motivo obligatorio.
 */
export const aprobar = (v: VersionFlujo, e: EntradaAprobacion): VersionAprobada => {
  exigirEstado(v, 'en_revision');
  if (v.aprobadorId !== e.aprobadorId) throw new ErrorCertificacion('aprobadorId', ['no_es_el_aprobador']);
  if (e.requiereLectura !== undefined && typeof e.requiereLectura !== 'boolean') throw new ErrorCertificacion('requiereLectura');
  const propia = v.autorId === e.aprobadorId;
  if (propia && e.administradoresActivos > 1) throw new ErrorCertificacion('aprobadorId', ['es_el_autor']);
  if (!propia && e.motivoExcepcion !== undefined && e.motivoExcepcion !== null)
    throw new ErrorCertificacion('motivoExcepcion', ['no_corresponde']);
  const motivoExcepcion = propia ? validarMotivoExcepcion(e.motivoExcepcion) : null;
  return {
    aprobadaPor: e.aprobadorId,
    aprobadaEn: e.ahora,
    porSuAutor: propia,
    motivoExcepcion,
    requiereLectura: e.requiereLectura === true,
  };
};

/** ¿A quién se puede nombrar como aprobador al enviar? A otra persona; a sí mismo solo si es el único administrador. */
export const puedeNombrarseAprobador = (autorId: string, aprobadorId: string, administradoresActivos: number): boolean =>
  autorId !== aprobadorId || administradoresActivos <= 1;

/** Solo la versión aprobada rige. */
export const esVigente = (estado: EstadoVersion): boolean => estado === 'aprobada';

/** Una versión aprobada u obsoleta no se cambia: su archivo, su nota y su historia quedan como estaban. */
export const esInmutable = (estado: EstadoVersion): boolean => estado === 'aprobada' || estado === 'obsoleta';

// ---- Revisión periódica ----------------------------------------------------------------------------------------------------------

const sumarDias = (fecha: string, dias: number): string => {
  const [a, m, d] = fecha.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
};

/** Un año después de la fecha dada (el 29 de febrero pasa al 28). Es el valor por omisión de la próxima revisión. */
export const unAnioDespues = (fecha: string): string => {
  if (!fechaValida(fecha)) throw new ErrorCertificacion('fecha');
  const [a, m, d] = fecha.split('-').map(Number) as [number, number, number];
  const f = new Date(Date.UTC(a + 1, m - 1, d));
  if (f.getUTCMonth() !== m - 1) f.setUTCDate(0); // 29 de febrero → 28
  return f.toISOString().slice(0, 10);
};

export type EstadoRevision = 'vencida' | 'por_vencer' | 'al_dia';

/** `null` si el documento no tiene versión vigente (no hay nada que revisar). */
export const estadoDeRevision = (proximaRevision: string | null, hoy: string): EstadoRevision | null => {
  if (proximaRevision === null) return null;
  if (proximaRevision < hoy) return 'vencida';
  return proximaRevision <= sumarDias(hoy, DIAS_POR_VENCER) ? 'por_vencer' : 'al_dia';
};

export const validarFechaRevision = (v: unknown, hoy: string): string => {
  if (!fechaValida(v)) throw new ErrorCertificacion('proximaRevision');
  if (v < hoy) throw new ErrorCertificacion('proximaRevision', ['en_el_pasado']);
  return v;
};

export const validarMotivoRevision = (v: unknown): MotivoRevision | null => {
  if (v === undefined || v === null) return null;
  if (!(MOTIVOS_REVISION as readonly unknown[]).includes(v)) throw new ErrorCertificacion('motivo');
  return v as MotivoRevision;
};

// ---- Retención -------------------------------------------------------------------------------------------------------------------

/**
 * Una versión obsoleta es «elegible para disposición» cuando pasaron los años de retención de su tipo desde que quedó obsoleta.
 * Sin retención definida nunca lo es (se muestra «retención no definida»). Esto solo MARCA: el sistema no borra nada (ADR 039).
 */
export const elegibleParaDisposicion = (
  v: { estado: EstadoVersion; obsoletaEn: Date | null },
  aniosRetencion: number | null,
  hoy: string,
): boolean => {
  if (v.estado !== 'obsoleta' || v.obsoletaEn === null || aniosRetencion === null) return false;
  const desde = v.obsoletaEn.toISOString().slice(0, 10);
  let limite = desde;
  for (let i = 0; i < aniosRetencion; i += 1) limite = unAnioDespues(limite);
  return limite <= hoy;
};

// ---- Lecturas --------------------------------------------------------------------------------------------------------------------

export interface LecturaResumen {
  readonly usuarioId: string;
  readonly confirmada: boolean;
}

/** «12 de 15»: solo cuentan los destinatarios que siguen pertenciendo a la empresa. */
export const resumenDeLecturas = (
  lecturas: readonly LecturaResumen[],
  activos: ReadonlySet<string>,
): { confirmadas: number; total: number } => {
  const vigentes = lecturas.filter((l) => activos.has(l.usuarioId));
  return { confirmadas: vigentes.filter((l) => l.confirmada).length, total: vigentes.length };
};
