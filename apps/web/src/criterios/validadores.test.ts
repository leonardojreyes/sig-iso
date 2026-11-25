import { describe, expect, it } from 'vitest';
import { validarCriterios } from './validadores';

const nivelDe = (p: number) => (p <= 4 ? 'bajo' : p <= 9 ? 'medio' : p <= 15 ? 'alto' : 'critico');
const matriz = (cantidades: Record<string, number> = {}) =>
  [5, 4, 3, 2, 1].flatMap((p) => [1, 2, 3, 4, 5].map((i) => ({ probabilidad: p, impacto: i, puntaje: p * i, nivel: nivelDe(p * i), cantidad: cantidades[`${p}|${i}`] ?? 0 })));
const cinco = (x: string) => [`${x}1`, `${x}2`, `${x}3`, `${x}4`, `${x}5`];
const omision = (o: Record<string, unknown> = {}) => ({ origen: 'omision', version: 0, probabilidad: cinco('p'), impacto: cinco('i'), nivelAceptacion: null, creadoEn: null, riesgosVigentes: 0, matriz: matriz(), ...o });
const empresa = (o: Record<string, unknown> = {}) => omision({ origen: 'empresa', version: 2, nivelAceptacion: 'medio', creadoEn: '2026-11-25T15:00:00.000Z', riesgosVigentes: 3, matriz: matriz({ '3|4': 2, '1|1': 1 }), ...o });

describe('validarCriterios', () => {
  it('acepta la escala por omisión y los criterios de la empresa', () => {
    expect(validarCriterios(omision())).not.toBeNull();
    expect(validarCriterios(empresa())).not.toBeNull();
  });
  it('rechaza campos de más, escalas de otro largo, niveles fuera de lista y fechas rotas', () => {
    expect(validarCriterios({ ...omision(), extra: 1 })).toBeNull();
    for (const mal of [{ probabilidad: cinco('p').slice(1) }, { impacto: [...cinco('i'), 'x'] }, { impacto: ['a', 'b', '', 'd', 'e'] }, { nivelAceptacion: 'enorme' }, { creadoEn: 'ayer' }, { version: -1 }, { matriz: matriz().slice(1) }])
      expect(validarCriterios(empresa(mal)), JSON.stringify(mal).slice(0, 50)).toBeNull();
  });
  it('rechaza lo incoherente: por omisión con versión, nivel o fecha; de la empresa sin ellos; y una matriz que no suma o con cortes distintos', () => {
    expect(validarCriterios(omision({ version: 1 }))).toBeNull();
    expect(validarCriterios(omision({ nivelAceptacion: 'medio' }))).toBeNull();
    expect(validarCriterios(omision({ creadoEn: '2026-11-25T15:00:00.000Z' }))).toBeNull();
    expect(validarCriterios(empresa({ version: 0 }))).toBeNull();
    expect(validarCriterios(empresa({ nivelAceptacion: null }))).toBeNull();
    expect(validarCriterios(empresa({ creadoEn: null }))).toBeNull();
    expect(validarCriterios(empresa({ riesgosVigentes: 4 }))).toBeNull(); // la suma de la matriz es 3
    const mala = matriz({ '3|4': 3 }).map((c) => (c.probabilidad === 3 && c.impacto === 4 ? { ...c, nivel: 'bajo' } : c));
    expect(validarCriterios(empresa({ matriz: mala, riesgosVigentes: 3 }))).toBeNull();
    const repetida = [...matriz().slice(1), matriz()[1]];
    expect(validarCriterios(omision({ matriz: repetida }))).toBeNull();
  });
});
