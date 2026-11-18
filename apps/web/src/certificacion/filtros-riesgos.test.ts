import { describe, expect, it } from 'vitest';
import { construirConsultaRiesgos, leerFiltrosRiesgos } from './filtros-riesgos';

describe('filtros de riesgos', () => {
  it('sin parámetros no hay filtros ni avisos', () => {
    expect(leerFiltrosRiesgos({})).toEqual({ filtros: {}, invalidos: false });
  });
  it('lee «retirados=true» y acepta «false» o vacío como sin filtro', () => {
    expect(leerFiltrosRiesgos({ retirados: 'true' })).toEqual({ filtros: { retirados: true }, invalidos: false });
    expect(leerFiltrosRiesgos({ retirados: 'false' })).toEqual({ filtros: {}, invalidos: false });
    expect(leerFiltrosRiesgos({ retirados: '' })).toEqual({ filtros: {}, invalidos: false });
  });
  it('descarta lo que no es válido (y avisa) en vez de reenviarlo a la API', () => {
    for (const malo of ['quizas', '<script>', ['true', 'true']]) expect(leerFiltrosRiesgos({ retirados: malo as never }), String(malo)).toEqual({ filtros: {}, invalidos: true });
  });
  it('arma la consulta de la API solo con el filtro válido', () => {
    expect(construirConsultaRiesgos({})).toBe('');
    expect(construirConsultaRiesgos({ retirados: true })).toBe('?incluirRetirados=true');
  });
});
