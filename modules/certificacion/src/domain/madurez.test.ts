import { describe, expect, it } from 'vitest';
import { calcularMadurez, desglosar, type EntradaParaMadurez } from './madurez.js';

const cl = (capitulo: number, estado: EntradaParaMadurez['estado'], normas = ['ISO 9001']): EntradaParaMadurez => ({ tipo: 'clausula', capitulo, grupo: null, normas, estado });
const co = (grupo: string, estado: EntradaParaMadurez['estado']): EntradaParaMadurez => ({ tipo: 'control', capitulo: null, grupo, normas: ['ISO/IEC 27001'], estado });

describe('desglosar (cumple 100, parcial 50, no cumple 0; no aplica fuera; sin evaluar aparte)', () => {
  it.each([
    ['todo cumple', ['cumple', 'cumple'], 100],
    ['mitad cumple, mitad no cumple', ['cumple', 'no_cumple'], 50],
    ['un parcial vale 50', ['parcial'], 50],
    ['cumple, parcial y no cumple', ['cumple', 'parcial', 'no_cumple'], 50],
    ['no aplica no cuenta', ['cumple', 'no_aplica', 'no_aplica'], 100],
    ['sin evaluar no suma como cumplido', ['cumple', null, null], 100],
    ['todo no cumple', ['no_cumple', 'no_cumple'], 0],
  ] as const)('%s → %i %%', (_n, estados, esperado) => {
    expect(desglosar(estados.map((estado) => ({ estado }))).porcentaje).toBe(esperado);
  });

  it('sin nada evaluable el porcentaje es nulo, no cero', () => {
    expect(desglosar([]).porcentaje).toBeNull();
    expect(desglosar([{ estado: null }, { estado: 'no_aplica' }]).porcentaje).toBeNull();
  });

  it('redondea al entero más cercano', () => {
    expect(desglosar([{ estado: 'cumple' }, { estado: 'cumple' }, { estado: 'no_cumple' }]).porcentaje).toBe(67);
  });

  it('cuenta cada estado, las sin evaluar y el total', () => {
    expect(desglosar([{ estado: 'cumple' }, { estado: 'parcial' }, { estado: 'no_cumple' }, { estado: 'no_aplica' }, { estado: null }])).toMatchObject({
      cumple: 1, parcial: 1, noCumple: 1, noAplica: 1, sinEvaluar: 1, total: 5,
    });
  });
});

describe('calcularMadurez', () => {
  const entradas = [cl(4, 'cumple', ['ISO 9001', 'ISO/IEC 27001']), cl(4, 'no_cumple'), cl(5, null), co('Personas', 'parcial'), co('Físicos', 'cumple'), co('Personas', null)];
  const m = calcularMadurez(entradas);

  it('una entrada común cuenta en cada una de sus normas', () => {
    expect(Object.keys(m.porNorma)).toEqual(['ISO 9001', 'ISO/IEC 27001']);
    expect(m.porNorma['ISO 9001']!.total).toBe(3);
    expect(m.porNorma['ISO/IEC 27001']!.total).toBe(4);
  });

  it('agrupa las cláusulas por capítulo (en orden numérico) y los controles por tema, con los capítulos primero', () => {
    expect(m.porAgrupador.map((g) => `${g.tipo}:${g.clave}`)).toEqual(['capitulo:4', 'capitulo:5', 'tema:Físicos', 'tema:Personas']);
    expect(m.porAgrupador[0]!.desglose.porcentaje).toBe(50);
    expect(m.porAgrupador[3]!.desglose).toMatchObject({ parcial: 1, sinEvaluar: 1, porcentaje: 50 });
  });

  it('tiene un indicador propio de las cláusulas, aparte de los controles', () => {
    expect(m.clausulas).toMatchObject({ total: 3, cumple: 1, noCumple: 1, sinEvaluar: 1, porcentaje: 50 });
  });

  it('un «no cumple» en las cláusulas se ve aunque el promedio general sea alto', () => {
    const alto = calcularMadurez([cl(4, 'no_cumple'), co('Personas', 'cumple'), co('Físicos', 'cumple'), co('Personas', 'cumple')]);
    expect(alto.clausulas.porcentaje).toBe(0);
    expect(alto.porNorma['ISO/IEC 27001']!.porcentaje).toBe(100);
  });

  it('sin entradas no hay normas ni agrupadores', () => {
    expect(calcularMadurez([])).toMatchObject({ porNorma: {}, porAgrupador: [], clausulas: { total: 0, porcentaje: null } });
  });
});
