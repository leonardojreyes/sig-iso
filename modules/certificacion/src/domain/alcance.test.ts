import { crearEmpresaId } from '@sig/tenancy';
import { describe, expect, it } from 'vitest';
import { Alcance } from './alcance.js';
import { ErrorCertificacion } from './errores.js';

const EMPRESA = crearEmpresaId('aaaaaaaa-0000-4000-8000-0000000000e2');
const ADMIN = '33333333-3333-4333-8333-333333333333';
const OTRA = '44444444-4444-4444-8444-444444444444';
const T0 = new Date('2026-11-10T10:00:00Z');
const T1 = new Date('2026-11-10T11:00:00Z');
const base = { empresaId: EMPRESA, norma: 'ISO/IEC 27001', texto: 'Los sistemas de información de la oficina de Quito.', actualizadoPor: ADMIN, actualizadoEn: T0 };

describe('Alcance', () => {
  it('nace sin aprobar', () => {
    const a = Alcance.crear(base);
    expect(a.aprobado).toBe(false);
    expect(a.aprobadoPor).toBeNull();
  });

  it('aprobar fija quién y cuándo, y el alcance queda aprobado', () => {
    const a = Alcance.crear(base).aprobar(ADMIN, T1);
    expect(a).toMatchObject({ aprobado: true, aprobadoPor: ADMIN, aprobadoEn: T1 });
  });

  it('no se puede aprobar dos veces', () => {
    expect(() => Alcance.crear(base).aprobar(ADMIN, T1).aprobar(OTRA, T1)).toThrow(ErrorCertificacion);
  });

  it('cambiar el texto de un alcance aprobado lo devuelve a «sin aprobar»', () => {
    const a = Alcance.crear(base).aprobar(ADMIN, T1).conTexto('Todo el SIG de SynapTech.', OTRA, T1);
    expect(a).toMatchObject({ texto: 'Todo el SIG de SynapTech.', aprobado: false, actualizadoPor: OTRA });
  });

  it('con el mismo texto (aun con espacios de más) no cambia nada y conserva la aprobación', () => {
    const aprobado = Alcance.crear(base).aprobar(ADMIN, T1);
    expect(aprobado.conTexto('  ' + base.texto + '  ', OTRA, T1)).toBe(aprobado);
  });

  it.each([['texto vacío', { texto: '   ' }], ['texto demasiado largo', { texto: 'x'.repeat(4001) }], ['texto con caracteres de control', { texto: 'a\u0000b' }],
    ['norma vacía', { norma: '' }], ['norma con comodines', { norma: 'ISO%' }], ['persona que no es UUID', { actualizadoPor: 'x' }],
    ['aprobador sin fecha', { aprobadoPor: ADMIN }], ['fecha sin aprobador', { aprobadoEn: T1 }]])('rechaza %s', (_n, cambio) => {
    expect(() => Alcance.crear({ ...base, ...cambio } as never)).toThrow(ErrorCertificacion);
  });

  it('es inmutable y aprobar no modifica el original', () => {
    const a = Alcance.crear(base);
    a.aprobar(ADMIN, T1);
    expect(a.aprobado).toBe(false);
    expect(Object.isFrozen(a)).toBe(true);
  });
});
