import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { revisarContenido } from './contenido';
import { validarLibreria, type Libreria } from './validar';

// El ARTEFACTO REAL: la librería del Anexo A de ISO/IEC 27001:2022 (verificada contra la NTE INEN-ISO/IEC 27001:2023).
const ruta = join(import.meta.dirname, '../../../libraries/normas/iso-27001-2022-anexo-a.yaml');
const texto = readFileSync(ruta, 'utf8');
const resultado = validarLibreria(parse(texto));
const libreria = (resultado.ok ? resultado.libreria : undefined) as Libreria;
const porTema = (tema: string) => libreria.entradas.filter((e) => e.grupo === tema);

describe('libraries/normas/iso-27001-2022-anexo-a.yaml', () => {
  it('cumple el esquema 3 y sus reglas entre campos', () => {
    expect(resultado.ok ? [] : resultado.errores).toEqual([]);
    expect(libreria.esquema).toBe(3);
  });

  it('cumple las reglas de contenido (guía breve, sin tono normativo, sin citas ni listas)', () => {
    expect(revisarContenido(libreria)).toEqual([]);
  });

  it('tiene 93 controles en cuatro temas con el reparto verificado contra la norma', () => {
    expect(libreria.entradas).toHaveLength(93);
    expect([37, 8, 14, 34]).toEqual([porTema('Organizacionales').length, porTema('Personas').length, porTema('Físicos').length, porTema('Tecnológicos').length]);
  });

  it('todas las entradas son controles de un tema, sin capítulo, de una sola norma y edición', () => {
    for (const e of libreria.entradas) {
      expect(e.tipo, e.id).toBe('control');
      expect(e.capitulo, e.id).toBeUndefined();
      expect(e.alcance_comun, e.id).toBe('especifico');
      expect(e.aplica_a, e.id).toEqual([expect.objectContaining({ norma: 'ISO/IEC 27001', edicion: '2022' })]);
    }
  });

  it('el identificador de cada control es «A.n.m» y su tema corresponde al número (A.5 organizacionales, A.6 personas, A.7 físicos, A.8 tecnológicos)', () => {
    const tema: Record<string, string> = { '5': 'Organizacionales', '6': 'Personas', '7': 'Físicos', '8': 'Tecnológicos' };
    for (const e of libreria.entradas) {
      const id = e.aplica_a[0]!.clausula;
      const m = /^A\.([5-8])\.(\d{1,2})$/.exec(id);
      expect(m, id).not.toBeNull();
      expect(e.grupo, id).toBe(tema[m![1]!]);
      expect(e.id, id).toBe(`a27-${m![1]}-${m![2]}`);
    }
  });

  it('los números de cada tema son consecutivos desde 1, sin saltos ni repetidos', () => {
    for (const [a, total] of [['5', 37], ['6', 8], ['7', 14], ['8', 34]] as const) {
      const numeros = libreria.entradas.filter((e) => e.aplica_a[0]!.clausula.startsWith(`A.${a}.`)).map((e) => Number(e.aplica_a[0]!.clausula.split('.')[2]));
      expect(numeros).toEqual(Array.from({ length: total }, (_, i) => i + 1));
    }
  });

  it('está verificada (1.0.0, sin marca de borrador) y es una librería de ejemplo de elaboración propia', () => {
    expect(libreria.version).toBe('1.0.0');
    expect(libreria.nombre).not.toMatch(/borrador|sin verificar/i);
    expect(texto).not.toMatch(/NUMERACIONES SIN VERIFICAR/);
    expect(texto).toMatch(/NUMERACIÓN VERIFICADA/);
    expect(libreria.es_ejemplo).toBe(true);
    expect(libreria.fuente).toMatch(/elaboración propia/);
  });
});
