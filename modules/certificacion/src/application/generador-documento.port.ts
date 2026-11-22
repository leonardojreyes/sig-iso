import type { FilaDeclaracion } from '../domain/declaracion.js';
import type { InformeContenido } from './informe.use-cases.js';
import type { CopiaJustificacion, EscalaCongelada } from './repositorios.port.js';

export const GENERADOR_DOCUMENTO = Symbol('GENERADOR_DOCUMENTO');

/** Tipo del documento Word que entrega el generador. */
export const TIPO_DOCUMENTO_WORD = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Lo que justifica la Declaración (ADR 037): motivos con su nota, riesgos, qué riesgos justifican cada fila, referencias al tratamiento y
 * la escala del nivel. Es la copia congelada de una versión aprobada o, en el borrador, lo derivado hoy.
 */
export interface JustificacionDocumento extends CopiaJustificacion {
  readonly escala: EscalaCongelada;
  /** Controles que aplican y tienen motivo / no lo tienen (siempre 0 en una versión aprobada). */
  readonly conMotivo: number;
  readonly sinMotivo: number;
}

/** Todo lo que lleva el documento: datos propios de la empresa, nunca texto de la norma. */
export interface DocumentoDeclaracion {
  readonly norma: string;
  /** Verdadero mientras no esté aprobada: el documento lleva el rótulo de preliminar. */
  readonly preliminar: boolean;
  /** Número de la versión aprobada, o nulo en el borrador. */
  readonly version: number | null;
  /** AAAA-MM-DD (Ecuador) de la aprobación, o nulo en el borrador. */
  readonly aprobadaEl: string | null;
  /** AAAA-MM-DD (Ecuador) en que se generó el documento. */
  readonly generadaEl: string;
  readonly alcance: string | null;
  readonly resumen: { readonly total: number; readonly aplican: number; readonly noAplican: number; readonly porDecidir: number; readonly sinControl: number };
  readonly filas: readonly FilaDeclaracion[];
  /** Nula en una versión aprobada antes de la Declaración justificada: el documento lo dice y no muestra motivos ni riesgos. */
  readonly justificacion: JustificacionDocumento | null;
}

/** El informe de una auditoría interna: SIEMPRE desde su copia congelada (ADR 040), nunca desde los datos de hoy. */
export interface DocumentoInformeAuditoria {
  readonly contenido: InformeContenido;
  /** SHA-256 de la copia congelada, tal como quedó al emitir el informe. */
  readonly huella: string;
  /** AAAA-MM-DD (Ecuador) en que se generó el documento. */
  readonly generadaEl: string;
}

export interface DocumentoGenerado {
  readonly bytes: Uint8Array;
  /** SHA-256 en minúsculas de `bytes`: es lo que queda fijado en la bitácora al exportar. */
  readonly sha256: string;
}

/** Puerto de salida: escribe el documento Word. La aplicación no conoce la librería concreta (ADR 033). */
export interface GeneradorDocumentoPort {
  generarDeclaracion(documento: DocumentoDeclaracion): Promise<DocumentoGenerado>;
  generarInformeAuditoria(documento: DocumentoInformeAuditoria): Promise<DocumentoGenerado>;
}
