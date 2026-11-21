import { describe, expect, it } from 'vitest';
import { ErrorCertificacion } from './errores.js';
import { esNoConformidad, exigeLider, validarDatosHallazgo, validarEnunciado, validarEvidenciaHallazgo, validarMotivoAnulacion, validarTipoHallazgo } from './hallazgo.js';

const base = { procesoId: 'p1', libreriaCodigo: 'iso-27001', idEstable: 'c9-2', justificacionGravedad: null };

describe('hallazgos', () => {
  it('solo las no conformidades son incumplimientos; solo la mayor exige al líder', () => {
    expect(['nc_mayor', 'nc_menor', 'observacion', 'oportunidad'].map((t) => esNoConformidad(t as never))).toEqual([true, true, false, false]);
    expect(['nc_mayor', 'nc_menor', 'observacion', 'oportunidad'].map((t) => exigeLider(t as never))).toEqual([true, false, false, false]);
  });

  it('una NC exige proceso y requisito; la mayor, además, la justificación de la gravedad', () => {
    expect(validarDatosHallazgo({ ...base, tipo: 'nc_menor' })).toMatchObject({ tipo: 'nc_menor', justificacionGravedad: null });
    expect(() => validarDatosHallazgo({ ...base, tipo: 'nc_menor', procesoId: null })).toThrow(ErrorCertificacion);
    expect(() => validarDatosHallazgo({ ...base, tipo: 'nc_menor', libreriaCodigo: null, idEstable: null })).toThrow(ErrorCertificacion);
    expect(() => validarDatosHallazgo({ ...base, tipo: 'nc_mayor' })).toThrow(ErrorCertificacion);
    expect(validarDatosHallazgo({ ...base, tipo: 'nc_mayor', justificacionGravedad: ' falla todo el sistema ' }).justificacionGravedad).toBe('falla todo el sistema');
  });

  it('una observación o una oportunidad no llevan proceso obligatorio ni justificación de gravedad', () => {
    expect(validarDatosHallazgo({ tipo: 'observacion', procesoId: null, libreriaCodigo: null, idEstable: null, justificacionGravedad: null })).toMatchObject({ tipo: 'observacion' });
    expect(() => validarDatosHallazgo({ ...base, tipo: 'oportunidad', justificacionGravedad: 'x' })).toThrow(ErrorCertificacion);
    expect(() => validarDatosHallazgo({ ...base, tipo: 'nc_menor', justificacionGravedad: 'x' })).toThrow(ErrorCertificacion);
  });

  it('el requisito se da completo (librería e id estable) o no se da', () => {
    expect(() => validarDatosHallazgo({ ...base, tipo: 'observacion', idEstable: null })).toThrow(ErrorCertificacion);
  });

  it('tipo, enunciado, evidencia y motivo de anulación están acotados', () => {
    expect(validarTipoHallazgo('nc_mayor')).toBe('nc_mayor');
    expect(() => validarTipoHallazgo('NC')).toThrow(ErrorCertificacion);
    expect(validarEnunciado(' falta el acta ')).toBe('falta el acta');
    for (const mal of [undefined, '', '  ', 5, 'x'.repeat(501)]) expect(() => validarEnunciado(mal)).toThrow(ErrorCertificacion);
    for (const mal of [undefined, '', 'x'.repeat(1001)]) expect(() => validarEvidenciaHallazgo(mal)).toThrow(ErrorCertificacion);
    expect(validarMotivoAnulacion('duplicado')).toBe('duplicado');
    expect(() => validarMotivoAnulacion('otro_motivo')).toThrow(ErrorCertificacion);
  });
});
