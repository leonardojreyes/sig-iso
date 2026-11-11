// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { construirConsulta, leerFiltrosDiagnostico } from './filtros';

describe('filtros del diagnóstico', () => {
  it('lee los válidos y arma la consulta en orden fijo', () => {
    const { filtros, invalidos } = leerFiltrosDiagnostico({ q: ' política ', norma: 'ISO/IEC 27001', tipo: 'control', estado: 'sin_evaluar' });
    expect(invalidos).toBe(false);
    expect(filtros).toEqual({ q: 'política', norma: 'ISO/IEC 27001', tipo: 'control', estado: 'sin_evaluar' });
    expect(construirConsulta(filtros)).toBe('?q=pol%C3%ADtica&norma=ISO%2FIEC+27001&tipo=control&estado=sin_evaluar');
    expect(construirConsulta({})).toBe('');
  });

  it('descarta y avisa lo que la API rechazaría (formato, listas, repetidos)', () => {
    for (const sp of [{ estado: 'quizas' }, { tipo: 'otro' }, { q: '<script>' }, { norma: 'a'.repeat(61) }, { q: ['a', 'b'] }]) {
      const r = leerFiltrosDiagnostico(sp);
      expect(r.invalidos, JSON.stringify(sp)).toBe(true);
      expect(r.filtros).toEqual({});
    }
  });

  it('vacío es «sin filtro», no un error', () => {
    expect(leerFiltrosDiagnostico({ q: '  ', estado: '' })).toEqual({ filtros: {}, invalidos: false });
  });
});
