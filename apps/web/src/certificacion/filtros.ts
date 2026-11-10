// Filtros del diagnóstico leídos de la dirección. Cumplen los MISMOS límites que valida la API (contrato de /diagnostico): lo
// que no los cumple se descarta aquí (y se avisa), así la API nunca recibe un valor que rechazaría con 400.
export type EstadoFiltro = 'cumple' | 'parcial' | 'no_cumple' | 'no_aplica' | 'sin_evaluar';

export interface FiltrosDiagnostico {
  readonly q?: string;
  readonly norma?: string;
  readonly tipo?: 'clausula' | 'control';
  readonly estado?: EstadoFiltro;
}

const Q = /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ .:-]+$/;
const NORMA = /^[A-Za-z0-9 :./-]+$/;
const TIPO = /^(?:clausula|control)$/;
const ESTADO = /^(?:cumple|parcial|no_cumple|no_aplica|sin_evaluar)$/;

type Parametros = Readonly<Record<string, string | readonly string[] | undefined>>;

export const leerFiltrosDiagnostico = (sp: Parametros): { filtros: FiltrosDiagnostico; invalidos: boolean } => {
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
  const tipo = leer('tipo', 8, TIPO) as 'clausula' | 'control' | undefined;
  const estado = leer('estado', 12, ESTADO) as EstadoFiltro | undefined;
  return { filtros: { ...(q ? { q } : {}), ...(norma ? { norma } : {}), ...(tipo ? { tipo } : {}), ...(estado ? { estado } : {}) }, invalidos };
};

export const construirConsulta = (f: FiltrosDiagnostico): string => {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.norma) p.set('norma', f.norma);
  if (f.tipo) p.set('tipo', f.tipo);
  if (f.estado) p.set('estado', f.estado);
  const texto = p.toString();
  return texto === '' ? '' : `?${texto}`;
};
