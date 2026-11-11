import type { EmpresaId } from '@sig/tenancy';
import { ErrorCertificacion } from './errores.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODIGO = /^[A-Za-z0-9][A-Za-z0-9._-]{0,19}$/;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
export const NOMBRE_CONTROL_MAX = 120;
export const DESCRIPCION_CONTROL_MAX = 1000;
/** Tope de entradas de normas a las que responde un mismo control (acota la respuesta y evita mapeos de relleno). */
export const MAPEOS_POR_CONTROL_MAX = 50;

export type EstadoControl = 'vigente' | 'retirado';

export interface DatosControl {
  readonly id: string;
  readonly empresaId: EmpresaId;
  /** Código corto propio de la empresa (único por empresa); no se reutiliza al retirar. */
  readonly codigo: string;
  readonly nombre: string;
  readonly descripcion?: string | null;
  readonly responsableId?: string | null;
  readonly estado?: EstadoControl;
  readonly version?: number;
}

export interface CambiosControl {
  /** Ausente = se conserva. */
  readonly nombre?: string;
  /** Ausente = se conserva; `null` o vacío = se quita. */
  readonly descripcion?: string | null;
  /** Ausente = se conserva; `null` = se quita. */
  readonly responsableId?: string | null;
}

const texto = (v: unknown, campo: string, max: number, obligatorio: boolean): string | null => {
  if (v === undefined || v === null) {
    if (obligatorio) throw new ErrorCertificacion(campo);
    return null;
  }
  if (typeof v !== 'string') throw new ErrorCertificacion(campo);
  const t = v.trim();
  if (t.length > max || CONTROL.test(t) || (obligatorio && t.length === 0)) throw new ErrorCertificacion(campo);
  return t.length === 0 ? null : t;
};

const persona = (v: unknown): string | null => {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string' || !UUID.test(v)) throw new ErrorCertificacion('responsableId');
  return v.toLowerCase();
};

/**
 * Control de la empresa: una medida PROPIA de la organización (no un control del Anexo A) que puede responder a varias entradas de
 * una o varias normas (los mapeos). No se borra: se retira, y un control retirado ya no se cambia ni recibe mapeos.
 */
export class Control {
  private constructor(
    readonly id: string,
    readonly empresaId: EmpresaId,
    readonly codigo: string,
    readonly nombre: string,
    readonly descripcion: string | null,
    readonly responsableId: string | null,
    readonly estado: EstadoControl,
    readonly version: number,
  ) {
    Object.freeze(this);
  }

  static crear(d: DatosControl): Control {
    if (typeof d.id !== 'string' || !UUID.test(d.id)) throw new ErrorCertificacion('id');
    if (typeof d.codigo !== 'string' || !CODIGO.test(d.codigo)) throw new ErrorCertificacion('codigo');
    const nombre = texto(d.nombre, 'nombre', NOMBRE_CONTROL_MAX, true) as string;
    const descripcion = texto(d.descripcion, 'descripcion', DESCRIPCION_CONTROL_MAX, false);
    const estado = d.estado ?? 'vigente';
    if (estado !== 'vigente' && estado !== 'retirado') throw new ErrorCertificacion('estado');
    const version = d.version ?? 1;
    if (!Number.isInteger(version) || version < 1) throw new ErrorCertificacion('version');
    return new Control(d.id.toLowerCase(), d.empresaId, d.codigo, nombre, descripcion, persona(d.responsableId), estado, version);
  }

  get vigente(): boolean {
    return this.estado === 'vigente';
  }

  /** Control con los cambios aplicados y la versión siguiente; el mismo control si nada cambia. */
  conCambios(c: CambiosControl): Control {
    if (!this.vigente) throw new ErrorCertificacion('control', ['retirado']);
    const nombre = c.nombre === undefined ? this.nombre : (texto(c.nombre, 'nombre', NOMBRE_CONTROL_MAX, true) as string);
    const descripcion = c.descripcion === undefined ? this.descripcion : texto(c.descripcion, 'descripcion', DESCRIPCION_CONTROL_MAX, false);
    const responsableId = c.responsableId === undefined ? this.responsableId : persona(c.responsableId);
    if (nombre === this.nombre && descripcion === this.descripcion && responsableId === this.responsableId) return this;
    return new Control(this.id, this.empresaId, this.codigo, nombre, descripcion, responsableId, this.estado, this.version + 1);
  }

  retirar(): Control {
    if (!this.vigente) throw new ErrorCertificacion('control', ['ya_retirado']);
    return new Control(this.id, this.empresaId, this.codigo, this.nombre, this.descripcion, this.responsableId, 'retirado', this.version + 1);
  }

  /** Comprueba que se puede agregar un mapeo más (control vigente y bajo el tope). */
  validarNuevoMapeo(mapeosActuales: number): void {
    if (!this.vigente) throw new ErrorCertificacion('control', ['retirado']);
    if (mapeosActuales >= MAPEOS_POR_CONTROL_MAX) throw new ErrorCertificacion('mapeos', ['tope_de_mapeos']);
  }
}
