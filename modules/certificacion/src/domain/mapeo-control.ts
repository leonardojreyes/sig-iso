import type { EmpresaId } from '@sig/tenancy';
import { ErrorCertificacion } from './errores.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODIGO_LIBRERIA = /^[a-z0-9][a-z0-9-]{0,63}$/;
const ID_ESTABLE = /^[a-z0-9][a-z0-9.-]{0,40}$/;

export interface DatosMapeoControl {
  readonly empresaId: EmpresaId;
  readonly controlId: string;
  readonly libreriaCodigo: string;
  readonly idEstable: string;
}

/**
 * Relación entre un control de la empresa y UNA entrada de una norma (cláusula o control del Anexo A). La entrada se identifica
 * como en la evaluación: código de librería + id estable, sin atarse a una versión de la librería.
 */
export class MapeoControl {
  private constructor(
    readonly empresaId: EmpresaId,
    readonly controlId: string,
    readonly libreriaCodigo: string,
    readonly idEstable: string,
  ) {
    Object.freeze(this);
  }

  static crear(d: DatosMapeoControl): MapeoControl {
    if (typeof d.controlId !== 'string' || !UUID.test(d.controlId)) throw new ErrorCertificacion('controlId');
    if (typeof d.libreriaCodigo !== 'string' || !CODIGO_LIBRERIA.test(d.libreriaCodigo)) throw new ErrorCertificacion('libreriaCodigo');
    if (typeof d.idEstable !== 'string' || !ID_ESTABLE.test(d.idEstable)) throw new ErrorCertificacion('idEstable');
    return new MapeoControl(d.empresaId, d.controlId.toLowerCase(), d.libreriaCodigo, d.idEstable);
  }

  /** Clave de la entrada, la misma que usa la evaluación. */
  get claveEntrada(): string {
    return `${this.libreriaCodigo}|${this.idEstable}`;
  }

  /** Identifica el mapeo completo (control + entrada): sirve para detectar duplicados. */
  get clave(): string {
    return `${this.controlId}|${this.claveEntrada}`;
  }
}
