// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { leerFiltroCobertura } from './filtros-cobertura';

describe('filtro de la cobertura', () => {
  it('lee una norma válida y la recorta', () => {
    expect(leerFiltroCobertura({ norma: ' ISO/IEC 27001 ' })).toEqual({ filtros: { norma: 'ISO/IEC 27001' }, invalidos: false });
  });
  it('sin norma, o vacía, no es un error', () => {
    expect(leerFiltroCobertura({})).toEqual({ filtros: {}, invalidos: false });
    expect(leerFiltroCobertura({ norma: '  ' })).toEqual({ filtros: {}, invalidos: false });
  });
  it('descarta y avisa lo que la API rechazaría (formato, largo, repetido)', () => {
    for (const sp of [{ norma: '<script>' }, { norma: 'a'.repeat(61) }, { norma: ['a', 'b'] }, { norma: 'ISO;DROP' }]) expect(leerFiltroCobertura(sp), JSON.stringify(sp)).toEqual({ filtros: {}, invalidos: true });
  });
});
