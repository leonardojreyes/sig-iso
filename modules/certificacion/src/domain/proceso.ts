import { ErrorCertificacion } from './errores.js';
import { RELACIONES_PROCESO, type RelacionProceso } from './independencia.js';

// Auditoría interna (ADR 040): procesos de la empresa, el mínimo que la independencia del auditor necesita. Reglas puras.

export const IMPORTANCIAS_PROCESO = ['alta', 'media', 'baja'] as const;
export type ImportanciaProceso = (typeof IMPORTANCIAS_PROCESO)[number];
export const FRECUENCIAS_PROCESO = ['semestral', 'anual', 'cada_dos_anios', 'cada_tres_anios'] as const;
export type FrecuenciaProceso = (typeof FRECUENCIAS_PROCESO)[number];
export const CAMBIOS_RELEVANTES = ['cambio', 'incidente'] as const;
export type CambioRelevante = (typeof CAMBIOS_RELEVANTES)[number];
export const ESTADOS_PROCESO = ['vigente', 'retirado'] as const;
export type EstadoProceso = (typeof ESTADOS_PROCESO)[number];

export const NOMBRE_PROCESO_MAX = 120;
export const DESCRIPCION_PROCESO_MAX = 300;
/** Nombre fijo del proceso transversal que entra al alcance de toda auditoría que cubra las cláusulas 4 a 10. */
export const NOMBRE_GESTION_SIG = 'Gestión del SIG';
export const RELACIONES_POR_PROCESO_MAX = 100;

/** «PR-001»: correlativo por empresa. Nunca se reutiliza (el proceso se retira, no se borra). */
export const codigoDeProceso = (numero: number): string => `PR-${String(numero).padStart(3, '0')}`;

const texto = (v: unknown, campo: string, max: number, obligatorio: boolean): string | null => {
  if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '' && !obligatorio)) {
    if (obligatorio) throw new ErrorCertificacion(campo, ['obligatorio']);
    return null;
  }
  if (typeof v !== 'string') throw new ErrorCertificacion(campo, ['debe ser texto']);
  const t = v.trim();
  if (t === '') throw new ErrorCertificacion(campo, ['obligatorio']);
  if (t.length > max) throw new ErrorCertificacion(campo, [`máximo ${max} caracteres`]);
  // Sin caracteres de control (salvo el salto de línea): el texto se muestra y se exporta tal cual.
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(t)) throw new ErrorCertificacion(campo, ['caracteres no permitidos']);
  return t;
};

const de = <T extends string>(lista: readonly T[], v: unknown, campo: string): T => {
  if (!(lista as readonly unknown[]).includes(v)) throw new ErrorCertificacion(campo, ['valor no permitido']);
  return v as T;
};

export const validarNombreProceso = (v: unknown): string => texto(v, 'nombre', NOMBRE_PROCESO_MAX, true) as string;
export const validarDescripcionProceso = (v: unknown): string | null => texto(v, 'descripcion', DESCRIPCION_PROCESO_MAX, false);
export const validarImportancia = (v: unknown): ImportanciaProceso => de(IMPORTANCIAS_PROCESO, v, 'importancia');
export const validarFrecuencia = (v: unknown): FrecuenciaProceso => de(FRECUENCIAS_PROCESO, v, 'frecuencia');
export const validarRelacion = (v: unknown): RelacionProceso => de(RELACIONES_PROCESO, v, 'relacion');
/** `null` quita la marca. */
export const validarCambioRelevante = (v: unknown): CambioRelevante | null => (v === null ? null : de(CAMBIOS_RELEVANTES, v, 'cambioRelevante'));
