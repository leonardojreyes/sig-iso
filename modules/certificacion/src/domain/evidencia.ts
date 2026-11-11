import type { EmpresaId } from '@sig/tenancy';
import { ErrorCertificacion } from './errores.js';
import { fechaValida } from './fechas.js';
import { esTipoArchivo, normalizarNombreArchivo, TAMANO_MAX_BYTES, type TipoArchivo } from './tipo-archivo.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
export const TITULO_EVIDENCIA_MAX = 120;
/** Tope de evidencias activas por control: acota la respuesta y evita acumular archivos sin sentido. */
export const EVIDENCIAS_ACTIVAS_POR_CONTROL_MAX = 100;

export const TIPOS_EVIDENCIA = ['documento', 'registro'] as const;
export type TipoEvidencia = (typeof TIPOS_EVIDENCIA)[number];
export const ESTADOS_EVIDENCIA = ['activa', 'reemplazada', 'eliminada'] as const;
export type EstadoEvidencia = (typeof ESTADOS_EVIDENCIA)[number];

/** El archivo ya guardado: su nombre en el almacén (UUID del servidor), su etiqueta, el tipo DETECTADO, su tamaño y su huella. */
export interface ArchivoEvidencia {
  readonly id: string;
  readonly nombre: string;
  readonly tipo: TipoArchivo;
  readonly bytes: number;
  readonly sha256: string;
}

export interface DatosEvidencia {
  readonly id: string;
  readonly empresaId: EmpresaId;
  readonly controlId: string;
  readonly tipo: TipoEvidencia;
  readonly titulo: string;
  /** AAAA-MM-DD: el día en que ocurrió lo que la evidencia demuestra. */
  readonly fechaHecho: string;
  /** AAAA-MM-DD, opcional: hasta cuándo sigue siendo válida. */
  readonly vigenteHasta?: string | null;
  readonly estado?: EstadoEvidencia;
  /** La evidencia a la que reemplaza, si la reemplaza. */
  readonly reemplazaId?: string | null;
  readonly archivo: ArchivoEvidencia;
}

const uuid = (v: unknown, campo: string): string => {
  if (typeof v !== 'string' || !UUID.test(v)) throw new ErrorCertificacion(campo);
  return v.toLowerCase();
};

/**
 * Evidencia de un control de la empresa: un archivo que demuestra que opera. Es **inmutable**: lo único que cambia es su estado
 * (`activa` → `reemplazada` o `eliminada`). Reemplazar crea una evidencia nueva; el archivo físico no se borra nunca (ADR 032).
 */
export class Evidencia {
  private constructor(
    readonly id: string,
    readonly empresaId: EmpresaId,
    readonly controlId: string,
    readonly tipo: TipoEvidencia,
    readonly titulo: string,
    readonly fechaHecho: string,
    readonly vigenteHasta: string | null,
    readonly estado: EstadoEvidencia,
    readonly reemplazaId: string | null,
    readonly archivo: ArchivoEvidencia,
  ) {
    Object.freeze(this);
  }

  static crear(d: DatosEvidencia): Evidencia {
    const id = uuid(d.id, 'id');
    const controlId = uuid(d.controlId, 'controlId');
    if (!(TIPOS_EVIDENCIA as readonly unknown[]).includes(d.tipo)) throw new ErrorCertificacion('tipo');
    if (typeof d.titulo !== 'string') throw new ErrorCertificacion('titulo');
    const titulo = d.titulo.trim();
    if (titulo.length < 1 || titulo.length > TITULO_EVIDENCIA_MAX || CONTROL.test(titulo)) throw new ErrorCertificacion('titulo');
    if (!fechaValida(d.fechaHecho)) throw new ErrorCertificacion('fechaHecho');
    let vigenteHasta: string | null = null;
    if (d.vigenteHasta !== undefined && d.vigenteHasta !== null) {
      if (!fechaValida(d.vigenteHasta)) throw new ErrorCertificacion('vigenteHasta');
      if (d.vigenteHasta < d.fechaHecho) throw new ErrorCertificacion('vigenteHasta', ['anterior_al_hecho']);
      vigenteHasta = d.vigenteHasta;
    }
    const estado = d.estado ?? 'activa';
    if (!(ESTADOS_EVIDENCIA as readonly unknown[]).includes(estado)) throw new ErrorCertificacion('estado');
    let reemplazaId: string | null = null;
    if (d.reemplazaId !== undefined && d.reemplazaId !== null) {
      reemplazaId = uuid(d.reemplazaId, 'reemplazaId');
      if (reemplazaId === id) throw new ErrorCertificacion('reemplazaId');
    }
    const a = d.archivo;
    if (typeof a !== 'object' || a === null) throw new ErrorCertificacion('archivo');
    if (!esTipoArchivo(a.tipo)) throw new ErrorCertificacion('archivo.tipo');
    if (!Number.isInteger(a.bytes) || a.bytes < 1 || a.bytes > TAMANO_MAX_BYTES) throw new ErrorCertificacion('archivo.bytes');
    if (typeof a.sha256 !== 'string' || !SHA256.test(a.sha256)) throw new ErrorCertificacion('archivo.sha256');
    if (typeof a.nombre !== 'string' || a.nombre !== normalizarNombreArchivo(a.nombre)) throw new ErrorCertificacion('archivo.nombre');
    const archivo: ArchivoEvidencia = { id: uuid(a.id, 'archivo.id'), nombre: a.nombre, tipo: a.tipo, bytes: a.bytes, sha256: a.sha256 };
    return new Evidencia(id, d.empresaId, controlId, d.tipo, titulo, d.fechaHecho, vigenteHasta, estado, reemplazaId, Object.freeze(archivo));
  }

  get activa(): boolean {
    return this.estado === 'activa';
  }

  /** Vigente hoy: activa y sin vigencia o con vigencia que llega a `hoy` (AAAA-MM-DD, fecha de Ecuador). */
  vigenteEn(hoy: string): boolean {
    return this.activa && (this.vigenteHasta === null || this.vigenteHasta >= hoy);
  }

  /** Activa pero con la vigencia ya pasada. */
  vencidaEn(hoy: string): boolean {
    return this.activa && this.vigenteHasta !== null && this.vigenteHasta < hoy;
  }

  /** Solo una evidencia activa se puede reemplazar o eliminar. */
  private exigirActiva(): void {
    if (!this.activa) throw new ErrorCertificacion('evidencia', ['no_activa']);
  }

  marcarReemplazada(): Evidencia {
    this.exigirActiva();
    return this.conEstado('reemplazada');
  }

  marcarEliminada(): Evidencia {
    this.exigirActiva();
    return this.conEstado('eliminada');
  }

  private conEstado(estado: EstadoEvidencia): Evidencia {
    return new Evidencia(this.id, this.empresaId, this.controlId, this.tipo, this.titulo, this.fechaHecho, this.vigenteHasta, estado, this.reemplazaId, this.archivo);
  }
}
