import { ErrorCertificacion } from './errores.js';
import { fechaValida } from './fechas.js';

// Auditoría interna (ADR 040): independencia del auditor, por proceso. Reglas puras: sin base de datos, sin reloj propio.

export const RELACIONES_PROCESO = ['duena', 'participa', 'diseno', 'supervisa'] as const;
export type RelacionProceso = (typeof RELACIONES_PROCESO)[number];

export const MOTIVO_EXCEPCION_AUDITORIA_MAX = 300;
export const MEDIDA_COMPENSATORIA_MAX = 300;
/** Auditar el mismo proceso otra vez dentro de esta ventana es solo un aviso (buena práctica de rotación, no un requisito). */
export const MESES_AVISO_REPETICION = 12;

export interface RelacionDePersona {
  readonly usuarioId: string;
  readonly procesoId: string;
  readonly relacion: RelacionProceso;
}
export interface ProcesoDelAlcance {
  readonly id: string;
  readonly transversal: boolean;
}
/** Una auditoría anterior (no cancelada) en la que esa persona estuvo en el equipo sobre ese proceso. `fecha` = `AAAA-MM-DD` de su fin. */
export interface AuditoriaPrevia {
  readonly usuarioId: string;
  readonly procesoId: string;
  readonly fecha: string;
}
export interface Conflicto {
  readonly procesoId: string;
  readonly relaciones: readonly RelacionProceso[];
}
export interface AvisoRepeticion {
  readonly procesoId: string;
  readonly ultimaFecha: string;
}
export interface ResultadoIndependencia {
  /** `false` si hay al menos un conflicto: no se puede designar sin una excepción autorizada. */
  readonly independiente: boolean;
  readonly conflictos: readonly Conflicto[];
  readonly avisos: readonly AvisoRepeticion[];
}

/**
 * Los procesos que entran al alcance: los elegidos y, si la auditoría cubre las cláusulas 4 a 10, también el proceso transversal
 * «Gestión del SIG» (quien diseña, opera o aprueba el sistema no puede auditar sus requisitos transversales). Sin duplicados.
 */
export const procesosDelAlcance = (
  elegidos: readonly ProcesoDelAlcance[],
  transversal: ProcesoDelAlcance | null,
  cubreClausulas4a10: boolean,
): readonly ProcesoDelAlcance[] => {
  const mapa = new Map(elegidos.map((p) => [p.id, p]));
  if (cubreClausulas4a10 && transversal) mapa.set(transversal.id, transversal);
  return [...mapa.values()];
};

/** Resta `meses` a una fecha `AAAA-MM-DD` (ajusta el día si el mes destino es más corto). */
const restarMeses = (fecha: string, meses: number): string => {
  const [a, m, d] = fecha.split('-').map(Number) as [number, number, number];
  const total = a * 12 + (m - 1) - meses;
  const anio = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`;
};

/**
 * ¿Puede esta persona auditar estos procesos? Conflicto = cualquier relación registrada (dueña, participa, diseñó, supervisa) con un
 * proceso del alcance. Aviso (no bloqueo) = ya auditó ese proceso en los últimos 12 meses. Se evalúa al designar y otra vez al emitir
 * el informe, por si cambiaron las relaciones.
 */
export const evaluarIndependencia = (entrada: {
  readonly usuarioId: string;
  readonly procesos: readonly ProcesoDelAlcance[];
  readonly relaciones: readonly RelacionDePersona[];
  readonly previas: readonly AuditoriaPrevia[];
  readonly hoy: string;
}): ResultadoIndependencia => {
  if (!fechaValida(entrada.hoy)) throw new ErrorCertificacion('hoy', ['fecha no válida']);
  const desde = restarMeses(entrada.hoy, MESES_AVISO_REPETICION);
  const conflictos: Conflicto[] = [];
  const avisos: AvisoRepeticion[] = [];
  for (const p of entrada.procesos) {
    const relaciones = [
      ...new Set(entrada.relaciones.filter((r) => r.usuarioId === entrada.usuarioId && r.procesoId === p.id).map((r) => r.relacion)),
    ].sort();
    if (relaciones.length > 0) conflictos.push({ procesoId: p.id, relaciones });
    const recientes = entrada.previas
      .filter((x) => x.usuarioId === entrada.usuarioId && x.procesoId === p.id && x.fecha >= desde && x.fecha <= entrada.hoy)
      .map((x) => x.fecha)
      .sort();
    const ultima = recientes[recientes.length - 1];
    if (ultima) avisos.push({ procesoId: p.id, ultimaFecha: ultima });
  }
  return { independiente: conflictos.length === 0, conflictos, avisos };
};

export interface ExcepcionIndependencia {
  readonly motivo: string;
  readonly medida: string;
  /** Quien la autoriza (administrador SIG). */
  readonly autorizadaPor: string;
  /** La persona que se designa con la excepción. */
  readonly designada: string;
  /** La empresa tiene un único administrador activo (la regla de no autoautorizarse admite esta salida). */
  readonly unicoAdministradorActivo: boolean;
}

/**
 * Una excepción exige motivo y una medida compensatoria (por ejemplo, que otra persona revise el informe). Nadie autoriza su propia
 * excepción, salvo el único administrador activo; en ese caso queda marcada como autoautorizada. El texto es de la empresa y NO va a la
 * bitácora.
 */
export const validarExcepcion = (e: ExcepcionIndependencia): { motivo: string; medida: string; autoautorizada: boolean } => {
  const limpio = (v: unknown, campo: string, max: number): string => {
    if (typeof v !== 'string' || v.trim() === '') throw new ErrorCertificacion(campo, ['obligatorio']);
    const t = v.trim();
    if (t.length > max) throw new ErrorCertificacion(campo, [`máximo ${max} caracteres`]);
    return t;
  };
  const motivo = limpio(e.motivo, 'motivo', MOTIVO_EXCEPCION_AUDITORIA_MAX);
  const medida = limpio(e.medida, 'medida', MEDIDA_COMPENSATORIA_MAX);
  const autoautorizada = e.autorizadaPor === e.designada;
  if (autoautorizada && !e.unicoAdministradorActivo)
    throw new ErrorCertificacion('autorizadaPor', ['no puede autorizar su propia excepción']);
  return { motivo, medida, autoautorizada };
};
