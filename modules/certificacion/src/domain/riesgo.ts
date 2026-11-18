import type { EmpresaId } from '@sig/tenancy';
import { ErrorCertificacion } from './errores.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Código correlativo de la empresa («R-001»); lo asigna el sistema, nunca la persona. */
const CODIGO = /^R-\d{3,6}$/;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
export const TITULO_RIESGO_MAX = 120;
export const DESCRIPCION_RIESGO_MAX = 1000;

/** Escala fija de probabilidad e impacto (ADR 037): se imprime en el documento y se congela en cada versión aprobada. */
export const ESCALA_MIN = 1;
export const ESCALA_MAX = 5;

/** Código correlativo de la empresa a partir del número («R-001»); lo asigna el sistema. Desde 1000 crece sin relleno («R-1000»). */
export const codigoDeRiesgo = (numero: number): string => {
  if (!Number.isInteger(numero) || numero < 1 || numero > 999_999) throw new ErrorCertificacion('numero');
  return `R-${String(numero).padStart(3, '0')}`;
};
/** Número correlativo de un código válido («R-001» → 1). */
export const numeroDeRiesgo = (codigo: string): number => {
  if (typeof codigo !== 'string' || !CODIGO.test(codigo)) throw new ErrorCertificacion('codigo');
  return Number(codigo.slice(2));
};

export type NivelRiesgo = 'bajo' | 'medio' | 'alto' | 'critico';

export interface CorteNivel {
  readonly nivel: NivelRiesgo;
  readonly nombre: string;
  readonly desde: number;
  readonly hasta: number;
}

/** Cortes del puntaje (probabilidad × impacto), inclusivos. Método por omisión de la herramienta, no el criterio de la empresa. */
export const CORTES_NIVEL: readonly CorteNivel[] = Object.freeze([
  Object.freeze({ nivel: 'bajo', nombre: 'bajo', desde: 1, hasta: 4 }),
  Object.freeze({ nivel: 'medio', nombre: 'medio', desde: 5, hasta: 9 }),
  Object.freeze({ nivel: 'alto', nombre: 'alto', desde: 10, hasta: 15 }),
  Object.freeze({ nivel: 'critico', nombre: 'crítico', desde: 16, hasta: 25 }),
]);

/** Escala y cortes que se congelan en cada versión aprobada (los cortes son el primer puntaje de cada nivel). */
export const escalaVigente = (): { readonly escalaMax: number; readonly corteMedio: number; readonly corteAlto: number; readonly corteCritico: number } => ({
  escalaMax: ESCALA_MAX,
  corteMedio: (CORTES_NIVEL.find((c) => c.nivel === 'medio') as CorteNivel).desde,
  corteAlto: (CORTES_NIVEL.find((c) => c.nivel === 'alto') as CorteNivel).desde,
  corteCritico: (CORTES_NIVEL.find((c) => c.nivel === 'critico') as CorteNivel).desde,
});

export const DECISIONES_TRATAMIENTO = Object.freeze(['mitigar', 'aceptar', 'transferir', 'evitar'] as const);
export type DecisionTratamiento = (typeof DECISIONES_TRATAMIENTO)[number];

export type EstadoRiesgo = 'vigente' | 'retirado';

const enEscala = (v: unknown, campo: string): number => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < ESCALA_MIN || v > ESCALA_MAX) throw new ErrorCertificacion(campo);
  return v;
};

export const nombreDeNivel = (nivel: NivelRiesgo): string => (CORTES_NIVEL.find((c) => c.nivel === nivel) as CorteNivel).nombre;

/** Nivel inicial = probabilidad × impacto, con su nombre; la persona nunca lo escribe. */
export const calcularNivel = (probabilidad: number, impacto: number): { readonly puntaje: number; readonly nivel: NivelRiesgo } => {
  const puntaje = enEscala(probabilidad, 'probabilidad') * enEscala(impacto, 'impacto');
  const corte = CORTES_NIVEL.find((c) => puntaje >= c.desde && puntaje <= c.hasta) as CorteNivel;
  return { puntaje, nivel: corte.nivel };
};

export interface DatosRiesgo {
  readonly id: string;
  readonly empresaId: EmpresaId;
  readonly codigo: string;
  readonly titulo: string;
  readonly descripcion?: string | null;
  readonly probabilidad: number;
  readonly impacto: number;
  readonly decision: DecisionTratamiento;
  readonly responsableId?: string | null;
  readonly estado?: EstadoRiesgo;
  readonly version?: number;
}

export interface CambiosRiesgo {
  /** Ausente = se conserva. */
  readonly titulo?: string;
  /** Ausente = se conserva; `null` o vacío = se quita. */
  readonly descripcion?: string | null;
  readonly probabilidad?: number;
  readonly impacto?: number;
  readonly decision?: DecisionTratamiento;
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

const decisionValida = (v: unknown): DecisionTratamiento => {
  if (!(DECISIONES_TRATAMIENTO as readonly unknown[]).includes(v)) throw new ErrorCertificacion('decision');
  return v as DecisionTratamiento;
};

/**
 * Riesgo mínimo de la empresa (ADR 037): probabilidad e impacto de 1 a 5, nivel inicial calculado, decisión de tratamiento y
 * responsable (obligatorio al aceptar). No se borra: se retira, y un riesgo retirado ya no se cambia ni cuenta como vigente.
 * Sin riesgo residual ni su aceptación formal.
 */
export class Riesgo {
  readonly puntaje: number;
  readonly nivel: NivelRiesgo;

  private constructor(
    readonly id: string,
    readonly empresaId: EmpresaId,
    readonly codigo: string,
    readonly titulo: string,
    readonly descripcion: string | null,
    readonly probabilidad: number,
    readonly impacto: number,
    readonly decision: DecisionTratamiento,
    readonly responsableId: string | null,
    readonly estado: EstadoRiesgo,
    readonly version: number,
  ) {
    ({ puntaje: this.puntaje, nivel: this.nivel } = calcularNivel(probabilidad, impacto));
    Object.freeze(this);
  }

  static crear(d: DatosRiesgo): Riesgo {
    if (typeof d.id !== 'string' || !UUID.test(d.id)) throw new ErrorCertificacion('id');
    if (typeof d.codigo !== 'string' || !CODIGO.test(d.codigo)) throw new ErrorCertificacion('codigo');
    const titulo = texto(d.titulo, 'titulo', TITULO_RIESGO_MAX, true) as string;
    const descripcion = texto(d.descripcion, 'descripcion', DESCRIPCION_RIESGO_MAX, false);
    const decision = decisionValida(d.decision);
    const responsableId = persona(d.responsableId);
    if (decision === 'aceptar' && responsableId === null) throw new ErrorCertificacion('responsableId', ['aceptar_exige_responsable']);
    const estado = d.estado ?? 'vigente';
    if (estado !== 'vigente' && estado !== 'retirado') throw new ErrorCertificacion('estado');
    const version = d.version ?? 1;
    if (!Number.isInteger(version) || version < 1) throw new ErrorCertificacion('version');
    return new Riesgo(
      d.id.toLowerCase(),
      d.empresaId,
      d.codigo,
      titulo,
      descripcion,
      enEscala(d.probabilidad, 'probabilidad'),
      enEscala(d.impacto, 'impacto'),
      decision,
      responsableId,
      estado,
      version,
    );
  }

  get vigente(): boolean {
    return this.estado === 'vigente';
  }

  /** Riesgo con los cambios aplicados y la versión siguiente; el mismo riesgo si nada cambia. */
  conCambios(c: CambiosRiesgo): Riesgo {
    if (!this.vigente) throw new ErrorCertificacion('riesgo', ['retirado']);
    const titulo = c.titulo === undefined ? this.titulo : (texto(c.titulo, 'titulo', TITULO_RIESGO_MAX, true) as string);
    const descripcion = c.descripcion === undefined ? this.descripcion : texto(c.descripcion, 'descripcion', DESCRIPCION_RIESGO_MAX, false);
    const probabilidad = c.probabilidad === undefined ? this.probabilidad : enEscala(c.probabilidad, 'probabilidad');
    const impacto = c.impacto === undefined ? this.impacto : enEscala(c.impacto, 'impacto');
    const decision = c.decision === undefined ? this.decision : decisionValida(c.decision);
    const responsableId = c.responsableId === undefined ? this.responsableId : persona(c.responsableId);
    if (decision === 'aceptar' && responsableId === null) throw new ErrorCertificacion('responsableId', ['aceptar_exige_responsable']);
    if (
      titulo === this.titulo &&
      descripcion === this.descripcion &&
      probabilidad === this.probabilidad &&
      impacto === this.impacto &&
      decision === this.decision &&
      responsableId === this.responsableId
    )
      return this;
    return new Riesgo(
      this.id,
      this.empresaId,
      this.codigo,
      titulo,
      descripcion,
      probabilidad,
      impacto,
      decision,
      responsableId,
      this.estado,
      this.version + 1,
    );
  }

  retirar(): Riesgo {
    if (!this.vigente) throw new ErrorCertificacion('riesgo', ['ya_retirado']);
    return new Riesgo(
      this.id,
      this.empresaId,
      this.codigo,
      this.titulo,
      this.descripcion,
      this.probabilidad,
      this.impacto,
      this.decision,
      this.responsableId,
      'retirado',
      this.version + 1,
    );
  }
}
