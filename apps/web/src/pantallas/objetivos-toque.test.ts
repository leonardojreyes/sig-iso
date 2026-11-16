import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// WCAG 2.2 AA (2.5.8) pide 24 px; el sistema usa `--sig-density-target-min` (2,75 rem). jsdom no calcula el diseño, así que se vigila
// el código: todo enlace con aspecto de enlace (`text-primary`) que NO va dentro de una frase debe llevar la altura mínima.
const MIN = 'min-h-[var(--sig-density-target-min)]';

// Excepciones justificadas: el título de cada requisito es el único objetivo de su fila y la celda lo separa de los demás (la excepción
// de espaciado del criterio 2.5.8 aplica).
const EXCEPCIONES = new Set(['requisitos.tsx']);

const archivos = readdirSync(import.meta.dirname).filter((f) => f.endsWith('.tsx') && !f.includes('.test.'));

describe('objetivo táctil mínimo de los enlaces', () => {
  it.each(archivos)('%s: los enlaces sueltos llevan la altura mínima', (archivo) => {
    const texto = readFileSync(join(import.meta.dirname, archivo), 'utf8');
    const clases = [
      // `<a className="...">`
      ...[...texto.matchAll(/<a\s+className="([^"]*)"/g)].map((m) => m[1]!),
      // `const enlace = '...'` / `const enlaceClase = '...'` (se usan como `className={enlace}`)
      ...[...texto.matchAll(/const enlace\w* =\s*'([^']*)'/g)].map((m) => m[1]!),
    ].filter((c) => !c.includes('sr-only'));
    const sinMinimo = clases.filter((c) => !c.includes(MIN));
    expect(EXCEPCIONES.has(archivo) ? [] : sinMinimo).toEqual([]);
  });

  it('las excepciones siguen existiendo (si se corrigen, se quitan de la lista)', () => {
    for (const archivo of EXCEPCIONES) {
      const texto = readFileSync(join(import.meta.dirname, archivo), 'utf8');
      const clases = [...texto.matchAll(/<a\s+className="([^"]*)"/g)].map((m) => m[1]!);
      expect(clases.some((c) => !c.includes(MIN))).toBe(true);
    }
  });
});
