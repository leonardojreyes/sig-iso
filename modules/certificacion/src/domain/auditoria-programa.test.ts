import { describe, expect, it } from 'vitest';
import { calcularPendientesDePrograma, validarCapitulo, validarMotivoExclusion } from './auditoria-programa.js';
import { ErrorCertificacion } from './errores.js';

const capitulosPorNorma = new Map([
  ['iso-27001', ['4', '9', 'Organizacionales']],
  ['iso-9001', ['8']],
]);
const base = { procesosVigentes: ['p1', 'p2', 'p3'], capitulosPorNorma, auditorias: [], exclusiones: [] };

describe('pendientes del programa anual', () => {
  it('sin auditorías todo está pendiente de incluir o de justificar', () => {
    const r = calcularPendientesDePrograma(base);
    expect(r.procesosSinMotivo).toEqual(['p1', 'p2', 'p3']);
    expect(r.capitulosSinMotivo).toHaveLength(4);
    expect(r).toMatchObject({ procesosIncluidos: 0, capitulosIncluidos: 0 });
  });

  it('una auditoría sin capítulos indicados cubre todos los de sus normas', () => {
    const r = calcularPendientesDePrograma({ ...base, auditorias: [{ estado: 'planificada', normas: ['iso-27001'], procesosIds: ['p1'], capitulos: [] }] });
    expect(r.capitulosSinMotivo).toEqual([{ libreriaCodigo: 'iso-9001', capitulo: '8' }]);
    expect(r.procesosSinMotivo).toEqual(['p2', 'p3']);
    expect(r).toMatchObject({ procesosIncluidos: 1, capitulosIncluidos: 3 });
  });

  it('con capítulos indicados solo cubre esos', () => {
    const r = calcularPendientesDePrograma({
      ...base,
      auditorias: [{ estado: 'en_ejecucion', normas: ['iso-27001'], procesosIds: [], capitulos: [{ libreriaCodigo: 'iso-27001', capitulo: '9' }] }],
    });
    expect(r.capitulosSinMotivo.map((c) => `${c.libreriaCodigo}:${c.capitulo}`)).toEqual(['iso-27001:4', 'iso-27001:Organizacionales', 'iso-9001:8']);
  });

  it('una auditoría cancelada no cuenta', () => {
    const r = calcularPendientesDePrograma({ ...base, auditorias: [{ estado: 'cancelada', normas: ['iso-27001'], procesosIds: ['p1'], capitulos: [] }] });
    expect(r.procesosSinMotivo).toEqual(['p1', 'p2', 'p3']);
    expect(r.capitulosIncluidos).toBe(0);
  });

  it('un motivo de exclusión justifica lo que no entra al año', () => {
    const r = calcularPendientesDePrograma({
      ...base,
      exclusiones: [
        { tipo: 'proceso', procesoId: 'p2', libreriaCodigo: null, capitulo: null },
        { tipo: 'capitulo', procesoId: null, libreriaCodigo: 'iso-9001', capitulo: '8' },
      ],
      auditorias: [{ estado: 'planificada', normas: ['iso-27001'], procesosIds: ['p1'], capitulos: [] }],
    });
    expect(r.procesosSinMotivo).toEqual(['p3']);
    expect(r.capitulosSinMotivo).toEqual([]);
  });
});

describe('motivos y capítulos', () => {
  it('el motivo es obligatorio y acotado', () => {
    expect(validarMotivoExclusion(' auditado el año pasado ')).toBe('auditado el año pasado');
    for (const mal of [undefined, '', '  ', 5, 'x'.repeat(301)]) expect(() => validarMotivoExclusion(mal)).toThrow(ErrorCertificacion);
  });
  it('el capítulo es un texto breve', () => {
    expect(validarCapitulo(' 9 ')).toBe('9');
    for (const mal of [undefined, '', 5, 'x'.repeat(61)]) expect(() => validarCapitulo(mal)).toThrow(ErrorCertificacion);
  });
});
