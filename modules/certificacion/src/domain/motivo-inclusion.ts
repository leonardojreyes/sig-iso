import type { EmpresaId } from '@sig/tenancy';
import { TIPOS_MOTIVO, type TipoMotivo } from './declaracion.js';
import { ErrorCertificacion } from './errores.js';

const LIBRERIA = /^[a-z0-9][a-z0-9-]{0,63}$/;
const ID_ESTABLE = /^[a-z0-9][a-z0-9.-]{0,40}$/;
// Caracteres de control y también los invisibles o de dirección (ancho cero, U+202E…), que sirven para disfrazar un texto en el documento.
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/;
export const NOTA_MOTIVO_MAX = 500;

export interface DatosMotivoInclusion {
  readonly empresaId: EmpresaId;
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  readonly tipo: TipoMotivo;
  /** En sus palabras: a qué requisito responde (legal, contractual) o por qué (negocio, otro). Obligatoria. */
  readonly nota: string;
  readonly version?: number;
}

/**
 * Motivo registrado de incluir un control del Anexo A en la Declaración (ADR 037): uno por tipo y control, siempre con una nota. El
 * motivo «riesgo» no es de esta clase: se deriva de los riesgos vigentes y nunca se escribe.
 */
export class MotivoInclusion {
  private constructor(
    readonly empresaId: EmpresaId,
    readonly libreriaCodigo: string,
    readonly idEstable: string,
    readonly tipo: TipoMotivo,
    readonly nota: string,
    readonly version: number,
  ) {
    Object.freeze(this);
  }

  static crear(d: DatosMotivoInclusion): MotivoInclusion {
    if (typeof d.libreriaCodigo !== 'string' || !LIBRERIA.test(d.libreriaCodigo)) throw new ErrorCertificacion('libreriaCodigo');
    if (typeof d.idEstable !== 'string' || !ID_ESTABLE.test(d.idEstable)) throw new ErrorCertificacion('idEstable');
    if (!(TIPOS_MOTIVO as readonly unknown[]).includes(d.tipo)) throw new ErrorCertificacion('tipo');
    if (typeof d.nota !== 'string') throw new ErrorCertificacion('nota');
    const nota = d.nota.trim();
    if (nota.length === 0 || nota.length > NOTA_MOTIVO_MAX || CONTROL.test(nota)) throw new ErrorCertificacion('nota');
    const version = d.version ?? 1;
    if (!Number.isInteger(version) || version < 1) throw new ErrorCertificacion('version');
    return new MotivoInclusion(d.empresaId, d.libreriaCodigo, d.idEstable, d.tipo, nota, version);
  }

  /** Clave de la fila: control del Anexo A y tipo. */
  get clave(): string {
    return `${this.libreriaCodigo}|${this.idEstable}|${this.tipo}`;
  }

  /** Motivo con otra nota y la versión siguiente; el mismo motivo si la nota no cambia. */
  conNota(nota: string): MotivoInclusion {
    const nuevo = MotivoInclusion.crear({ empresaId: this.empresaId, libreriaCodigo: this.libreriaCodigo, idEstable: this.idEstable, tipo: this.tipo, nota, version: this.version + 1 });
    return nuevo.nota === this.nota ? this : nuevo;
  }
}
