import { crearEmpresaId } from '@sig/tenancy';
import { describe, expect, it } from 'vitest';
import { ErrorCertificacion } from './errores.js';
import { ReferenciaTratamiento, TIPOS_REFERENCIA } from './referencia-tratamiento.js';

const EMPRESA = crearEmpresaId('aaaaaaaa-0000-4000-8000-0000000000e1');
const base = { empresaId: EMPRESA, norma: 'ISO/IEC 27001', tipo: 'plan', titulo: 'Plan de tratamiento 2026', versionDoc: '1.2', fecha: '2026-11-01', ubicacion: 'SIG-PL-004 (carpeta Calidad)' } as const;
const falla = (cambio: Record<string, unknown>) => {
  try { ReferenciaTratamiento.crear({ ...base, ...cambio } as never); } catch (e) { return e as ErrorCertificacion; }
  return undefined;
};

describe('ReferenciaTratamiento', () => {
  it('acepta una referencia completa, versión 1, y recorta los textos', () => {
    const r = ReferenciaTratamiento.crear({ ...base, titulo: '  Plan de tratamiento 2026 ' });
    expect(r).toMatchObject({ tipo: 'plan', titulo: 'Plan de tratamiento 2026', versionDoc: '1.2', fecha: '2026-11-01', version: 1 });
  });

  it('conoce el análisis y el plan, y nada más', () => {
    expect([...TIPOS_REFERENCIA]).toEqual(['analisis', 'plan']);
    expect(falla({ tipo: 'analisis' })).toBeUndefined();
    expect(falla({ tipo: 'otro' })?.campo).toBe('tipo');
  });

  it('todos los datos son obligatorios, acotados y sin caracteres de control', () => {
    for (const campo of ['titulo', 'versionDoc', 'ubicacion', 'norma']) {
      for (const valor of ['', '   ', 'x'.repeat(300), 'a\u0007b', undefined]) expect(falla({ [campo]: valor })?.campo).toBe(campo);
    }
  });

  it('la fecha debe existir en el calendario', () => {
    for (const fecha of ['2026-02-31', '01/11/2026', '2026-13-01', '', undefined]) expect(falla({ fecha })?.campo).toBe('fecha');
  });

  it('conDatos sube la versión y devuelve la misma referencia si nada cambia', () => {
    const r = ReferenciaTratamiento.crear(base);
    const igual = { titulo: base.titulo, versionDoc: base.versionDoc, fecha: base.fecha, ubicacion: base.ubicacion };
    expect(r.conDatos(igual)).toBe(r);
    expect(r.conDatos({ ...igual, versionDoc: '1.3' })).toMatchObject({ versionDoc: '1.3', version: 2, tipo: 'plan' });
    expect(() => r.conDatos({ ...igual, fecha: '2026-02-31' })).toThrow(ErrorCertificacion);
  });
});
