import type { EmpresaId } from '@sig/tenancy';
import { ErrorCertificacion } from './errores.js';
import { esEstadoEvaluacion, type EstadoEvaluacion } from './estado-evaluacion.js';

const CODIGO = /^[a-z0-9][a-z0-9-]{0,63}$/;
const ID_ESTABLE = /^[a-z0-9][a-z0-9.-]{0,40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
export const COMENTARIO_MAX = 1000;
/** Marcar «no aplica» exige una justificación; esto evita un comentario de relleno. */
export const JUSTIFICACION_MIN = 5;

export interface DatosEvaluacion {
  readonly empresaId: EmpresaId;
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  /** Versión de la librería con la que se evaluó (se fija al evaluar). */
  readonly libreriaId: string;
  readonly estado: EstadoEvaluacion;
  readonly comentario?: string | null;
  readonly responsableId?: string | null;
  /** AAAA-MM-DD. */
  readonly fechaObjetivo?: string | null;
  readonly version: number;
}

const fechaValida = (t: string): boolean => {
  const m = FECHA.exec(t);
  if (!m) return false;
  const [, a, mes, d] = m;
  const f = new Date(Date.UTC(Number(a), Number(mes) - 1, Number(d)));
  return f.getUTCFullYear() === Number(a) && f.getUTCMonth() === Number(mes) - 1 && f.getUTCDate() === Number(d);
};

/** Evaluación de una cláusula o un control de la norma. «No aplica» exige justificación (en el comentario). */
export class Evaluacion {
  private constructor(
    readonly empresaId: EmpresaId,
    readonly libreriaCodigo: string,
    readonly idEstable: string,
    readonly libreriaId: string,
    readonly estado: EstadoEvaluacion,
    readonly comentario: string | null,
    readonly responsableId: string | null,
    readonly fechaObjetivo: string | null,
    readonly version: number,
  ) {
    Object.freeze(this);
  }

  static crear(d: DatosEvaluacion): Evaluacion {
    if (typeof d.libreriaCodigo !== 'string' || !CODIGO.test(d.libreriaCodigo)) throw new ErrorCertificacion('libreriaCodigo');
    if (typeof d.idEstable !== 'string' || !ID_ESTABLE.test(d.idEstable)) throw new ErrorCertificacion('idEstable');
    if (typeof d.libreriaId !== 'string' || !UUID.test(d.libreriaId)) throw new ErrorCertificacion('libreriaId');
    if (!esEstadoEvaluacion(d.estado)) throw new ErrorCertificacion('estado');
    let comentario: string | null = null;
    if (d.comentario !== undefined && d.comentario !== null) {
      if (typeof d.comentario !== 'string') throw new ErrorCertificacion('comentario');
      const t = d.comentario.trim();
      if (t.length > COMENTARIO_MAX || CONTROL.test(t)) throw new ErrorCertificacion('comentario');
      comentario = t.length === 0 ? null : t;
    }
    if (d.estado === 'no_aplica' && (comentario === null || comentario.length < JUSTIFICACION_MIN)) throw new ErrorCertificacion('comentario', ['justificacion_requerida']);
    let responsableId: string | null = null;
    if (d.responsableId !== undefined && d.responsableId !== null) {
      if (typeof d.responsableId !== 'string' || !UUID.test(d.responsableId)) throw new ErrorCertificacion('responsableId');
      responsableId = d.responsableId.toLowerCase();
    }
    let fechaObjetivo: string | null = null;
    if (d.fechaObjetivo !== undefined && d.fechaObjetivo !== null) {
      if (typeof d.fechaObjetivo !== 'string' || !fechaValida(d.fechaObjetivo)) throw new ErrorCertificacion('fechaObjetivo');
      fechaObjetivo = d.fechaObjetivo;
    }
    if (!Number.isInteger(d.version) || d.version < 1) throw new ErrorCertificacion('version');
    return new Evaluacion(d.empresaId, d.libreriaCodigo, d.idEstable, d.libreriaId.toLowerCase(), d.estado, comentario, responsableId, fechaObjetivo, d.version);
  }

  /** Clave de la entrada evaluada, sin versión de librería. */
  get clave(): string {
    return `${this.libreriaCodigo}|${this.idEstable}`;
  }
}
