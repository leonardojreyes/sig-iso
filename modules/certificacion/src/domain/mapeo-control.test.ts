import { crearEmpresaId } from '@sig/tenancy';
import { describe, expect, it } from 'vitest';
import { ErrorCertificacion } from './errores.js';
import { MapeoControl } from './mapeo-control.js';

const EMPRESA = crearEmpresaId('aaaaaaaa-0000-4000-8000-0000000000e1');
const CONTROL = 'cccccccc-1111-4111-8111-111111111111';
const base = { empresaId: EMPRESA, controlId: CONTROL, libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1' };
const falla = (cambio: Record<string, unknown>) => {
  try { MapeoControl.crear({ ...base, ...cambio } as never); } catch (e) { return e as ErrorCertificacion; }
  return undefined;
};

describe('MapeoControl', () => {
  it('acepta un mapeo y arma la clave de la entrada (igual que la evaluación)', () => {
    const m = MapeoControl.crear(base);
    expect(m).toMatchObject(base);
    expect(m.claveEntrada).toBe('iso-27001-2022-anexo-a|a27-5-1');
  });

  it('normaliza el control a minúsculas', () => {
    expect(MapeoControl.crear({ ...base, controlId: CONTROL.toUpperCase() }).controlId).toBe(CONTROL);
  });

  it.each([
    ['control que no es UUID', { controlId: 'x' }], ['código de librería con mayúsculas', { libreriaCodigo: 'ISO' }],
    ['código de librería vacío', { libreriaCodigo: '' }], ['id con espacios', { idEstable: 'a 1' }],
    ['id con ruta', { idEstable: '../x' }], ['id demasiado largo', { idEstable: 'a'.repeat(42) }], ['id que no es texto', { idEstable: 5 }],
  ])('rechaza %s', (_n, cambio) => {
    expect(falla(cambio)).toBeInstanceOf(ErrorCertificacion);
  });

  it('dos mapeos iguales tienen la misma clave (sirve para detectar duplicados)', () => {
    expect(MapeoControl.crear(base).clave).toBe(MapeoControl.crear(base).clave);
    expect(MapeoControl.crear(base).clave).not.toBe(MapeoControl.crear({ ...base, idEstable: 'a27-5-2' }).clave);
  });
});
