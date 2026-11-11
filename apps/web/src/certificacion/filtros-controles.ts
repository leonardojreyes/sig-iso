// Filtros del marco de controles leídos de la dirección. Cumplen los MISMOS límites que valida la API (contrato de /controles): lo
// que no los cumple se descarta aquí (y se avisa), así la API nunca recibe un valor que rechazaría con 400.
export interface FiltrosControles {
  readonly norma?: string;
  readonly retirados?: boolean;
}

const NORMA = /^[A-Za-z0-9 :./-]+$/;
type Parametros = Readonly<Record<string, string | readonly string[] | undefined>>;

export const leerFiltrosControles = (sp: Parametros): { filtros: FiltrosControles; invalidos: boolean } => {
  let invalidos = false;
  let norma: string | undefined;
  if (sp.norma !== undefined) {
    const v = typeof sp.norma === 'string' ? sp.norma.trim() : null;
    if (v === '') norma = undefined;
    else if (v === null || v.length > 60 || !NORMA.test(v)) invalidos = true;
    else norma = v;
  }
  let retirados = false;
  if (sp.retirados !== undefined) {
    if (sp.retirados === 'true') retirados = true;
    else if (sp.retirados !== '' && sp.retirados !== 'false') invalidos = true;
  }
  return { filtros: { ...(norma ? { norma } : {}), ...(retirados ? { retirados: true } : {}) }, invalidos };
};

export const construirConsultaControles = (f: FiltrosControles): string => {
  const p = new URLSearchParams();
  if (f.norma) p.set('norma', f.norma);
  if (f.retirados) p.set('incluirRetirados', 'true');
  const texto = p.toString();
  return texto === '' ? '' : `?${texto}`;
};
