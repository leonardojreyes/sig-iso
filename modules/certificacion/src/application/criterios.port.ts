import type { DescripcionesEscala, NivelAceptacion } from '../domain/criterios.js';

export interface FilaCriterios {
  readonly version: number;
  readonly probabilidad: DescripcionesEscala;
  readonly impacto: DescripcionesEscala;
  readonly nivelAceptacion: NivelAceptacion;
  readonly creadoPor: string;
  readonly creadoEn: Date;
}

export interface DatosCriterios {
  readonly probabilidad: DescripcionesEscala;
  readonly impacto: DescripcionesEscala;
  readonly nivelAceptacion: NivelAceptacion;
}

/** Criterios de evaluación de la empresa, versionados e inmutables: cada cambio es una versión nueva (la aplicación solo lee e inserta). */
export interface CriteriosRepositoryPort {
  /** La versión más alta, o nulo si la empresa nunca los definió (rige la escala por omisión). */
  vigente(): Promise<FilaCriterios | null>;
  /** Inserta la versión indicada. Falso si ya existe (otra persona la creó entre la lectura y la escritura). */
  crear(version: number, datos: DatosCriterios, usuarioId: string, ahora: Date): Promise<boolean>;
}
