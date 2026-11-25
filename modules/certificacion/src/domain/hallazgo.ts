import { ErrorCertificacion } from './errores.js';

// Auditoría interna (ADR 040): hallazgos. Reglas puras. El tratamiento de las no conformidades (causa raíz, acciones, verificación) es de
// otro módulo: aquí solo se registran, quedan abiertas y se anulan con motivo, nunca se borran.

export const TIPOS_HALLAZGO = ['nc_mayor', 'nc_menor', 'observacion', 'oportunidad'] as const;
export type TipoHallazgoDominio = (typeof TIPOS_HALLAZGO)[number];
export const MOTIVOS_ANULACION = ['duplicado', 'error_de_registro', 'otro'] as const;
export type MotivoAnulacion = (typeof MOTIVOS_ANULACION)[number];
export const ENUNCIADO_MAX = 500;
export const EVIDENCIA_HALLAZGO_MAX = 1000;
export const JUSTIFICACION_GRAVEDAD_MAX = 500;
export const HALLAZGOS_POR_AUDITORIA_MAX = 500;

export const esNoConformidad = (tipo: TipoHallazgoDominio): boolean => tipo === 'nc_mayor' || tipo === 'nc_menor';
/** La gravedad de una NC la decide el auditor líder: solo él registra o cambia una NC mayor. */
export const exigeLider = (tipo: TipoHallazgoDominio): boolean => tipo === 'nc_mayor';

const texto = (v: unknown, campo: string, max: number): string => {
  if (typeof v !== 'string' || v.trim() === '') throw new ErrorCertificacion(campo, ['obligatorio']);
  const t = v.trim();
  if (t.length > max) throw new ErrorCertificacion(campo, [`máximo ${max} caracteres`]);
  return t;
};

export const validarTipoHallazgo = (v: unknown): TipoHallazgoDominio => {
  if (!(TIPOS_HALLAZGO as readonly unknown[]).includes(v)) throw new ErrorCertificacion('tipo', ['tipo no válido']);
  return v as TipoHallazgoDominio;
};
export const validarEnunciado = (v: unknown): string => texto(v, 'enunciado', ENUNCIADO_MAX);
export const validarEvidenciaHallazgo = (v: unknown): string => texto(v, 'evidencia', EVIDENCIA_HALLAZGO_MAX);
export const validarMotivoAnulacion = (v: unknown): MotivoAnulacion => {
  if (!(MOTIVOS_ANULACION as readonly unknown[]).includes(v)) throw new ErrorCertificacion('motivo', ['motivo no válido']);
  return v as MotivoAnulacion;
};

export interface DatosHallazgo {
  readonly tipo: TipoHallazgoDominio;
  readonly procesoId: string | null;
  readonly libreriaCodigo: string | null;
  readonly idEstable: string | null;
  readonly justificacionGravedad: string | null;
}

/**
 * Una no conformidad exige el proceso, el requisito incumplido y, si es mayor, la justificación de la gravedad; la observación (riesgo de
 * incumplimiento futuro) y la oportunidad no son incumplimientos y no llevan justificación de gravedad.
 */
export const validarDatosHallazgo = (d: { tipo: unknown; procesoId: string | null; libreriaCodigo: string | null; idEstable: string | null; justificacionGravedad: unknown }): DatosHallazgo => {
  const tipo = validarTipoHallazgo(d.tipo);
  if ((d.libreriaCodigo === null) !== (d.idEstable === null)) throw new ErrorCertificacion('requisito', ['incompleto']);
  if (esNoConformidad(tipo)) {
    if (d.procesoId === null) throw new ErrorCertificacion('procesoId', ['obligatorio en una no conformidad']);
    if (d.libreriaCodigo === null) throw new ErrorCertificacion('requisito', ['obligatorio en una no conformidad']);
  }
  const justificacion = d.justificacionGravedad === undefined || d.justificacionGravedad === null || d.justificacionGravedad === '' ? null : texto(d.justificacionGravedad, 'justificacionGravedad', JUSTIFICACION_GRAVEDAD_MAX);
  if (tipo === 'nc_mayor' && justificacion === null) throw new ErrorCertificacion('justificacionGravedad', ['obligatoria en una no conformidad mayor']);
  if (tipo !== 'nc_mayor' && justificacion !== null) throw new ErrorCertificacion('justificacionGravedad', ['solo en una no conformidad mayor']);
  return { tipo, procesoId: d.procesoId, libreriaCodigo: d.libreriaCodigo, idEstable: d.idEstable, justificacionGravedad: justificacion };
};
