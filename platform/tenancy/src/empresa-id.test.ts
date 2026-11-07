import { describe, expect, it } from 'vitest';
import { crearEmpresaId, EmpresaIdInvalidoError, esEmpresaId } from './empresa-id';

const UUID = '3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c';

describe('crearEmpresaId', () => {
  it('acepta un UUID válido y lo devuelve como EmpresaId', () => {
    expect(crearEmpresaId(UUID)).toBe(UUID);
  });

  it('normaliza a minúsculas', () => {
    expect(crearEmpresaId(UUID.toUpperCase())).toBe(UUID);
  });

  it('acepta cualquier versión de UUID (4, 7, etc.)', () => {
    expect(crearEmpresaId('0190a5b2-7c3e-7a1d-9f40-123456789abc')).toBe('0190a5b2-7c3e-7a1d-9f40-123456789abc');
  });

  it.each([
    ['cadena vacía', ''],
    ['solo espacios', '   '],
    ['texto cualquiera', 'empresa-a'],
    ['UUID sin guiones', '3f2b8c1e9a4d4e7b8c215d6e7f8a9b0c'],
    ['UUID con llaves', `{${UUID}}`],
    ['UUID con espacios alrededor', ` ${UUID} `],
    ['UUID incompleto', UUID.slice(0, -1)],
    ['UUID con caracteres no hexadecimales', UUID.replace('3f2b', 'zzzz')],
    ['UUID nulo (todo ceros)', '00000000-0000-0000-0000-000000000000'],
    ['intento de inyección SQL', `${UUID}'; select 1 --`],
  ])('rechaza %s', (_nombre, valor) => {
    expect(() => crearEmpresaId(valor)).toThrow(EmpresaIdInvalidoError);
  });

  it.each([undefined, null, 42, {}, [], true])('rechaza un valor que no es texto: %s', (valor) => {
    expect(() => crearEmpresaId(valor)).toThrow(EmpresaIdInvalidoError);
  });

  it('el error no repite el valor recibido (podría ser dato sensible)', () => {
    try {
      crearEmpresaId('secreto-que-no-debe-filtrarse');
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).not.toContain('secreto-que-no-debe-filtrarse');
    }
  });
});

describe('esEmpresaId', () => {
  it('distingue valores válidos de inválidos sin lanzar', () => {
    expect(esEmpresaId(UUID)).toBe(true);
    expect(esEmpresaId('nope')).toBe(false);
    expect(esEmpresaId(undefined)).toBe(false);
  });
});
