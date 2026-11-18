// Filtro de la lista de riesgos leído de la dirección (`?retirados=true`). Lo que no cumple se descarta y se avisa, así la API nunca recibe
// un valor que rechazaría con 400.
export interface FiltrosRiesgos {
  readonly retirados?: boolean;
}

type Parametros = Readonly<Record<string, string | readonly string[] | undefined>>;

export const leerFiltrosRiesgos = (sp: Parametros): { filtros: FiltrosRiesgos; invalidos: boolean } => {
  let invalidos = false;
  let retirados = false;
  if (sp.retirados !== undefined) {
    if (sp.retirados === 'true') retirados = true;
    else if (sp.retirados !== '' && sp.retirados !== 'false') invalidos = true;
  }
  return { filtros: retirados ? { retirados: true } : {}, invalidos };
};

export const construirConsultaRiesgos = (f: FiltrosRiesgos): string => (f.retirados ? '?incluirRetirados=true' : '');
