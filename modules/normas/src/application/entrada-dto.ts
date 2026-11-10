import type { EntradaLibreria } from '../domain/entrada-libreria.js';

/** Forma del contrato `EntradaLibreria`: sin campos internos (como `orden`). */
export interface EntradaDto {
  readonly id: string;
  readonly idEstable: string;
  readonly libreriaId: string;
  /** Nulo en un control del Anexo A. */
  readonly capitulo: number | null;
  readonly nivel: 1 | 2;
  readonly tipo: 'clausula' | 'control';
  /** Tema del control; nulo en una cláusula. */
  readonly grupo: string | null;
  readonly titulo: string;
  readonly guia: string;
  readonly alcanceComun: 'comun' | 'parcial' | 'especifico';
  readonly aplicaA: readonly { readonly norma: string; readonly edicion: string; readonly clausula: string }[];
  readonly esEjemplo: boolean;
}

export const aDto = (e: EntradaLibreria): EntradaDto => ({
  id: e.id,
  idEstable: e.idEstable,
  libreriaId: e.libreriaId,
  capitulo: e.capitulo,
  nivel: e.nivel,
  tipo: e.tipo,
  grupo: e.grupo,
  titulo: e.titulo,
  guia: e.guia,
  alcanceComun: e.alcanceComun,
  aplicaA: e.aplicaA.map((a) => ({ norma: a.norma, edicion: a.edicion, clausula: a.clausula })),
  esEjemplo: e.esEjemplo,
});
