import type { EmpresaId } from '@sig/tenancy';
import { ErrorCertificacion } from './errores.js';
import { fechaValida } from './fechas.js';

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
export const TITULO_REFERENCIA_MAX = 120;
export const VERSION_REFERENCIA_MAX = 40;
export const UBICACION_REFERENCIA_MAX = 200;

export const TIPOS_REFERENCIA = Object.freeze(['analisis', 'plan'] as const);
/** `analisis` = documento de análisis de riesgos; `plan` = plan de tratamiento de riesgos. */
export type TipoReferencia = (typeof TIPOS_REFERENCIA)[number];

export interface DatosReferenciaTratamiento {
  readonly empresaId: EmpresaId;
  /** Norma de la Declaración (una por norma). */
  readonly norma: string;
  readonly tipo: TipoReferencia;
  readonly titulo: string;
  /** Versión del documento (por ejemplo «1.2»). */
  readonly versionDoc: string;
  /** `AAAA-MM-DD`. */
  readonly fecha: string;
  /** Dónde o con qué código lo conserva la empresa. El producto solo lo nombra. */
  readonly ubicacion: string;
  readonly version?: number;
}

const texto = (v: unknown, campo: string, max: number): string => {
  if (typeof v !== 'string') throw new ErrorCertificacion(campo);
  const t = v.trim();
  if (t.length === 0 || t.length > max || CONTROL.test(t)) throw new ErrorCertificacion(campo);
  return t;
};

/**
 * Referencia al documento de análisis de riesgos o al plan de tratamiento de la empresa (ADR 037): por Declaración y tipo, con título,
 * versión, fecha y ubicación. El producto no guarda el documento, solo lo nombra.
 */
export class ReferenciaTratamiento {
  private constructor(
    readonly empresaId: EmpresaId,
    readonly norma: string,
    readonly tipo: TipoReferencia,
    readonly titulo: string,
    readonly versionDoc: string,
    readonly fecha: string,
    readonly ubicacion: string,
    readonly version: number,
  ) {
    Object.freeze(this);
  }

  static crear(d: DatosReferenciaTratamiento): ReferenciaTratamiento {
    const norma = texto(d.norma, 'norma', 60);
    if (!(TIPOS_REFERENCIA as readonly unknown[]).includes(d.tipo)) throw new ErrorCertificacion('tipo');
    if (!fechaValida(d.fecha)) throw new ErrorCertificacion('fecha');
    const version = d.version ?? 1;
    if (!Number.isInteger(version) || version < 1) throw new ErrorCertificacion('version');
    return new ReferenciaTratamiento(
      d.empresaId, norma, d.tipo, texto(d.titulo, 'titulo', TITULO_REFERENCIA_MAX), texto(d.versionDoc, 'versionDoc', VERSION_REFERENCIA_MAX),
      d.fecha, texto(d.ubicacion, 'ubicacion', UBICACION_REFERENCIA_MAX), version,
    );
  }

  /** Referencia con los datos nuevos y la versión siguiente; la misma si nada cambia. */
  conDatos(d: { titulo: string; versionDoc: string; fecha: string; ubicacion: string }): ReferenciaTratamiento {
    const nueva = ReferenciaTratamiento.crear({ empresaId: this.empresaId, norma: this.norma, tipo: this.tipo, ...d, version: this.version + 1 });
    const igual = nueva.titulo === this.titulo && nueva.versionDoc === this.versionDoc && nueva.fecha === this.fecha && nueva.ubicacion === this.ubicacion;
    return igual ? this : nueva;
  }
}
