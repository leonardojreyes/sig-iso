import { describe, expect, it } from 'vitest';
import { CONTROLES_POR_FILA_MAX, derivarDeclaracion, efectoDeRetirarRiesgo, type EntradaParaDeclaracion, type JustificacionParaDeclaracion, type RiesgoParaDeclaracion } from './declaracion.js';

const L = 'iso-27001-anexo-a';
const entrada = (id: string, orden: number, extra: Partial<EntradaParaDeclaracion> = {}): EntradaParaDeclaracion => ({ libreriaCodigo: L, idEstable: id, orden, titulo: `Título ${id}`, grupo: 'Organizacionales', ...extra });
const ev = (id: string, estado: 'cumple' | 'parcial' | 'no_cumple' | 'no_aplica', comentario: string | null = null) => ({ libreriaCodigo: L, idEstable: id, estado, comentario });
const base = { evaluaciones: [], controles: [], mapeos: [], cobertura: [] };

describe('derivarDeclaracion', () => {
  it('sin evaluar queda «por decidir», sin implementación ni justificación', () => {
    const d = derivarDeclaracion({ ...base, entradas: [entrada('a.1', 1)] });
    expect(d.filas[0]).toMatchObject({ aplicabilidad: 'por_decidir', implementacion: null, justificacion: null, controles: [], cobertura: 'sin_control' });
    expect(d.resumen).toEqual({ total: 1, aplican: 0, noAplican: 0, porDecidir: 1, sinControl: 0, conMotivo: 0, sinMotivo: 0, riesgosVigentes: 0, riesgosSinTratamiento: 0, bloqueos: ['por_decidir'], aprobable: false });
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
    expect(d.resumen).toEqual({ total: 2, aplican: 1, noAplican: 1, porDecidir: 0, sinControl: 1, conMotivo: 0, sinMotivo: 0, riesgosVigentes: 0, riesgosSinTratamiento: 0, bloqueos: [], aprobable: true });
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

// ADR 037: motivos de inclusión derivados y registrados, y bloqueo de la aprobación por falta de motivo.
const riesgo = (id: string, extra: Partial<RiesgoParaDeclaracion> = {}): RiesgoParaDeclaracion => ({ id, codigo: `R-${id.toUpperCase()}`, titulo: `Riesgo ${id}`, nivel: 'alto', decision: 'mitigar', vigente: true, ...extra });
const just = (p: Partial<JustificacionParaDeclaracion> = {}): JustificacionParaDeclaracion => ({ riesgos: [], vinculosControl: [], vinculosEntrada: [], motivos: [], ...p });
const ctl = (id: string, codigo: string, vigente = true) => ({ id, codigo, vigente });
const mapeo = (controlId: string, idEstable = 'a.1') => ({ controlId, libreriaCodigo: L, idEstable });
const motivo = (tipo: 'legal' | 'contractual' | 'negocio' | 'otro', nota: string, idEstable = 'a.1') => ({ libreriaCodigo: L, idEstable, tipo, nota });
const aplica = { entradas: [entrada('a.1', 1)], evaluaciones: [ev('a.1', 'cumple')] };

describe('derivarDeclaracion con justificación', () => {
  it('sin entregar la justificación no hay motivos ni bloqueo por motivo (comportamiento anterior)', () => {
    const d = derivarDeclaracion({ ...base, ...aplica });
    expect(d.filas[0]).toMatchObject({ motivos: [], riesgos: [], sinMotivo: false });
    expect(d.resumen).toMatchObject({ sinMotivo: 0, conMotivo: 0, aprobable: true });
  });

  it('un control que aplica sin riesgo ni motivo queda «sin motivo» y bloquea la aprobación', () => {
    const d = derivarDeclaracion({ ...base, ...aplica, justificacion: just() });
    expect(d.filas[0]?.sinMotivo).toBe(true);
    expect(d.resumen).toMatchObject({ conMotivo: 0, sinMotivo: 1, bloqueos: ['sin_motivo'], aprobable: false });
  });

  it('el motivo «riesgo» se deriva de un riesgo vigente tratado con un control vigente de la empresa que lo cubre', () => {
    const d = derivarDeclaracion({
      ...base, ...aplica, controles: [ctl('c1', 'C-001')], mapeos: [mapeo('c1')],
      justificacion: just({ riesgos: [riesgo('2'), riesgo('1', { nivel: 'critico' })], vinculosControl: [{ riesgoId: '2', controlId: 'c1' }, { riesgoId: '1', controlId: 'c1' }] }),
    });
    expect(d.filas[0]?.riesgos).toEqual([
      { codigo: 'R-1', titulo: 'Riesgo 1', nivel: 'critico', via: 'control' },
      { codigo: 'R-2', titulo: 'Riesgo 2', nivel: 'alto', via: 'control' },
    ]);
    expect(d.filas[0]?.sinMotivo).toBe(false);
    expect(d.resumen).toMatchObject({ conMotivo: 1, sinMotivo: 0, riesgosVigentes: 2, riesgosSinTratamiento: 0, aprobable: true });
  });

  it('un vínculo directo es «tratamiento previsto», cuenta como motivo y se distingue', () => {
    const d = derivarDeclaracion({ ...base, ...aplica, justificacion: just({ riesgos: [riesgo('1')], vinculosEntrada: [{ riesgoId: '1', libreriaCodigo: L, idEstable: 'a.1' }] }) });
    expect(d.filas[0]?.riesgos).toEqual([{ codigo: 'R-1', titulo: 'Riesgo 1', nivel: 'alto', via: 'previsto' }]);
    expect(d.resumen).toMatchObject({ conMotivo: 1, aprobable: true, riesgosSinTratamiento: 0 });
  });

  it('si el riesgo llega por ambos caminos se muestra una vez, por el control de la empresa', () => {
    const d = derivarDeclaracion({
      ...base, ...aplica, controles: [ctl('c1', 'C-001')], mapeos: [mapeo('c1')],
      justificacion: just({ riesgos: [riesgo('1')], vinculosControl: [{ riesgoId: '1', controlId: 'c1' }], vinculosEntrada: [{ riesgoId: '1', libreriaCodigo: L, idEstable: 'a.1' }] }),
    });
    expect(d.filas[0]?.riesgos).toHaveLength(1);
    expect(d.filas[0]?.riesgos[0]?.via).toBe('control');
  });

  it('un riesgo retirado no cuenta; tampoco por un control retirado', () => {
    const retirado = derivarDeclaracion({
      ...base, ...aplica, controles: [ctl('c1', 'C-001')], mapeos: [mapeo('c1')],
      justificacion: just({ riesgos: [riesgo('1', { vigente: false })], vinculosControl: [{ riesgoId: '1', controlId: 'c1' }], vinculosEntrada: [{ riesgoId: '1', libreriaCodigo: L, idEstable: 'a.1' }] }),
    });
    expect(retirado.filas[0]).toMatchObject({ riesgos: [], sinMotivo: true });
    expect(retirado.resumen.riesgosVigentes).toBe(0);
    const controlRetirado = derivarDeclaracion({
      ...base, ...aplica, controles: [ctl('c1', 'C-001', false)], mapeos: [mapeo('c1')],
      justificacion: just({ riesgos: [riesgo('1')], vinculosControl: [{ riesgoId: '1', controlId: 'c1' }] }),
    });
    expect(controlRetirado.filas[0]).toMatchObject({ riesgos: [], sinMotivo: true });
  });

  it('los motivos registrados cuentan, salen en el orden de la lista cerrada y llevan su nota', () => {
    const d = derivarDeclaracion({ ...base, ...aplica, justificacion: just({ motivos: [motivo('otro', 'Política propia'), motivo('legal', 'Ley de datos')] }) });
    expect(d.filas[0]?.motivos).toEqual([{ tipo: 'legal', nota: 'Ley de datos' }, { tipo: 'otro', nota: 'Política propia' }]);
    expect(d.resumen).toMatchObject({ conMotivo: 1, sinMotivo: 0, aprobable: true });
  });

  it('un control que no aplica o está por decidir no lleva motivos ni riesgos ni se pide motivo', () => {
    const d = derivarDeclaracion({
      ...base, entradas: [entrada('a.1', 1), entrada('a.2', 2), entrada('a.3', 3)],
      evaluaciones: [ev('a.1', 'no_aplica', 'No aplica a nuestro giro'), ev('a.2', 'cumple')],
      justificacion: just({ motivos: [motivo('legal', 'x', 'a.1'), motivo('legal', 'x', 'a.3')], riesgos: [riesgo('1')], vinculosEntrada: [{ riesgoId: '1', libreriaCodigo: L, idEstable: 'a.1' }, { riesgoId: '1', libreriaCodigo: L, idEstable: 'a.3' }] }),
    });
    expect(d.filas.map((f) => [f.motivos.length, f.riesgos.length, f.sinMotivo])).toEqual([[0, 0, false], [0, 0, true], [0, 0, false]]);
    expect(d.resumen).toMatchObject({ aplican: 1, sinMotivo: 1, bloqueos: ['por_decidir', 'sin_motivo'] });
  });

  it('advertencia (no bloqueo): riesgos «mitigar» sin control ni tratamiento previsto', () => {
    const d = derivarDeclaracion({
      ...base, ...aplica, controles: [ctl('c1', 'C-001', false)], mapeos: [mapeo('c1')],
      justificacion: just({
        motivos: [motivo('negocio', 'Necesidad del negocio')],
        riesgos: [riesgo('1'), riesgo('2', { decision: 'aceptar' }), riesgo('3'), riesgo('4', { vigente: false })],
        vinculosControl: [{ riesgoId: '1', controlId: 'c1' }], // control retirado: no cuenta
        vinculosEntrada: [{ riesgoId: '3', libreriaCodigo: 'otra', idEstable: 'x' }], // previsto en otra entrada: sí cuenta como tratamiento
      }),
    });
    expect(d.resumen).toMatchObject({ riesgosVigentes: 3, riesgosSinTratamiento: 1, aprobable: true, bloqueos: [] });
  });

  it('con una librería que no es el Anexo A, los vínculos de otra librería no se mezclan', () => {
    const d = derivarDeclaracion({ ...base, ...aplica, justificacion: just({ riesgos: [riesgo('1')], vinculosEntrada: [{ riesgoId: '1', libreriaCodigo: 'otra', idEstable: 'a.1' }] }) });
    expect(d.filas[0]?.sinMotivo).toBe(true);
  });

  it('no cambia lo que recibe', () => {
    const justificacion = Object.freeze(just({ riesgos: [Object.freeze(riesgo('1'))], motivos: [Object.freeze(motivo('legal', 'x'))] }));
    expect(() => derivarDeclaracion({ ...base, ...aplica, justificacion })).not.toThrow();
  });
});

describe('efectoDeRetirarRiesgo (aviso previo al retiro)', () => {
  const dos = { ...base, entradas: [entrada('a.1', 1), entrada('a.2', 2), entrada('a.3', 3), entrada('a.4', 4)], evaluaciones: ['a.1', 'a.2', 'a.3', 'a.4'].map((i) => ev(i, 'cumple')) };
  const previstos = (riesgoId: string, ...ids: string[]) => ids.map((idEstable) => ({ riesgoId, libreriaCodigo: L, idEstable }));

  it('lista solo los controles que quedarían sin motivo: sin otro riesgo vigente ni motivo registrado', () => {
    const justificacion = just({
      riesgos: [riesgo('1'), riesgo('2')],
      vinculosEntrada: [...previstos('1', 'a.1', 'a.2', 'a.3'), ...previstos('2', 'a.3')], // a.3 también lo trata el riesgo 2
      motivos: [motivo('legal', 'Ley', 'a.2')], // a.2 tiene motivo registrado
    });
    expect(efectoDeRetirarRiesgo({ ...dos, justificacion }, '1')).toEqual([{ libreriaCodigo: L, idEstable: 'a.1', titulo: 'Título a.1' }]);
  });

  it('no repite los que ya estaban sin motivo y no cambia lo recibido', () => {
    const justificacion = Object.freeze(just({ riesgos: [riesgo('1')], vinculosEntrada: previstos('1', 'a.1') }));
    const e = efectoDeRetirarRiesgo({ ...dos, justificacion }, '1');
    expect(e.map((x) => x.idEstable)).toEqual(['a.1']); // a.2 a a.4 ya estaban sin motivo
    expect(justificacion.riesgos[0]?.vigente).toBe(true);
  });

  it('un riesgo que no sostiene ningún motivo, o que no existe, no afecta a nadie', () => {
    const justificacion = just({ riesgos: [riesgo('1')], vinculosEntrada: previstos('1', 'a.1') });
    expect(efectoDeRetirarRiesgo({ ...dos, justificacion: just({ riesgos: [riesgo('1')] }) }, '1')).toEqual([]);
    expect(efectoDeRetirarRiesgo({ ...dos, justificacion }, 'no-existe')).toEqual([]);
  });
});
