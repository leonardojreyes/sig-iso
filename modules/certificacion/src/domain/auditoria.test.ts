import { describe, expect, it } from 'vitest';
import {
  admiteCambioDeAlcance,
  admiteEjecucion,
  codigoDeAuditoria,
  cuentaParaCobertura,
  esAuditoriaInmutable,
  esCombinada,
  ESTADOS_AUDITORIA,
  estadoTrasCambioDePrograma,
  motivoDeBloqueoDeTransicion,
  puedeTransitar,
  trimestreDe,
  validarAnio,
  validarFechas,
  validarMotivoCambio,
  validarObjetivo,
  type EstadoAuditoria,
} from './auditoria.js';
import { ErrorCertificacion } from './errores.js';

describe('estados de la auditoría', () => {
  it('solo avanza, paso a paso', () => {
    expect(puedeTransitar('planificada', 'en_preparacion')).toBe(true);
    expect(puedeTransitar('en_preparacion', 'en_ejecucion')).toBe(true);
    expect(puedeTransitar('en_ejecucion', 'informe_emitido')).toBe(true);
    expect(puedeTransitar('informe_emitido', 'cerrada')).toBe(true);
    expect(puedeTransitar('planificada', 'en_ejecucion')).toBe(false); // no se salta la preparación
    expect(puedeTransitar('en_ejecucion', 'en_preparacion')).toBe(false); // no retrocede
    expect(puedeTransitar('cerrada', 'en_ejecucion')).toBe(false);
  });

  it('se cancela hasta estar en ejecución; con informe emitido o cerrada, no; una cancelada no se reabre', () => {
    for (const e of ['planificada', 'en_preparacion', 'en_ejecucion'] as EstadoAuditoria[])
      expect(puedeTransitar(e, 'cancelada')).toBe(true);
    for (const e of ['informe_emitido', 'cerrada'] as EstadoAuditoria[]) expect(puedeTransitar(e, 'cancelada')).toBe(false);
    for (const e of ESTADOS_AUDITORIA) expect(puedeTransitar('cancelada', e)).toBe(false);
  });

  it('inmutables: informe emitido, cerrada y cancelada', () => {
    expect(ESTADOS_AUDITORIA.filter(esAuditoriaInmutable)).toEqual(['informe_emitido', 'cerrada', 'cancelada']);
  });

  it('el alcance y el equipo solo cambian antes de la ejecución; solo se evalúa en ejecución; solo las cerradas cuentan', () => {
    expect(ESTADOS_AUDITORIA.filter(admiteCambioDeAlcance)).toEqual(['planificada', 'en_preparacion']);
    expect(ESTADOS_AUDITORIA.filter(admiteEjecucion)).toEqual(['en_ejecucion']);
    expect(ESTADOS_AUDITORIA.filter(cuentaParaCobertura)).toEqual(['cerrada']);
  });
});

describe('reglas de fechas de la transición', () => {
  const base = { hoy: '2027-03-02', inicio: '2027-03-01', reunionApertura: '2027-03-01', reunionCierre: null as string | null };

  it('pasar a «en ejecución» exige haber llegado la fecha de inicio y la reunión de apertura', () => {
    expect(motivoDeBloqueoDeTransicion({ ...base, desde: 'en_preparacion', hasta: 'en_ejecucion' })).toBeNull();
    expect(motivoDeBloqueoDeTransicion({ ...base, desde: 'en_preparacion', hasta: 'en_ejecucion', hoy: '2027-02-28' })).toMatch(/inicio/);
    expect(motivoDeBloqueoDeTransicion({ ...base, desde: 'en_preparacion', hasta: 'en_ejecucion', reunionApertura: null })).toMatch(
      /apertura/,
    );
  });

  it('emitir el informe exige la fecha de la reunión de cierre', () => {
    expect(motivoDeBloqueoDeTransicion({ ...base, desde: 'en_ejecucion', hasta: 'informe_emitido' })).toMatch(/cierre/);
    expect(
      motivoDeBloqueoDeTransicion({ ...base, desde: 'en_ejecucion', hasta: 'informe_emitido', reunionCierre: '2027-03-05' }),
    ).toBeNull();
  });

  it('cerrar no es posible antes de la fecha de inicio', () => {
    expect(motivoDeBloqueoDeTransicion({ ...base, desde: 'informe_emitido', hasta: 'cerrada', hoy: '2027-01-01' })).toMatch(/inicio/);
    expect(motivoDeBloqueoDeTransicion({ ...base, desde: 'informe_emitido', hasta: 'cerrada' })).toBeNull();
  });

  it('una transición no permitida se explica, y la de una cancelada lo dice', () => {
    expect(motivoDeBloqueoDeTransicion({ ...base, desde: 'planificada', hasta: 'cerrada' })).toMatch(/no permitida/);
    expect(motivoDeBloqueoDeTransicion({ ...base, desde: 'cancelada', hasta: 'planificada' })).toMatch(/no se reabre/);
  });

  it('cancelar no pide fechas', () => {
    expect(motivoDeBloqueoDeTransicion({ ...base, desde: 'planificada', hasta: 'cancelada', reunionApertura: null })).toBeNull();
  });

  it('rechaza una fecha de hoy inexistente', () => {
    expect(() => motivoDeBloqueoDeTransicion({ ...base, desde: 'planificada', hasta: 'en_preparacion', hoy: '2027-13-01' })).toThrow(
      ErrorCertificacion,
    );
  });
});

describe('datos de la auditoría', () => {
  it('el código es correlativo por año', () => {
    expect(codigoDeAuditoria(2027, 1)).toBe('AI-2027-01');
    expect(codigoDeAuditoria(2027, 12)).toBe('AI-2027-12');
  });

  it('valida año, fechas y objetivo', () => {
    expect(validarAnio(2027)).toBe(2027);
    for (const mal of [1999, 2101, 2027.5, '2027', null]) expect(() => validarAnio(mal)).toThrow(ErrorCertificacion);
    expect(validarFechas('2027-03-01', '2027-03-01')).toEqual({ inicio: '2027-03-01', fin: '2027-03-01' });
    expect(() => validarFechas('2027-03-05', '2027-03-01')).toThrow(ErrorCertificacion);
    expect(() => validarFechas('2027-02-30', '2027-03-01')).toThrow(ErrorCertificacion);
    expect(validarObjetivo('  Verificar el SGSI  ')).toBe('Verificar el SGSI');
    expect(() => validarObjetivo('  ')).toThrow(ErrorCertificacion);
    expect(() => validarObjetivo('x'.repeat(501))).toThrow(ErrorCertificacion);
  });

  it('el motivo de cambio es una lista cerrada; «otro» exige la nota', () => {
    expect(validarMotivoCambio('sin_recursos', undefined)).toEqual({ motivo: 'sin_recursos', nota: null });
    expect(validarMotivoCambio('reprogramada', ' por vacaciones ')).toEqual({ motivo: 'reprogramada', nota: 'por vacaciones' });
    expect(() => validarMotivoCambio('inventado', null)).toThrow(ErrorCertificacion);
    expect(() => validarMotivoCambio('otro', null)).toThrow(ErrorCertificacion);
    expect(() => validarMotivoCambio('sin_recursos', 'x'.repeat(301))).toThrow(ErrorCertificacion);
    expect(() => validarMotivoCambio('sin_recursos', 5)).toThrow(ErrorCertificacion);
  });
});

describe('programa y combinadas', () => {
  it('un programa aprobado vuelve a «sin aprobar» si cambia el objetivo o las normas', () => {
    expect(estadoTrasCambioDePrograma('aprobado', true)).toBe('sin_aprobar');
    expect(estadoTrasCambioDePrograma('aprobado', false)).toBe('aprobado');
    expect(estadoTrasCambioDePrograma('sin_aprobar', true)).toBe('sin_aprobar');
  });

  it('es combinada con más de una norma distinta', () => {
    expect(esCombinada(['a', 'b'])).toBe(true);
    expect(esCombinada(['a', 'a'])).toBe(false);
    expect(esCombinada([])).toBe(false);
  });

  it('calcula el trimestre para la línea de tiempo', () => {
    expect(['2027-01-01', '2027-03-31', '2027-04-01', '2027-09-30', '2027-10-01', '2027-12-31'].map(trimestreDe)).toEqual([
      1, 1, 2, 3, 4, 4,
    ]);
    expect(() => trimestreDe('2027-00-10')).toThrow(ErrorCertificacion);
  });
});
