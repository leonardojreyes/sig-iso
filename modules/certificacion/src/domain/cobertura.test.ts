import { describe, expect, it } from 'vitest';
import { calcularCobertura, type EntradaParaCobertura } from './cobertura.js';

const HOY = '2026-11-11';
const LIB = 'iso-27001-2022-anexo-a';
const entrada = (idEstable: string, normas = ['ISO/IEC 27001'], noAplica = false): EntradaParaCobertura => ({ libreriaCodigo: LIB, idEstable, normas, noAplica });
const mapeo = (controlId: string, idEstable: string) => ({ controlId, libreriaCodigo: LIB, idEstable });
const evi = (controlId: string, vigenteHasta: string | null = null, activa = true) => ({ controlId, activa, vigenteHasta });
const estadoDe = (r: ReturnType<typeof calcularCobertura>, id: string) => r.entradas.find((e) => e.idEstable === id);

describe('calcularCobertura', () => {
  it('clasifica cada entrada: cubierta, evidencia vencida, sin evidencia y sin control', () => {
    const r = calcularCobertura({
      hoy: HOY,
      entradas: [entrada('a'), entrada('b'), entrada('c'), entrada('d')],
      controles: [{ id: 'c1', vigente: true }, { id: 'c2', vigente: true }, { id: 'c3', vigente: true }],
      mapeos: [mapeo('c1', 'a'), mapeo('c2', 'b'), mapeo('c3', 'c')],
      evidencias: [evi('c1', '2027-01-01'), evi('c2', '2026-10-01')],
    });
    expect(r.entradas.map((e) => [e.idEstable, e.estado])).toEqual([['a', 'cubierta'], ['b', 'evidencia_vencida'], ['c', 'sin_evidencia'], ['d', 'sin_control']]);
  });

  it('«una evidencia, varias entradas»: un control con evidencia cubre todas las entradas que mapea', () => {
    const r = calcularCobertura({
      hoy: HOY,
      entradas: [entrada('a'), entrada('b'), entrada('c')],
      controles: [{ id: 'c1', vigente: true }],
      mapeos: [mapeo('c1', 'a'), mapeo('c1', 'b'), mapeo('c1', 'c')],
      evidencias: [evi('c1')],
    });
    expect(r.entradas.every((e) => e.estado === 'cubierta')).toBe(true);
    expect(r.total).toMatchObject({ total: 3, cubiertas: 3, porcentaje: 100 });
  });

  it('el vencimiento vale hasta el día indicado inclusive', () => {
    const una = (vence: string) => calcularCobertura({ hoy: HOY, entradas: [entrada('a')], controles: [{ id: 'c1', vigente: true }], mapeos: [mapeo('c1', 'a')], evidencias: [evi('c1', vence)] }).entradas[0]?.estado;
    expect(una(HOY)).toBe('cubierta');
    expect(una('2026-11-10')).toBe('evidencia_vencida');
  });

  it('basta una evidencia vigente entre varias: las vencidas no quitan la cobertura', () => {
    const r = calcularCobertura({ hoy: HOY, entradas: [entrada('a')], controles: [{ id: 'c1', vigente: true }], mapeos: [mapeo('c1', 'a')], evidencias: [evi('c1', '2020-01-01'), evi('c1', null)] });
    expect(r.entradas[0]).toMatchObject({ estado: 'cubierta', evidencias: 2 });
  });

  it('varios controles: basta que uno de ellos tenga evidencia vigente', () => {
    const r = calcularCobertura({ hoy: HOY, entradas: [entrada('a')], controles: [{ id: 'c1', vigente: true }, { id: 'c2', vigente: true }], mapeos: [mapeo('c1', 'a'), mapeo('c2', 'a')], evidencias: [evi('c2')] });
    expect(r.entradas[0]).toMatchObject({ estado: 'cubierta', controles: 2, evidencias: 1 });
  });

  it('las evidencias reemplazadas o eliminadas no cuentan', () => {
    const r = calcularCobertura({ hoy: HOY, entradas: [entrada('a')], controles: [{ id: 'c1', vigente: true }], mapeos: [mapeo('c1', 'a')], evidencias: [evi('c1', null, false)] });
    expect(r.entradas[0]).toMatchObject({ estado: 'sin_evidencia', evidencias: 0 });
  });

  it('un control retirado no cubre nada, aunque conserve mapeos y evidencias', () => {
    const r = calcularCobertura({ hoy: HOY, entradas: [entrada('a')], controles: [{ id: 'c1', vigente: false }], mapeos: [mapeo('c1', 'a')], evidencias: [evi('c1')] });
    expect(r.entradas[0]).toMatchObject({ estado: 'sin_control', controles: 0 });
  });

  it('las entradas «no aplica» no piden cobertura ni cuentan en el total', () => {
    const r = calcularCobertura({ hoy: HOY, entradas: [entrada('a'), entrada('b', ['ISO/IEC 27001'], true)], controles: [{ id: 'c1', vigente: true }], mapeos: [mapeo('c1', 'a')], evidencias: [evi('c1')] });
    expect(estadoDe(r, 'b')?.estado).toBe('no_aplica');
    expect(r.total).toMatchObject({ total: 1, cubiertas: 1, porcentaje: 100 });
  });

  it('sin nada que cubrir el porcentaje es nulo, no 0', () => {
    expect(calcularCobertura({ hoy: HOY, entradas: [], controles: [], mapeos: [], evidencias: [] }).total).toMatchObject({ total: 0, porcentaje: null });
    expect(calcularCobertura({ hoy: HOY, entradas: [entrada('a', ['ISO/IEC 27001'], true)], controles: [], mapeos: [], evidencias: [] }).total.porcentaje).toBeNull();
  });

  it('el resumen por norma cuenta una entrada común en cada norma a la que aplica', () => {
    const r = calcularCobertura({
      hoy: HOY,
      entradas: [entrada('comun', ['ISO 9001', 'ISO/IEC 27001']), entrada('solo27', ['ISO/IEC 27001']), entrada('solo9', ['ISO 9001'])],
      controles: [{ id: 'c1', vigente: true }],
      mapeos: [mapeo('c1', 'comun')],
      evidencias: [evi('c1')],
    });
    expect(Object.keys(r.porNorma)).toEqual(['ISO 9001', 'ISO/IEC 27001']);
    expect(r.porNorma['ISO 9001']).toMatchObject({ total: 2, cubiertas: 1, sinControl: 1, porcentaje: 50 });
    expect(r.porNorma['ISO/IEC 27001']).toMatchObject({ total: 2, cubiertas: 1, sinControl: 1, porcentaje: 50 });
    expect(r.total).toMatchObject({ total: 3, cubiertas: 1, porcentaje: 33 });
  });

  it('un mapeo a una entrada que ya no se adoptó no afecta a las demás', () => {
    const r = calcularCobertura({ hoy: HOY, entradas: [entrada('a')], controles: [{ id: 'c1', vigente: true }], mapeos: [mapeo('c1', 'huerfana')], evidencias: [evi('c1')] });
    expect(r.entradas[0]?.estado).toBe('sin_control');
  });

  it('las cuentas del resumen suman el total', () => {
    const r = calcularCobertura({
      hoy: HOY,
      entradas: [entrada('a'), entrada('b'), entrada('c'), entrada('d'), entrada('e', ['ISO/IEC 27001'], true)],
      controles: [{ id: 'c1', vigente: true }, { id: 'c2', vigente: true }, { id: 'c3', vigente: true }],
      mapeos: [mapeo('c1', 'a'), mapeo('c2', 'b'), mapeo('c3', 'c')],
      evidencias: [evi('c1'), evi('c2', '2020-01-01')],
    });
    const t = r.total;
    expect(t.cubiertas + t.evidenciaVencida + t.sinEvidencia + t.sinControl).toBe(t.total);
  });
});
