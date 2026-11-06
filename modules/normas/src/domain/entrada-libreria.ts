import { revisarTexto } from '@sig/normas-schema/contenido';
import { ErrorNormas, exigirTexto, exigirUuid } from './errores.js';

export type AlcanceComun = 'comun' | 'parcial' | 'especifico';

export interface CorrespondenciaNorma {
  readonly norma: string;
  readonly edicion: string;
  readonly clausula: string;
}

export interface DatosEntrada {
  readonly id: string;
  readonly libreriaId: string;
  readonly idEstable: string;
  readonly capitulo: number;
  readonly nivel: 1 | 2;
  readonly titulo: string;
  readonly guia: string;
  readonly alcanceComun: AlcanceComun;
  readonly aplicaA: readonly CorrespondenciaNorma[];
  readonly esEjemplo: boolean;
  readonly orden: number;
}

const ID_ESTABLE = /^[a-z0-9][a-z0-9.-]{0,40}$/;
const NUMERICO = /^[0-9]+([.-][0-9]+)*$/;
const EDICION = /^[0-9]{4}$/;
const CLAUSULA = /^[A-Za-z0-9]+(\.[A-Za-z0-9]+)*$/;
const ALCANCES: readonly string[] = ['comun', 'parcial', 'especifico'];

const correspondencia = (c: unknown): CorrespondenciaNorma => {
  if (typeof c !== 'object' || c === null) throw new ErrorNormas('aplicaA');
  const { norma, edicion, clausula } = c as Record<string, unknown>;
  if (typeof norma !== 'string' || norma.length < 1 || norma.length > 60) throw new ErrorNormas('aplicaA');
  if (typeof edicion !== 'string' || !EDICION.test(edicion)) throw new ErrorNormas('aplicaA');
  if (typeof clausula !== 'string' || !CLAUSULA.test(clausula)) throw new ErrorNormas('aplicaA');
  return Object.freeze({ norma, edicion, clausula });
};

const texto = (campo: 'titulo' | 'guia', valor: unknown, min: number, max: number): string => {
  const t = exigirTexto(campo, valor, min, max);
  // Mismas reglas de contenido que el CI y la carga del catálogo: acotan el riesgo de texto copiado de una norma.
  const motivos = revisarTexto(campo, t);
  if (motivos.length > 0) throw new ErrorNormas(campo, motivos);
  return t;
};

/**
 * Entrada de una librería: identificador, título breve, guía propia y a qué norma, edición y cláusula corresponde.
 * El capítulo 10 se identifica por TEMA (id estable no numérico): su numeración difiere entre las normas.
 */
export class EntradaLibreria {
  private constructor(
    readonly id: string,
    readonly libreriaId: string,
    readonly idEstable: string,
    readonly capitulo: number,
    readonly nivel: 1 | 2,
    readonly titulo: string,
    readonly guia: string,
    readonly alcanceComun: AlcanceComun,
    readonly aplicaA: readonly CorrespondenciaNorma[],
    readonly esEjemplo: boolean,
    readonly orden: number,
  ) {
    Object.freeze(this);
  }

  static crear(d: DatosEntrada): EntradaLibreria {
    const id = exigirUuid('id', d.id);
    const libreriaId = exigirUuid('libreriaId', d.libreriaId);
    if (typeof d.capitulo !== 'number' || !Number.isInteger(d.capitulo) || d.capitulo < 4 || d.capitulo > 10) throw new ErrorNormas('capitulo');
    if (typeof d.idEstable !== 'string' || !ID_ESTABLE.test(d.idEstable)) throw new ErrorNormas('idEstable');
    if (d.capitulo === 10 && NUMERICO.test(d.idEstable)) throw new ErrorNormas('idEstable', ['capitulo_10_por_tema']);
    if (d.nivel !== 1 && d.nivel !== 2) throw new ErrorNormas('nivel');
    const titulo = texto('titulo', d.titulo, 2, 80);
    const guia = texto('guia', d.guia, 10, 280);
    if (typeof d.alcanceComun !== 'string' || !ALCANCES.includes(d.alcanceComun)) throw new ErrorNormas('alcanceComun');
    if (!Array.isArray(d.aplicaA) || d.aplicaA.length === 0) throw new ErrorNormas('aplicaA', ['lista_vacia']);
    const aplicaA = d.aplicaA.map(correspondencia);
    if (new Set(aplicaA.map((a) => `${a.norma}|${a.edicion}`)).size !== aplicaA.length) throw new ErrorNormas('aplicaA', ['norma_repetida']);
    if (typeof d.esEjemplo !== 'boolean') throw new ErrorNormas('esEjemplo');
    if (typeof d.orden !== 'number' || !Number.isInteger(d.orden) || d.orden < 0) throw new ErrorNormas('orden');
    return new EntradaLibreria(id, libreriaId, d.idEstable, d.capitulo, d.nivel, titulo, guia, d.alcanceComun as AlcanceComun, Object.freeze(aplicaA), d.esEjemplo, d.orden);
  }
}
