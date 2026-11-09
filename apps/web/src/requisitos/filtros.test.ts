// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { construirConsulta, leerFiltros } from './filtros';

describe('leerFiltros (los mismos límites que valida la API)', () => {
  it('sin parámetros no hay filtros ni avisos', () => {
    expect(leerFiltros({})).toEqual({ filtros: {}, invalidos: false });
  });

  it('lee texto, capítulo y norma válidos', () => {
    expect(leerFiltros({ q: 'contexto', capitulo: '4', norma: 'ISO 9001' })).toEqual({
      filtros: { q: 'contexto', capitulo: 4, norma: 'ISO 9001' },
      invalidos: false,
    });
    expect(leerFiltros({ q: '  gobierno  ' }).filtros.q).toBe('gobierno');
    expect(leerFiltros({ q: 'Ñandú 4.1:a-b', norma: 'ISO/IEC 27001' }).filtros).toEqual({
      q: 'Ñandú 4.1:a-b',
      norma: 'ISO/IEC 27001',
    });
    for (const c of ['4', '5', '6', '7', '8', '9', '10'])
      expect(leerFiltros({ capitulo: c }).filtros.capitulo).toBe(Number(c));
  });

  it('un valor vacío significa «sin filtro» y no es un error', () => {
    expect(leerFiltros({ q: '', capitulo: '', norma: '' })).toEqual({ filtros: {}, invalidos: false });
    expect(leerFiltros({ q: '   ' })).toEqual({ filtros: {}, invalidos: false });
  });

  it.each([
    ['texto con comodín', { q: 'a%' }],
    ['texto con símbolos', { q: '<script>' }],
    ['texto con comillas', { q: "a' or 1=1" }],
    ['texto de más de 80 caracteres', { q: 'a'.repeat(81) }],
    ['capítulo fuera de rango', { capitulo: '3' }],
    ['capítulo 11', { capitulo: '11' }],
    ['capítulo con decimales', { capitulo: '4.5' }],
    ['capítulo con texto', { capitulo: '4abc' }],
    ['capítulo con signo', { capitulo: '+4' }],
    ['norma con símbolos', { norma: 'ISO;DROP' }],
    ['norma de más de 60 caracteres', { norma: 'a'.repeat(61) }],
    ['parámetro repetido', { q: ['a', 'b'] }],
  ])('un valor inválido se descarta y se avisa: %s', (_n, sp) => {
    const r = leerFiltros(sp as never);
    expect(r.invalidos).toBe(true);
    expect(r.filtros).toEqual({});
  });

  it('descarta solo el inválido y conserva los demás', () => {
    expect(leerFiltros({ q: 'contexto', capitulo: '99' })).toEqual({ filtros: { q: 'contexto' }, invalidos: true });
  });

  it('ignora parámetros que no conoce (como el viejo «estado»)', () => {
    expect(leerFiltros({ estado: 'cumple', otro: 'x' } as never)).toEqual({ filtros: {}, invalidos: false });
  });
});

describe('construirConsulta', () => {
  it('sin filtros no agrega nada', () => {
    expect(construirConsulta({})).toBe('');
  });
  it('codifica cada valor', () => {
    expect(construirConsulta({ q: 'a b&c=d', capitulo: 4, norma: 'ISO/IEC 27001' })).toBe(
      '?q=a+b%26c%3Dd&capitulo=4&norma=ISO%2FIEC+27001',
    );
  });
  it('omite lo que no hay', () => {
    expect(construirConsulta({ capitulo: 7 })).toBe('?capitulo=7');
  });
});
