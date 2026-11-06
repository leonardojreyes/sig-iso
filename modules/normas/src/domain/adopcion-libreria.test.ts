import { crearEmpresaId } from '@sig/tenancy';
import { describe, expect, it } from 'vitest';
import { AdopcionLibreria, adoptar } from './adopcion-libreria.js';
import { ErrorNormas } from './errores.js';

const A = crearEmpresaId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
const B = crearEmpresaId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
const LIB = '11111111-1111-4111-8111-111111111111';
const OTRA_LIB = '33333333-3333-4333-8333-333333333333';
const USUARIO = '44444444-4444-4444-8444-444444444444';
const ahora = new Date('2026-11-05T10:00:00.000Z');
const datos = { empresaId: A, libreriaId: LIB, usuarioId: USUARIO, ahora };

describe('adoptar (H4.7, H4.8)', () => {
  it('la primera vez crea la adopción y no es «ya adoptada»', () => {
    const r = adoptar(null, datos);
    expect(r.yaAdoptada).toBe(false);
    expect(r.adopcion).toMatchObject({ empresaId: A, libreriaId: LIB, adoptadaPor: USUARIO });
    expect(r.adopcion.adoptadaEn).toEqual(ahora);
  });

  it('adoptar otra vez devuelve la existente sin cambios y marca «ya adoptada» (no es un rechazo)', () => {
    const primera = adoptar(null, datos).adopcion;
    const r = adoptar(primera, { ...datos, usuarioId: '55555555-5555-4555-8555-555555555555', ahora: new Date('2027-01-01T00:00:00Z') });
    expect(r.yaAdoptada).toBe(true);
    expect(r.adopcion).toBe(primera);
    expect(r.adopcion.adoptadaPor).toBe(USUARIO);
    expect(r.adopcion.adoptadaEn).toEqual(ahora);
  });

  it('una adopción de otra empresa o de otra librería no cuenta como la existente (defensa en profundidad)', () => {
    const deB = AdopcionLibreria.crear({ ...datos, empresaId: B });
    const deOtra = AdopcionLibreria.crear({ ...datos, libreriaId: OTRA_LIB });
    for (const existente of [deB, deOtra]) {
      const e = (() => { try { adoptar(existente, datos); } catch (x) { return x; } })();
      expect(e).toBeInstanceOf(ErrorNormas);
    }
  });
});

describe('AdopcionLibreria.crear', () => {
  it('guarda una copia de la fecha: cambiarla fuera no altera la adopción', () => {
    const fecha = new Date(ahora);
    const a = AdopcionLibreria.crear({ ...datos, ahora: fecha });
    fecha.setFullYear(1999);
    expect(a.adoptadaEn).toEqual(ahora);
    a.adoptadaEn.setFullYear(1999);
    expect(a.adoptadaEn).toEqual(ahora);
  });
  it.each([
    ['empresaId', { empresaId: 'x' as never }],
    ['empresaId', { empresaId: '00000000-0000-0000-0000-000000000000' as never }],
    ['libreriaId', { libreriaId: 'x' }],
    ['usuarioId', { usuarioId: 'x' }],
    ['ahora', { ahora: new Date('no') }],
    ['ahora', { ahora: '2026-01-01' as never }],
  ])('rechaza un valor inválido de %s', (campo, cambio) => {
    const e = (() => { try { AdopcionLibreria.crear({ ...datos, ...cambio }); } catch (x) { return x as ErrorNormas; } })();
    expect(e).toBeInstanceOf(ErrorNormas);
    expect(e?.campo).toBe(campo);
  });
  it('está congelada', () => { expect(Object.isFrozen(AdopcionLibreria.crear(datos))).toBe(true); });
});
