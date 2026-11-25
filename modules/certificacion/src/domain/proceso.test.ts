import { describe, expect, it } from 'vitest';
import { ErrorCertificacion } from './errores.js';
import {
  codigoDeProceso,
  validarCambioRelevante,
  validarDescripcionProceso,
  validarFrecuencia,
  validarImportancia,
  validarNombreProceso,
  validarRelacion,
} from './proceso.js';

describe('proceso', () => {
  it('el código es correlativo por empresa', () => {
    expect(codigoDeProceso(1)).toBe('PR-001');
    expect(codigoDeProceso(42)).toBe('PR-042');
  });

  it('el nombre es obligatorio, sin espacios sobrantes y acotado', () => {
    expect(validarNombreProceso('  Compras  ')).toBe('Compras');
    for (const mal of [undefined, null, '', '   ', 5, 'x'.repeat(121), 'a\u0000b']) expect(() => validarNombreProceso(mal)).toThrow(ErrorCertificacion);
  });

  it('la descripción es opcional y acotada', () => {
    expect(validarDescripcionProceso(undefined)).toBeNull();
    expect(validarDescripcionProceso('  ')).toBeNull();
    expect(validarDescripcionProceso(' Gestiona compras ')).toBe('Gestiona compras');
    expect(() => validarDescripcionProceso('x'.repeat(301))).toThrow(ErrorCertificacion);
    expect(() => validarDescripcionProceso(5)).toThrow(ErrorCertificacion);
  });

  it('importancia, frecuencia, relación y cambio relevante son listas cerradas', () => {
    expect(validarImportancia('alta')).toBe('alta');
    expect(validarFrecuencia('cada_dos_anios')).toBe('cada_dos_anios');
    expect(validarRelacion('diseno')).toBe('diseno');
    expect(validarCambioRelevante('incidente')).toBe('incidente');
    expect(validarCambioRelevante(null)).toBeNull();
    expect(() => validarImportancia('muy_alta')).toThrow(ErrorCertificacion);
    expect(() => validarFrecuencia('mensual')).toThrow(ErrorCertificacion);
    expect(() => validarRelacion('dueña')).toThrow(ErrorCertificacion);
    expect(() => validarCambioRelevante('otro')).toThrow(ErrorCertificacion);
  });

  it('el error nombra el campo y nunca el valor recibido', () => {
    try {
      validarImportancia('secreto-123');
    } catch (e) {
      expect((e as ErrorCertificacion).campo).toBe('importancia');
      expect((e as Error).message).not.toContain('secreto');
    }
  });
});
