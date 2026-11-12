import { describe, expect, it } from 'vitest';
import { CONTROLES_POR_FILA_MAX, derivarDeclaracion, type EntradaParaDeclaracion } from './declaracion.js';

const L = 'iso-27001-anexo-a';
const entrada = (id: string, orden: number, extra: Partial<EntradaParaDeclaracion> = {}): EntradaParaDeclaracion => ({ libreriaCodigo: L, idEstable: id, orden, titulo: `Título ${id}`, grupo: 'Organizacionales', ...extra });
const ev = (id: string, estado: 'cumple' | 'parcial' | 'no_cumple' | 'no_aplica', comentario: string | null = null) => ({ libreriaCodigo: L, idEstable: id, estado, comentario });
const base = { evaluaciones: [], controles: [], mapeos: [], cobertura: [] };

describe('derivarDeclaracion', () => {
  it('sin evaluar queda «por decidir», sin implementación ni justificación', () => {
    const d = derivarDeclaracion({ ...base, entradas: [entrada('a.1', 1)] });
    expect(d.filas[0]).toMatchObject({ aplicabilidad: 'por_decidir', implementacion: null, justificacion: null, controles: [], cobertura: 'sin_control' });
    expect(d.resumen).toEqual({ total: 1, aplican: 0, noAplican: 0, porDecidir: 1, sinControl: 0, aprobable: false });
  });

  it.each([
    ['cumple', 'implementado'],
    ['parcial', 'parcial'],
    ['no_cumple', 'no_implementado'],
  ] as const)('%s aplica y queda %s', (estado, esperado) => {
    const d = derivarDeclaracion({ ...base, entradas: [entrada('a.1', 1)], evaluaciones: [ev('a.1', estado, 'un comentario que no se copia')] });
    expect(d.filas[0]).toMatchObject({ aplicabilidad: 'aplica', implementacion: esperado, justificacion: null });
  });

  it('no aplica usa el comentario como justificación y su cobertura es «no aplica»', () => {
    const d = derivarDeclaracion({ ...base, entradas: [entrada('a.1', 1)], evaluaciones: [ev('a.1', 'no_aplica', '  No desarrollamos software  ')], cobertura: [{ libreriaCodigo: L, idEstable: 'a.1', estado: 'sin_control' }] });
    expect(d.filas[0]).toMatchObject({ aplicabilidad: 'no_aplica', implementacion: null, justificacion: 'No desarrollamos software', cobertura: 'no_aplica' });
  });

  it('un «no aplica» sin justificación no se declara: queda por decidir', () => {
    for (const comentario of [null, '   ']) {
      const d = derivarDeclaracion({ ...base, entradas: [entrada('a.1', 1)], evaluaciones: [ev('a.1', 'no_aplica', comentario)] });
      expect(d.filas[0]).toMatchObject({ aplicabilidad: 'por_decidir', justificacion: null });
    }
  });

  it('lista los códigos de los controles vigentes, ordenados, y ignora los retirados', () => {
    const d = derivarDeclaracion({
      ...base,
      entradas: [entrada('a.1', 1)],
      evaluaciones: [ev('a.1', 'cumple')],
      controles: [
        { id: 'c1', codigo: 'C-010', vigente: true },
        { id: 'c2', codigo: 'C-002', vigente: true },
        { id: 'c3', codigo: 'C-003', vigente: false },
      ],
      mapeos: ['c1', 'c2', 'c3'].map((controlId) => ({ controlId, libreriaCodigo: L, idEstable: 'a.1' })),
      cobertura: [{ libreriaCodigo: L, idEstable: 'a.1', estado: 'cubierta' }],
    });
    expect(d.filas[0]).toMatchObject({ controles: ['C-002', 'C-010'], cobertura: 'cubierta' });
    expect(d.resumen.sinControl).toBe(0);
  });

  it('un control que aplica sin control de la empresa se cuenta en «sin control» pero se puede aprobar', () => {
    const d = derivarDeclaracion({ ...base, entradas: [entrada('a.1', 1), entrada('a.2', 2)], evaluaciones: [ev('a.1', 'cumple'), ev('a.2', 'no_aplica', 'No aplica a nuestro giro')] });
    expect(d.resumen).toEqual({ total: 2, aplican: 1, noAplican: 1, porDecidir: 0, sinControl: 1, aprobable: true });
  });

  it('no es aprobable sin filas ni con alguna por decidir', () => {
    expect(derivarDeclaracion({ ...base, entradas: [] }).resumen.aprobable).toBe(false);
    expect(derivarDeclaracion({ ...base, entradas: [entrada('a.1', 1), entrada('a.2', 2)], evaluaciones: [ev('a.1', 'cumple')] }).resumen.aprobable).toBe(false);
  });

  it('ordena por librería y orden, sin depender del orden de entrada', () => {
    const d = derivarDeclaracion({ ...base, entradas: [entrada('a.3', 3), entrada('a.1', 1), entrada('a.2', 2), entrada('z.1', 0, { libreriaCodigo: 'otra' })] });
    expect(d.filas.map((f) => `${f.libreriaCodigo}:${f.idEstable}`)).toEqual([`${L}:a.1`, `${L}:a.2`, `${L}:a.3`, 'otra:z.1']);
  });

  it('muestra como máximo 50 códigos pero cuenta con los reales', () => {
    const controles = Array.from({ length: 60 }, (_, i) => ({ id: `c${i}`, codigo: `C-${String(i).padStart(3, '0')}`, vigente: true }));
    const d = derivarDeclaracion({ ...base, entradas: [entrada('a.1', 1)], evaluaciones: [ev('a.1', 'cumple')], controles, mapeos: controles.map((c) => ({ controlId: c.id, libreriaCodigo: L, idEstable: 'a.1' })) });
    expect(d.filas[0]?.controles).toHaveLength(CONTROLES_POR_FILA_MAX);
    expect(d.resumen.sinControl).toBe(0);
  });

  it('una entrada con evaluación de otra librería no se mezcla', () => {
    const d = derivarDeclaracion({ ...base, entradas: [entrada('a.1', 1)], evaluaciones: [{ libreriaCodigo: 'otra', idEstable: 'a.1', estado: 'cumple', comentario: null }] });
    expect(d.filas[0]?.aplicabilidad).toBe('por_decidir');
  });

  it('es pura: no cambia lo que recibe', () => {
    const entradas = Object.freeze([Object.freeze(entrada('a.2', 2)), Object.freeze(entrada('a.1', 1))]);
    expect(() => derivarDeclaracion({ ...base, entradas })).not.toThrow();
  });
});
