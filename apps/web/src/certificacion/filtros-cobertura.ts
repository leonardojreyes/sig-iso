// Filtro de la cobertura leído de la dirección: cumple los MISMOS límites que valida la API (contrato de /cobertura); lo que no los
// cumple se descarta y se avisa, así la API nunca recibe un valor que rechazaría con 400.
export interface FiltroCobertura {
  readonly norma?: string;
}

const NORMA = /^[A-Za-z0-9 :./-]+$/;
type Parametros = Readonly<Record<string, string | readonly string[] | undefined>>;

export const leerFiltroCobertura = (sp: Parametros): { filtros: FiltroCobertura; invalidos: boolean } => {
  if (sp.norma === undefined) return { filtros: {}, invalidos: false };
  const v = typeof sp.norma === 'string' ? sp.norma.trim() : null;
  if (v === '') return { filtros: {}, invalidos: false };
  if (v === null || v.length > 60 || !NORMA.test(v)) return { filtros: {}, invalidos: true };
  return { filtros: { norma: v }, invalidos: false };
};
