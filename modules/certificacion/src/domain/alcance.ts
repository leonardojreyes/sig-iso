import type { EmpresaId } from '@sig/tenancy';
import { ErrorCertificacion } from './errores.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NORMA = /^[A-Za-z0-9 :./-]{1,60}$/;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
export const ALCANCE_MAX = 4000;

export interface DatosAlcance {
  readonly empresaId: EmpresaId;
  readonly norma: string;
  readonly texto: string;
  readonly actualizadoPor: string;
  readonly actualizadoEn: Date;
  readonly aprobadoPor?: string | null;
  readonly aprobadoEn?: Date | null;
}

/**
 * Alcance del sistema de gestión para una norma (texto). Lo aprueba una persona; cambiar el texto después lo devuelve a «sin
 * aprobar» (hay que volver a aprobarlo): lo aprobado nunca queda distinto de lo que se leyó al aprobar.
 */
export class Alcance {
  private constructor(
    readonly empresaId: EmpresaId,
    readonly norma: string,
    readonly texto: string,
    readonly actualizadoPor: string,
    readonly actualizadoEn: Date,
    readonly aprobadoPor: string | null,
    readonly aprobadoEn: Date | null,
  ) {
    Object.freeze(this);
  }

  static crear(d: DatosAlcance): Alcance {
    if (typeof d.norma !== 'string' || !NORMA.test(d.norma)) throw new ErrorCertificacion('norma');
    if (typeof d.texto !== 'string') throw new ErrorCertificacion('texto');
    const texto = d.texto.trim();
    if (texto.length < 1 || texto.length > ALCANCE_MAX || CONTROL.test(texto)) throw new ErrorCertificacion('texto');
    if (typeof d.actualizadoPor !== 'string' || !UUID.test(d.actualizadoPor)) throw new ErrorCertificacion('actualizadoPor');
    const aprobadoPor = d.aprobadoPor ?? null;
    const aprobadoEn = d.aprobadoEn ?? null;
    if ((aprobadoPor === null) !== (aprobadoEn === null)) throw new ErrorCertificacion('aprobado');
    if (aprobadoPor !== null && !UUID.test(aprobadoPor)) throw new ErrorCertificacion('aprobadoPor');
    return new Alcance(d.empresaId, d.norma, texto, d.actualizadoPor.toLowerCase(), d.actualizadoEn, aprobadoPor?.toLowerCase() ?? null, aprobadoEn);
  }

  get aprobado(): boolean {
    return this.aprobadoPor !== null;
  }

  /** Cambia el texto (si es distinto) y quita la aprobación. Con el mismo texto no cambia nada. */
  conTexto(texto: string, usuarioId: string, ahora: Date): Alcance {
    const nuevo = Alcance.crear({ empresaId: this.empresaId, norma: this.norma, texto, actualizadoPor: usuarioId, actualizadoEn: ahora });
    return nuevo.texto === this.texto ? this : nuevo;
  }

  /** Aprueba el texto vigente. Falla si ya estaba aprobado. */
  aprobar(usuarioId: string, ahora: Date): Alcance {
    if (this.aprobado) throw new ErrorCertificacion('aprobado', ['ya_aprobado']);
    return Alcance.crear({ empresaId: this.empresaId, norma: this.norma, texto: this.texto, actualizadoPor: this.actualizadoPor, actualizadoEn: this.actualizadoEn, aprobadoPor: usuarioId, aprobadoEn: ahora });
  }
}
