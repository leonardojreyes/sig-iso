import { ErrorNormas, exigirTexto, exigirUuid } from './errores.js';

export interface DatosLibreria {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly version: string;
  readonly esEjemplo: boolean;
  readonly fuente: string;
}

const CODIGO = /^[a-z0-9-]{1,64}$/;
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/;

/** Librería del catálogo global (metadatos). Mismas reglas que la tabla `libreria`. Sin texto de normas (regla 3). */
export class Libreria {
  private constructor(
    readonly id: string,
    readonly codigo: string,
    readonly nombre: string,
    readonly version: string,
    readonly esEjemplo: boolean,
    readonly fuente: string,
  ) {
    Object.freeze(this);
  }

  static crear(d: DatosLibreria): Libreria {
    const id = exigirUuid('id', d.id);
    if (typeof d.codigo !== 'string' || !CODIGO.test(d.codigo)) throw new ErrorNormas('codigo');
    const nombre = exigirTexto('nombre', d.nombre, 1, 120);
    if (typeof d.version !== 'string' || !VERSION.test(d.version)) throw new ErrorNormas('version');
    if (typeof d.esEjemplo !== 'boolean') throw new ErrorNormas('esEjemplo');
    const fuente = exigirTexto('fuente', d.fuente, 1, 200);
    return new Libreria(id, d.codigo, nombre, d.version, d.esEjemplo, fuente);
  }
}
