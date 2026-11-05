// Contraste WCAG 2.x (fórmula de luminancia relativa). Funciones puras, sin dependencias.

export interface Rgb { r: number; g: number; b: number }

export const hexARgb = (hex: string): Rgb => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Color hexadecimal inválido: ${hex}`);
  const n = parseInt(m[1]!, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

export const rgbAHex = ({ r, g, b }: Rgb): string =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

const canal = (v: number): number => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

export const luminancia = (hex: string): number => {
  const { r, g, b } = hexARgb(hex);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
};

export const contraste = (a: string, b: string): number => {
  const [la, lb] = [luminancia(a), luminancia(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/** Umbrales WCAG 2.2 AA */
export const AA_TEXTO = 4.5;
export const AA_COMPONENTE = 3;

/** Mezcla `a` hacia `b` en la proporción t (0..1). */
export const mezclar = (a: string, b: string, t: number): string => {
  const [x, y] = [hexARgb(a), hexARgb(b)];
  return rgbAHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
};
