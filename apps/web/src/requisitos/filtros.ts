// Filtros del listado leídos de la dirección. Cumplen los MISMOS límites que valida la API (contrato de /requisitos): lo que no
// los cumple se descarta aquí (y se avisa), así la API nunca recibe un valor que rechazaría con 400.
export interface FiltrosRequisitos {
  readonly q?: string;
  readonly capitulo?: number;
  readonly norma?: string;
  readonly tipo?: 'clausula' | 'control';
}

const Q = /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ .:-]+$/;
const NORMA = /^[A-Za-z0-9 :./-]+$/;
const CAPITULO = /^(?:[4-9]|10)$/;
const TIPO = /^(?:clausula|control)$/;

type Parametros = Readonly<Record<string, string | readonly string[] | undefined>>;

export const leerFiltros = (sp: Parametros): { filtros: FiltrosRequisitos; invalidos: boolean } => {
  let invalidos = false;
  const leer = (nombre: string, max: number, patron: RegExp): string | undefined => {
    const crudo = sp[nombre];
    if (crudo === undefined) return undefined;
    if (typeof crudo !== 'string') {
      invalidos = true;
      return undefined;
    }
    const valor = crudo.trim();
    if (valor === '') return undefined;
    if (valor.length > max || !patron.test(valor)) {
      invalidos = true;
      return undefined;
    }
    return valor;
  };
  const q = leer('q', 80, Q);
  const norma = leer('norma', 60, NORMA);
  const capituloTexto = leer('capitulo', 2, CAPITULO);
  const tipo = leer('tipo', 8, TIPO) as 'clausula' | 'control' | undefined;
  return {
    filtros: {
      ...(q ? { q } : {}),
      ...(capituloTexto ? { capitulo: Number(capituloTexto) } : {}),
      ...(norma ? { norma } : {}),
      ...(tipo ? { tipo } : {}),
    },
    invalidos,
  };
};

export const construirConsulta = (f: FiltrosRequisitos): string => {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.capitulo !== undefined) p.set('capitulo', String(f.capitulo));
  if (f.norma) p.set('norma', f.norma);
  if (f.tipo) p.set('tipo', f.tipo);
  const texto = p.toString();
  return texto === '' ? '' : `?${texto}`;
};
