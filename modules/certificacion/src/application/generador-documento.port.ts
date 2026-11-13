import type { FilaDeclaracion } from '../domain/declaracion.js';

export const GENERADOR_DOCUMENTO = Symbol('GENERADOR_DOCUMENTO');

/** Tipo del documento Word que entrega el generador. */
export const TIPO_DOCUMENTO_WORD = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

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
}

export interface DocumentoGenerado {
  readonly bytes: Uint8Array;
  /** SHA-256 en minúsculas de `bytes`: es lo que queda fijado en la bitácora al exportar. */
  readonly sha256: string;
}

/** Puerto de salida: escribe el documento Word. La aplicación no conoce la librería concreta (ADR 033). */
export interface GeneradorDocumentoPort {
  generarDeclaracion(documento: DocumentoDeclaracion): Promise<DocumentoGenerado>;
}
