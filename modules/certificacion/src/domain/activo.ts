import type { EmpresaId } from '@sig/tenancy';
import { ErrorCertificacion } from './errores.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Código correlativo de la empresa («A-001»); lo asigna el sistema, nunca la persona. */
const CODIGO = /^A-\d{3,6}$/;
// Caracteres de control y también los invisibles o de dirección (ancho cero, U+202E…), que sirven para disfrazar un texto en el documento.
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f​-‏‪-‮⁠-⁤⁦-⁩﻿]/;
export const NOMBRE_ACTIVO_MAX = 120;
export const DESCRIPCION_ACTIVO_MAX = 500;

/** Listas cerradas propias de la herramienta (spec H1.1); no son el texto de ninguna norma. */
export const TIPOS_ACTIVO = Object.freeze(['informacion', 'aplicacion_sistema', 'infraestructura', 'persona', 'servicio_terceros', 'instalacion'] as const);
export type TipoActivo = (typeof TIPOS_ACTIVO)[number];
export const CLASIFICACIONES_ACTIVO = Object.freeze(['publica', 'interna', 'confidencial', 'restringida'] as const);
export type ClasificacionActivo = (typeof CLASIFICACIONES_ACTIVO)[number];
export type EstadoActivo = 'vigente' | 'retirado';

/** Código correlativo a partir del número («A-001»). Desde 1000 crece sin relleno («A-1000»). */
export const codigoDeActivo = (numero: number): string => {
  if (!Number.isInteger(numero) || numero < 1 || numero > 999_999) throw new ErrorCertificacion('numero');
  return `A-${String(numero).padStart(3, '0')}`;
};
/** Número correlativo de un código válido («A-001» → 1). */
export const numeroDeActivo = (codigo: string): number => {
  if (typeof codigo !== 'string' || !CODIGO.test(codigo)) throw new ErrorCertificacion('codigo');
  return Number(codigo.slice(2));
};

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

const lista = <T extends string>(v: unknown, permitidos: readonly T[], campo: string): T => {
  if (!(permitidos as readonly unknown[]).includes(v)) throw new ErrorCertificacion(campo);
  return v as T;
};

/** El responsable es obligatorio y de la empresa (lo comprueba el caso de uso con el directorio): aquí solo la forma. */
const persona = (v: unknown): string => {
  if (typeof v !== 'string' || !UUID.test(v)) throw new ErrorCertificacion('responsableId');
  return v.toLowerCase();
};

export interface DatosActivo {
  readonly id: string;
  readonly empresaId: EmpresaId;
  readonly codigo: string;
  readonly nombre: string;
  readonly descripcion?: string | null;
  readonly tipo: TipoActivo;
  readonly clasificacion: ClasificacionActivo;
  readonly responsableId: string;
  readonly estado?: EstadoActivo;
  readonly version?: number;
}

export interface CambiosActivo {
  /** Ausente = se conserva. */
  readonly nombre?: string;
  /** Ausente = se conserva; `null` o vacío = se quita. */
  readonly descripcion?: string | null;
  readonly tipo?: TipoActivo;
  readonly clasificacion?: ClasificacionActivo;
  /** Ausente = se conserva; no se puede quitar. */
  readonly responsableId?: string;
}

/**
 * Activo de información de la empresa (ADR 038, spec H1): nombre, tipo y clasificación de listas cerradas, y un responsable
 * obligatorio. No se borra: se retira, y un activo retirado ya no se cambia ni cuenta como vigente. Los textos son libres pero
 * nunca llevan texto de las normas ni datos personales (la pantalla lo advierte).
 */
export class Activo {
  private constructor(
    readonly id: string,
    readonly empresaId: EmpresaId,
    readonly codigo: string,
    readonly nombre: string,
    readonly descripcion: string | null,
    readonly tipo: TipoActivo,
    readonly clasificacion: ClasificacionActivo,
    readonly responsableId: string,
    readonly estado: EstadoActivo,
    readonly version: number,
  ) {
    Object.freeze(this);
  }

  static crear(d: DatosActivo): Activo {
    if (typeof d.id !== 'string' || !UUID.test(d.id)) throw new ErrorCertificacion('id');
    if (typeof d.codigo !== 'string' || !CODIGO.test(d.codigo)) throw new ErrorCertificacion('codigo');
    const nombre = texto(d.nombre, 'nombre', NOMBRE_ACTIVO_MAX, true) as string;
    const descripcion = texto(d.descripcion, 'descripcion', DESCRIPCION_ACTIVO_MAX, false);
    const tipo = lista(d.tipo, TIPOS_ACTIVO, 'tipo');
    const clasificacion = lista(d.clasificacion, CLASIFICACIONES_ACTIVO, 'clasificacion');
    const responsableId = persona(d.responsableId);
    const estado = d.estado ?? 'vigente';
    if (estado !== 'vigente' && estado !== 'retirado') throw new ErrorCertificacion('estado');
    const version = d.version ?? 1;
    if (!Number.isInteger(version) || version < 1) throw new ErrorCertificacion('version');
    return new Activo(d.id.toLowerCase(), d.empresaId, d.codigo, nombre, descripcion, tipo, clasificacion, responsableId, estado, version);
  }

  get vigente(): boolean {
    return this.estado === 'vigente';
  }

  /** Activo con los cambios aplicados y la versión siguiente; el mismo activo si nada cambia. */
  conCambios(c: CambiosActivo): Activo {
    if (!this.vigente) throw new ErrorCertificacion('activo', ['retirado']);
    const nombre = c.nombre === undefined ? this.nombre : (texto(c.nombre, 'nombre', NOMBRE_ACTIVO_MAX, true) as string);
    const descripcion = c.descripcion === undefined ? this.descripcion : texto(c.descripcion, 'descripcion', DESCRIPCION_ACTIVO_MAX, false);
    const tipo = c.tipo === undefined ? this.tipo : lista(c.tipo, TIPOS_ACTIVO, 'tipo');
    const clasificacion = c.clasificacion === undefined ? this.clasificacion : lista(c.clasificacion, CLASIFICACIONES_ACTIVO, 'clasificacion');
    const responsableId = c.responsableId === undefined ? this.responsableId : persona(c.responsableId);
    if (
      nombre === this.nombre &&
      descripcion === this.descripcion &&
      tipo === this.tipo &&
      clasificacion === this.clasificacion &&
      responsableId === this.responsableId
    )
      return this;
    return new Activo(this.id, this.empresaId, this.codigo, nombre, descripcion, tipo, clasificacion, responsableId, this.estado, this.version + 1);
  }

  retirar(): Activo {
    if (!this.vigente) throw new ErrorCertificacion('activo', ['ya_retirado']);
    return new Activo(this.id, this.empresaId, this.codigo, this.nombre, this.descripcion, this.tipo, this.clasificacion, this.responsableId, 'retirado', this.version + 1);
  }
}
