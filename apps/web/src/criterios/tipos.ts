// Forma de los criterios de evaluación (contrato openapi.yaml, ADR 038) tal como la usa la web. Todo viene validado por `validadores.ts`.
export type NivelCriterio = 'bajo' | 'medio' | 'alto' | 'critico';
export const NIVELES_CRITERIO: readonly NivelCriterio[] = ['bajo', 'medio', 'alto', 'critico'];
export type Escala = readonly [string, string, string, string, string];

export interface CeldaMatriz {
  readonly probabilidad: number;
  readonly impacto: number;
  readonly puntaje: number;
  readonly nivel: NivelCriterio;
  readonly cantidad: number;
}

export interface Criterios {
  readonly origen: 'omision' | 'empresa';
  readonly version: number;
  readonly probabilidad: Escala;
  readonly impacto: Escala;
  readonly nivelAceptacion: NivelCriterio | null;
  readonly creadoEn: string | null;
  readonly riesgosVigentes: number;
  readonly matriz: readonly CeldaMatriz[];
}
