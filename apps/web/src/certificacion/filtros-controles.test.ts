// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { construirConsultaControles, leerFiltrosControles } from './filtros-controles';

describe('filtros del marco de controles', () => {
  it('lee los válidos y arma la consulta que entiende la API', () => {
    const { filtros, invalidos } = leerFiltrosControles({ norma: ' ISO/IEC 27001 ', retirados: 'true' });
    expect(invalidos).toBe(false);
    expect(filtros).toEqual({ norma: 'ISO/IEC 27001', retirados: true });
    expect(construirConsultaControles(filtros)).toBe('?norma=ISO%2FIEC+27001&incluirRetirados=true');
    expect(construirConsultaControles({})).toBe('');
  });

  it('vacío y «false» son «sin filtro», no un error', () => {
    expect(leerFiltrosControles({ norma: '  ', retirados: '' })).toEqual({ filtros: {}, invalidos: false });
    expect(leerFiltrosControles({ retirados: 'false' })).toEqual({ filtros: {}, invalidos: false });
  });

  it('descarta y avisa lo que la API rechazaría (formato, listas, repetidos)', () => {
    for (const sp of [{ norma: '<script>' }, { norma: 'a'.repeat(61) }, { norma: ['a', 'b'] }, { retirados: 'quizas' }, { retirados: ['true', 'false'] }]) {
      const r = leerFiltrosControles(sp);
      expect(r.invalidos, JSON.stringify(sp)).toBe(true);
    }
    expect(leerFiltrosControles({ norma: '<x>', retirados: 'true' }).filtros).toEqual({ retirados: true });
  });
});
