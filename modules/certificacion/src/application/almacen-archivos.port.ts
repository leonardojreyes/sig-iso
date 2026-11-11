import type { EmpresaId } from '@sig/tenancy';
import type { LectorBytes } from '../domain/deteccion-archivo.js';

export const ALMACEN_ARCHIVOS = Symbol('ALMACEN_ARCHIVOS');

/** Archivo recién recibido y todavía provisional: su huella y su tamaño ya están calculados. */
export interface ArchivoTemporal {
  /** Identificador del temporal (UUID del servidor), válido solo para la empresa que lo recibió. */
  readonly id: string;
  readonly bytes: number;
  /** SHA-256 en hexadecimal minúsculas, calculado mientras se recibía. */
  readonly sha256: string;
}

export type ResultadoGuardado = { readonly ok: true; readonly temporal: ArchivoTemporal } | { readonly ok: false; readonly motivo: 'tamano_excedido' };

/**
 * Puerto de salida: dónde viven los archivos de las evidencias (ADR 032). Todo está acotado a la EMPRESA que se indica (la del
 * token): un archivo de una empresa no se puede abrir, confirmar ni descartar desde otra. El adaptador local usa una carpeta del
 * sistema de archivos; el de S3 lo sustituirá sin cambiar este puerto.
 */
export interface AlmacenArchivosPort {
  /**
   * Recibe el flujo en un archivo temporal de la empresa, calculando el SHA-256 y contando los bytes. Si pasa de `maximoBytes`
   * corta, borra lo recibido y responde `tamano_excedido`. Si el flujo falla, borra lo recibido y propaga el error.
   */
  guardarTemporal(empresaId: EmpresaId, flujo: AsyncIterable<Uint8Array>, maximoBytes: number): Promise<ResultadoGuardado>;
  /** Lector de bytes sobre un temporal, para decidir su tipo por el contenido. */
  abrirLector(empresaId: EmpresaId, temporalId: string): Promise<LectorBytes>;
  /** Convierte el temporal en el archivo definitivo `archivoId`. No pisa uno que ya exista. */
  confirmar(empresaId: EmpresaId, temporalId: string, archivoId: string): Promise<void>;
  /** Borra un temporal. No falla si ya no existe. */
  descartar(empresaId: EmpresaId, temporalId: string): Promise<void>;
  /** Flujo de lectura del archivo definitivo de ESA empresa. Falla si no existe. */
  abrir(empresaId: EmpresaId, archivoId: string): Promise<AsyncIterable<Uint8Array>>;
}
