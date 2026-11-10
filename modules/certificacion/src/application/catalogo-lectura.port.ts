import type { EmpresaId } from '@sig/tenancy';

export const CATALOGO_LECTURA = Symbol('CATALOGO_LECTURA');

/** Una cláusula o un control de las librerías que la empresa adoptó. */
export interface EntradaCatalogo {
  readonly libreriaCodigo: string;
  /** Versión de la librería a la que pertenece esta fila. */
  readonly libreriaId: string;
  readonly idEstable: string;
  readonly tipo: 'clausula' | 'control';
  readonly capitulo: number | null;
  readonly grupo: string | null;
  readonly titulo: string;
  readonly guia: string;
  /** Normas a las que aplica, con su identificador propio. */
  readonly aplicaA: readonly { readonly norma: string; readonly edicion: string; readonly clausula: string }[];
  readonly orden: number;
}

/**
 * Puerto de salida: las entradas de las librerías que ESTA empresa adoptó, con **una sola versión por código de librería** (la
 * mayor de las adoptadas). Ordenadas por código de librería y por el orden de la librería. Nunca devuelve entradas de otra empresa.
 */
export interface CatalogoLecturaPort {
  listarEntradasVigentes(empresaId: EmpresaId): Promise<readonly EntradaCatalogo[]>;
}
