import { AA_TEXTO, contraste, mezclar } from './contraste';

export interface MarcaEmpresa {
  readonly nombre: string;
  /** Color primario elegido por la empresa (#RRGGBB). */
  readonly primario: string;
  readonly logoUrl?: string;
}

export interface TemaMarca {
  readonly claro: Record<string, string>;
  readonly oscuro: Record<string, string>;
  /** Avisos cuando se tuvo que ajustar el color para cumplir WCAG 2.2 AA. */
  readonly advertencias: string[];
}

const FONDO_CLARO = '#ffffff';
const FONDO_OSCURO = '#0f172a';
const NEGRO = '#000000';
const BLANCO = '#ffffff';

/** Ajusta `color` hacia `extremo` hasta alcanzar el contraste mínimo contra `fondo`. */
const ajustar = (color: string, extremo: string, fondo: string, minimo: number): { color: string; pasos: number } => {
  let actual = color;
  let pasos = 0;
  while (contraste(actual, fondo) < minimo && pasos < 40) {
    actual = mezclar(actual, extremo, 0.05);
    pasos++;
  }
  if (contraste(actual, fondo) < minimo) throw new Error(`No se puede alcanzar contraste ${minimo} para ${color}`);
  return { color: actual, pasos };
};

/** Elige texto blanco o negro con mayor contraste sobre `fondo`. */
const textoSobre = (fondo: string): string => (contraste(BLANCO, fondo) >= contraste(NEGRO, fondo) ? BLANCO : NEGRO);

/**
 * Deriva las variables de tema de una empresa y GARANTIZA contraste AA:
 * - claro: el primario se oscurece hasta 4.5:1 contra blanco (se usa como texto/enlace y fondo de botón);
 * - oscuro: el primario se aclara hasta 4.5:1 contra el fondo oscuro.
 * - el texto sobre el primario siempre alcanza 4.5:1.
 */
export const derivarTema = (marca: MarcaEmpresa): TemaMarca => {
  const advertencias: string[] = [];

  const claro = ajustar(marca.primario, NEGRO, FONDO_CLARO, AA_TEXTO);
  if (claro.pasos > 0) advertencias.push(`Color primario oscurecido en modo claro para cumplir contraste AA (${marca.primario} → ${claro.color}).`);

  const oscuro = ajustar(marca.primario, BLANCO, FONDO_OSCURO, AA_TEXTO);
  if (oscuro.pasos > 0) advertencias.push(`Color primario aclarado en modo oscuro para cumplir contraste AA (${marca.primario} → ${oscuro.color}).`);

  const variables = (primario: string, fondo: string, esClaro: boolean): Record<string, string> => {
    const hover = esClaro ? mezclar(primario, NEGRO, 0.2) : mezclar(primario, BLANCO, 0.2);
    const sobre = textoSobre(primario);
    return {
      '--sig-color-primary': primario,
      '--sig-color-primary-hover': hover,
      '--sig-color-on-primary': sobre,
      '--sig-color-ring': primario,
      '--sig-color-primary-subtle': mezclar(primario, fondo, esClaro ? 0.92 : 0.82),
      '--sig-color-on-primary-subtle': esClaro ? mezclar(primario, NEGRO, 0.35) : mezclar(primario, BLANCO, 0.75),
    };
  };

  return { claro: variables(claro.color, FONDO_CLARO, true), oscuro: variables(oscuro.color, FONDO_OSCURO, false), advertencias };
};

/** CSS que aplica la marca de una empresa bajo `[data-empresa="<id>"]`. */
export const cssMarca = (id: string, tema: TemaMarca): string => {
  if (!/^[a-z0-9-]{1,32}$/.test(id)) throw new Error('Identificador de empresa no válido para CSS de marca');
  const bloque = (vars: Record<string, string>) => Object.entries(vars).map(([k, v]) => `${k}:${v};`).join('');
  return [
    `[data-empresa="${id}"]{${bloque(tema.claro)}}`,
    `[data-empresa="${id}"][data-theme="dark"],[data-theme="dark"] [data-empresa="${id}"]{${bloque(tema.oscuro)}}`,
    `@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) [data-empresa="${id}"]{${bloque(tema.oscuro)}}}`,
  ].join('\n');
};
