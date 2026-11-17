import { crearEmpresaId } from '@sig/tenancy';
import { describe, expect, it } from 'vitest';
import { ErrorCertificacion } from './errores.js';
import { MotivoInclusion, NOTA_MOTIVO_MAX } from './motivo-inclusion.js';

const EMPRESA = crearEmpresaId('aaaaaaaa-0000-4000-8000-0000000000e1');
const base = { empresaId: EMPRESA, libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1', tipo: 'legal', nota: 'Ley de protección de datos' } as const;
const falla = (cambio: Record<string, unknown>) => {
  try { MotivoInclusion.crear({ ...base, ...cambio } as never); } catch (e) { return e as ErrorCertificacion; }
  return undefined;
};

describe('MotivoInclusion', () => {
  it('acepta un motivo con nota, versión 1, y recorta la nota', () => {
    const m = MotivoInclusion.crear({ ...base, nota: '  Ley de protección de datos  ' });
    expect(m).toMatchObject({ tipo: 'legal', nota: 'Ley de protección de datos', version: 1, clave: 'iso-27001-2022-anexo-a|a27-5-1|legal' });
  });

  it('acepta los cuatro tipos registrables y rechaza «riesgo» (se deriva) y cualquier otro', () => {
    for (const tipo of ['legal', 'contractual', 'negocio', 'otro']) expect(falla({ tipo })).toBeUndefined();
    expect(falla({ tipo: 'riesgo' })?.campo).toBe('tipo');
    expect(falla({ tipo: 'x' })?.campo).toBe('tipo');
  });

  it('la nota es obligatoria, acotada y sin caracteres de control', () => {
    for (const nota of ['', '   ', 'x'.repeat(NOTA_MOTIVO_MAX + 1), 'a\u0000b', undefined, 7]) expect(falla({ nota })?.campo).toBe('nota');
    expect(falla({ nota: 'x'.repeat(NOTA_MOTIVO_MAX) })).toBeUndefined();
  });

  it('valida la librería, el id estable y la versión', () => {
    expect(falla({ libreriaCodigo: 'MAL CODIGO' })?.campo).toBe('libreriaCodigo');
    expect(falla({ idEstable: '' })?.campo).toBe('idEstable');
    expect(falla({ version: 0 })?.campo).toBe('version');
  });

  it('no incluye el valor recibido en el error', () => {
    expect(falla({ nota: 'x'.repeat(900) })?.message).not.toContain('xxxxx');
  });

  it('conNota sube la versión y devuelve el mismo motivo si la nota no cambia', () => {
    const m = MotivoInclusion.crear(base);
    expect(m.conNota('Contrato con el cliente')).toMatchObject({ nota: 'Contrato con el cliente', version: 2, tipo: 'legal' });
    expect(m.conNota('  Ley de protección de datos ')).toBe(m);
    expect(() => m.conNota('')).toThrow(ErrorCertificacion);
  });
});
