// Resultado de una carga de librerías, guardado EN LA MEMORIA DEL SERVIDOR hasta que la pantalla lo muestre una vez. Así el detalle
// (qué archivo, qué falló y dónde) no viaja en la dirección ni en una cookie, y no puede ser inventado por el navegador: la pantalla
// solo muestra lo que el servidor guardó, con un identificador de un solo uso, de la misma empresa y de vida corta.
import { randomUUID } from 'node:crypto';
import type { CargaLibreria } from '../api/tipos';

/** Lo que pasó con cada archivo subido. Los nombres son etiquetas ya limpiadas, nunca contenido. */
export type ResultadoArchivo =
  | { readonly nombre: string; readonly tipo: 'respuesta'; readonly carga: CargaLibreria }
  | { readonly nombre: string; readonly tipo: 'fallo'; readonly motivo: 'archivo_grande' | 'sin_permiso' | 'no_disponible' };

export interface ResultadoCarga {
  readonly archivos: readonly ResultadoArchivo[];
  /** Archivos de la selección que no eran .yaml o .yml (por ejemplo, los de una carpeta) y no se enviaron. */
  readonly omitidos: number;
  /** La selección pasó del tope de archivos y el resto no se procesó. */
  readonly recortado: boolean;
}

interface Guardado {
  readonly slug: string;
  readonly resultado: ResultadoCarga;
  readonly expiraEn: number;
}

const VIDA_MS = 5 * 60_000;
const MAXIMO = 200;

export class AlmacenResultadosCarga {
  private readonly datos = new Map<string, Guardado>();

  guardar(slug: string, resultado: ResultadoCarga, ahoraMs: number): string {
    const id = randomUUID();
    this.datos.set(id, { slug, resultado, expiraEn: ahoraMs + VIDA_MS });
    while (this.datos.size > MAXIMO) {
      const masAntiguo = this.datos.keys().next().value;
      if (masAntiguo === undefined) break;
      this.datos.delete(masAntiguo);
    }
    return id;
  }

  /** Se entrega UNA vez: lo leído se borra. Una empresa distinta, un id vencido o desconocido dan `null`. */
  tomar(id: string, slug: string, ahoraMs: number): ResultadoCarga | null {
    const g = this.datos.get(id);
    if (!g || g.slug !== slug) return null;
    this.datos.delete(id);
    return g.expiraEn > ahoraMs ? g.resultado : null;
  }

  get tamano(): number {
    return this.datos.size;
  }
}

const CLAVE_GLOBAL = Symbol.for('sig-iso.web.resultados-carga');
export const resultadosCompartidos = (): AlmacenResultadosCarga => {
  const global = globalThis as unknown as Record<symbol, AlmacenResultadosCarga | undefined>;
  return (global[CLAVE_GLOBAL] ??= new AlmacenResultadosCarga());
};
