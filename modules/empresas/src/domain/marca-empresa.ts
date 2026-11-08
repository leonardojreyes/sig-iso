import { derivarTema } from '@sig/tokens';

/** Error de una regla de la marca de empresa. El mensaje no repite el valor recibido. */
export class ErrorMarca extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorMarca';
  }
}

export interface DatosMarca {
  readonly nombre: string;
  /** Color elegido por la empresa (#RRGGBB). */
  readonly colorPrimario: string;
  readonly logoUrl?: string | null;
}

export interface MarcaEmpresa {
  readonly nombre: string;
  /** Color que se aplica: el elegido, o el elegido ajustado hasta cumplir el contraste AA (H3.2). */
  readonly colorPrimario: string;
  readonly colorOriginal: string;
  readonly ajustadoPorContraste: boolean;
  /** Logo permitido o `null`: entonces se muestra el monograma (H3.3). */
  readonly logoUrl: string | null;
  readonly monograma: string;
}

const NOMBRE_MAX = 120;
const LOGO_MAX = 2048;
const COLOR = /^#[0-9A-Fa-f]{6}$/;
// Misma regla que `Marca.logoUrl` del contrato OpenAPI: `https` sin credenciales, o ruta propia que no sea `//host` ni `/\host`.
const LOGO_PERMITIDO = /^(https:\/\/[A-Za-z0-9.-]+(:[0-9]+)?\/[^\s@]*|\/[^/\\\s][^\s@]*)$/;

const logoPermitido = (logo: string | null | undefined): string | null =>
  typeof logo === 'string' && logo.length <= LOGO_MAX && LOGO_PERMITIDO.test(logo) ? logo : null;

/** Iniciales (hasta 2) de las palabras que empiezan por letra; `?` si no hay ninguna. */
const monogramaDe = (nombre: string): string => {
  const letras = nombre
    .split(/\s+/)
    .map((palabra) => /^\p{L}/u.exec(palabra)?.[0])
    .filter((l): l is string => l !== undefined)
    .slice(0, 2);
  return letras.length > 0 ? letras.join('').toLocaleUpperCase('es') : '?';
};

/**
 * Crea la marca de una empresa aplicando las reglas del dominio:
 * - el color se ajusta hasta cumplir contraste AA contra blanco y se avisa con `ajustadoPorContraste` (H3.2);
 * - un logo que no sea `https` sin credenciales ni ruta propia se descarta (H3.3).
 */
export const crearMarca = (datos: DatosMarca): MarcaEmpresa => {
  const nombre = datos.nombre.trim();
  if (nombre.length < 1 || nombre.length > NOMBRE_MAX) {
    throw new ErrorMarca(`El nombre debe tener entre 1 y ${NOMBRE_MAX} caracteres`);
  }
  if (!COLOR.test(datos.colorPrimario)) {
    throw new ErrorMarca('El color primario debe tener el formato #RRGGBB');
  }
  const colorOriginal = datos.colorPrimario.toLowerCase();
  const colorPrimario = derivarTema({ nombre, primario: colorOriginal }).claro['--sig-color-primary']!;
  return Object.freeze({
    nombre,
    colorPrimario,
    colorOriginal,
    ajustadoPorContraste: colorPrimario !== colorOriginal,
    logoUrl: logoPermitido(datos.logoUrl),
    monograma: monogramaDe(nombre),
  });
};
