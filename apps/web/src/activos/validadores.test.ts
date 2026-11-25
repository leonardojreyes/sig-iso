import { describe, expect, it } from 'vitest';
import { validarActivo, validarActivoDetalle, validarActivos, validarAvisoRetiroActivo, validarListadoActivos } from './validadores';

const A1 = 'aaaaaaaa-1111-4111-8111-111111111111';
const A2 = 'aaaaaaaa-2222-4222-8222-222222222222';
const U1 = '11111111-1111-4111-8111-1111111111a1';
const R1 = 'dddddddd-1111-4111-8111-111111111111';
const activo = (o: Record<string, unknown> = {}) => ({ id: A1, codigo: 'A-001', nombre: 'Servidor', descripcion: null, tipo: 'infraestructura', clasificacion: 'interna', responsableId: U1, estado: 'vigente', version: 1, ...o });
const listado = (o: Record<string, unknown> = {}) => ({ ...activo(), riesgos: 1, sinRiesgos: false, ...o });

describe('validadores de activos', () => {
  it('acepta un activo y una lista válidos y rechaza campos de más, listas cerradas y códigos repetidos', () => {
    expect(validarActivo(activo())).not.toBeNull();
    expect(validarActivos([activo(), activo({ id: A2, codigo: 'A-002' })])).not.toBeNull();
    expect(validarActivo({ ...activo(), extra: 1 })).toBeNull();
    for (const mal of [{ tipo: 'cosa' }, { clasificacion: 'secreta' }, { codigo: 'a-1' }, { estado: 'borrado' }, { version: 0 }, { nombre: '' }, { responsableId: 'x' }, { descripcion: '' }]) expect(validarActivo(activo(mal)), JSON.stringify(mal)).toBeNull();
    expect(validarActivos([activo(), activo({ id: A2 })])).toBeNull(); // mismo código
  });
  it('el listado exige «sin riesgos» coherente con los riesgos y con el estado', () => {
    expect(validarListadoActivos([listado()])).not.toBeNull();
    expect(validarListadoActivos([listado({ riesgos: 0, sinRiesgos: true })])).not.toBeNull();
    expect(validarListadoActivos([listado({ riesgos: 0, sinRiesgos: false })])).toBeNull();
    expect(validarListadoActivos([listado({ riesgos: 2, sinRiesgos: true })])).toBeNull();
    expect(validarListadoActivos([listado({ estado: 'retirado', riesgos: 0, sinRiesgos: false })])).not.toBeNull(); // un retirado nunca es «sin riesgos»
    expect(validarListadoActivos([listado({ estado: 'retirado', riesgos: 0, sinRiesgos: true })])).toBeNull();
  });
  it('el detalle valida sus riesgos y el nivel más alto', () => {
    const riesgo = { id: R1, codigo: 'R-001', titulo: 'Pérdida', nivel: 'alto', puntaje: 12, estado: 'vigente' };
    expect(validarActivoDetalle({ ...activo(), riesgos: [riesgo], nivelMasAlto: 'alto' })).not.toBeNull();
    expect(validarActivoDetalle({ ...activo(), riesgos: [], nivelMasAlto: null })).not.toBeNull();
    expect(validarActivoDetalle({ ...activo(), riesgos: [riesgo, riesgo], nivelMasAlto: 'alto' })).toBeNull();
    expect(validarActivoDetalle({ ...activo(), riesgos: [{ ...riesgo, nivel: 'enorme' }], nivelMasAlto: 'alto' })).toBeNull();
    expect(validarActivoDetalle({ ...activo(), riesgos: [], nivelMasAlto: 'enorme' })).toBeNull();
  });
  it('el aviso de retiro lista solo códigos y títulos', () => {
    expect(validarAvisoRetiroActivo({ activoId: A1, codigo: 'A-001', riesgosSinActivo: [{ id: R1, codigo: 'R-001', titulo: 'Pérdida' }] })).not.toBeNull();
    expect(validarAvisoRetiroActivo({ activoId: A1, codigo: 'A-001', riesgosSinActivo: [{ id: R1, codigo: 'R-001', titulo: 'x', extra: 1 }] })).toBeNull();
    expect(validarAvisoRetiroActivo({ activoId: A1, codigo: 'malo', riesgosSinActivo: [] })).toBeNull();
  });
});
