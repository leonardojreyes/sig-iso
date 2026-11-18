import { describe, expect, it } from 'vitest';
import { validarAvisoRetiroRiesgo, validarRiesgoDetalle, validarRiesgos } from './validadores';

const R1 = 'eeeeeeee-1111-4111-8111-111111111111';
const R2 = 'eeeeeeee-2222-4222-8222-222222222222';
const C1 = 'cccccccc-1111-4111-8111-111111111111';
const U = '11111111-1111-4111-8111-1111111111a1';
const riesgo = (o: Record<string, unknown> = {}) => ({ id: R1, codigo: 'R-001', titulo: 'Pérdida de portátiles', descripcion: 'Robo o extravío.', probabilidad: 3, impacto: 4, puntaje: 12, nivel: 'alto', decision: 'mitigar', responsableId: null, estado: 'vigente', version: 1, ...o });
const listado = (o: Record<string, unknown> = {}) => ({ ...riesgo(), controles: 1, tratamientosPrevistos: 0, sinTratamiento: false, ...o });
const detalle = (o: Record<string, unknown> = {}) => ({ ...riesgo(), controles: [{ id: C1, codigo: 'C-001', nombre: 'Cifrado de discos', estado: 'vigente' }], tratamientosPrevistos: [{ libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1', titulo: 'Políticas de seguridad' }], ...o });

describe('validarRiesgos', () => {
  it('acepta una lista válida, vacía o con retirados, y calcula «sin tratamiento» solo para vigentes «mitigar» sin vínculos', () => {
    expect(validarRiesgos([])).toEqual([]);
    expect(validarRiesgos([listado(), listado({ id: R2, codigo: 'R-002', controles: 0, tratamientosPrevistos: 0, sinTratamiento: true })])).toHaveLength(2);
    expect(validarRiesgos([listado({ controles: 0, estado: 'retirado' })])).not.toBeNull(); // retirado: nunca «sin tratamiento»
    expect(validarRiesgos([listado({ decision: 'aceptar', responsableId: U, controles: 0 })])).not.toBeNull();
  });

  it.each([
    ['null', null],
    ['un objeto en vez de una lista', {}],
    ['más de 500', Array.from({ length: 501 }, (_, i) => listado({ id: `eeeeeeee-0000-4000-8000-${String(i).padStart(12, '0')}`, codigo: `R-${String(i + 1).padStart(3, '0')}` }))],
    ['una clave de más', [{ ...listado(), extra: 1 }]],
    ['sin una clave', [(() => { const r: Record<string, unknown> = listado(); delete r.sinTratamiento; return r; })()]],
    ['un puntaje que no es probabilidad por impacto', [listado({ puntaje: 13 })]],
    ['una probabilidad fuera de 1 a 5', [listado({ probabilidad: 6, puntaje: 24 })]],
    ['un impacto cero', [listado({ impacto: 0, puntaje: 0 })]],
    ['un código mal formado', [listado({ codigo: 'riesgo 1' })]],
    ['un nivel o una decisión desconocidos', [listado({ nivel: 'extremo' })], ],
    ['una decisión desconocida', [listado({ decision: 'ignorar' })]],
    ['«aceptar» sin responsable', [listado({ decision: 'aceptar', responsableId: null })]],
    ['un responsable que no es un UUID', [listado({ responsableId: 'Ana Pérez' })]],
    ['un estado desconocido', [listado({ estado: 'borrado' })]],
    ['un título vacío o de más de 120', [listado({ titulo: '' })]],
    ['una descripción de más de 1000', [listado({ descripcion: 'x'.repeat(1001) })]],
    ['una versión cero', [listado({ version: 0 })]],
    ['«sin tratamiento» que miente (hay un control)', [listado({ sinTratamiento: true })]],
    ['«sin tratamiento» que miente (no se mitiga)', [listado({ decision: 'transferir', controles: 0, sinTratamiento: true })]],
    ['más de 50 controles', [listado({ controles: 51 })]],
    ['un código repetido', [listado(), listado({ id: R2 })]],
  ])('rechaza %s', (_n, cuerpo) => expect(validarRiesgos(cuerpo)).toBeNull());
});

describe('validarRiesgoDetalle', () => {
  it('acepta un detalle con controles (también retirados) y tratamientos previstos, con o sin título', () => {
    expect(validarRiesgoDetalle(detalle())).not.toBeNull();
    expect(validarRiesgoDetalle(detalle({ controles: [], tratamientosPrevistos: [] }))).not.toBeNull();
    expect(validarRiesgoDetalle(detalle({ controles: [{ id: C1, codigo: 'C-001', nombre: 'x', estado: 'retirado' }] }))).not.toBeNull();
    expect(validarRiesgoDetalle(detalle({ tratamientosPrevistos: [{ libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1', titulo: null }] }))).not.toBeNull();
  });

  it.each([
    ['null', null],
    ['una clave de más', detalle({ extra: 1 })],
    ['sin los controles', (() => { const r: Record<string, unknown> = detalle(); delete r.controles; return r; })()],
    ['un control con clave de más', detalle({ controles: [{ id: C1, codigo: 'C-001', nombre: 'x', estado: 'vigente', extra: 1 }] })],
    ['un control con código con marcado', detalle({ controles: [{ id: C1, codigo: '<img src=x>', nombre: 'x', estado: 'vigente' }] })],
    ['un control con estado desconocido', detalle({ controles: [{ id: C1, codigo: 'C-001', nombre: 'x', estado: 'raro' }] })],
    ['un control repetido', detalle({ controles: [{ id: C1, codigo: 'C-001', nombre: 'x', estado: 'vigente' }, { id: C1, codigo: 'C-002', nombre: 'y', estado: 'vigente' }] })],
    ['más de 50 controles', detalle({ controles: Array.from({ length: 51 }, (_, i) => ({ id: `cccccccc-0000-4000-8000-${String(i).padStart(12, '0')}`, codigo: `C-${i}`, nombre: 'x', estado: 'vigente' })) })],
    ['un tratamiento con identificador mal formado', detalle({ tratamientosPrevistos: [{ libreriaCodigo: 'MAL CODIGO', idEstable: 'a27-5-1', titulo: null }] })],
    ['un tratamiento con título vacío', detalle({ tratamientosPrevistos: [{ libreriaCodigo: 'iso', idEstable: 'a27-5-1', titulo: '' }] })],
    ['un tratamiento repetido', detalle({ tratamientosPrevistos: [{ libreriaCodigo: 'iso', idEstable: 'a27-5-1', titulo: null }, { libreriaCodigo: 'iso', idEstable: 'a27-5-1', titulo: null }] })],
    ['un puntaje incoherente', detalle({ puntaje: 1 })],
  ])('rechaza %s', (_n, cuerpo) => expect(validarRiesgoDetalle(cuerpo)).toBeNull());
});

describe('validarAvisoRetiroRiesgo', () => {
  const aviso = (o: Record<string, unknown> = {}) => ({ riesgoId: R1, codigo: 'R-001', controlesSinMotivo: [{ libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1', titulo: 'Políticas de seguridad' }], ...o });
  it('acepta un aviso con controles y uno vacío', () => {
    expect(validarAvisoRetiroRiesgo(aviso())).not.toBeNull();
    expect(validarAvisoRetiroRiesgo(aviso({ controlesSinMotivo: [] }))).not.toBeNull();
  });
  it.each([
    ['null', null],
    ['una clave de más', aviso({ extra: 1 })],
    ['un riesgo sin UUID', aviso({ riesgoId: 'x' })],
    ['un código mal formado', aviso({ codigo: 'R1' })],
    ['un control sin título', aviso({ controlesSinMotivo: [{ libreriaCodigo: 'iso', idEstable: 'a27-5-1', titulo: '' }] })],
    ['un control repetido', aviso({ controlesSinMotivo: [{ libreriaCodigo: 'iso', idEstable: 'a27-5-1', titulo: 'x' }, { libreriaCodigo: 'iso', idEstable: 'a27-5-1', titulo: 'y' }] })],
    ['más de 500 controles', aviso({ controlesSinMotivo: Array.from({ length: 501 }, (_, i) => ({ libreriaCodigo: 'iso', idEstable: `a${i}`, titulo: 'x' })) })],
  ])('rechaza %s', (_n, cuerpo) => expect(validarAvisoRetiroRiesgo(cuerpo)).toBeNull());
});
