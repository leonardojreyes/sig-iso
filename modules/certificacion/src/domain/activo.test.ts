import { crearEmpresaId } from '@sig/tenancy';
import { describe, expect, it } from 'vitest';
import { Activo, CLASIFICACIONES_ACTIVO, codigoDeActivo, numeroDeActivo, TIPOS_ACTIVO } from './activo.js';
import { ErrorCertificacion } from './errores.js';

const EMPRESA = crearEmpresaId('aaaaaaaa-0000-4000-8000-0000000000e1');
const ID = 'cccccccc-1111-4111-8111-111111111111';
const PERSONA = '22222222-2222-4222-8222-222222222222';
const OTRA = '33333333-3333-4333-8333-333333333333';
const base = { id: ID, empresaId: EMPRESA, codigo: 'A-001', nombre: 'Base de clientes', tipo: 'informacion', clasificacion: 'confidencial', responsableId: PERSONA } as const;
const falla = (cambio: Record<string, unknown>) => {
  try {
    Activo.crear({ ...base, ...cambio } as never);
  } catch (e) {
    return e as ErrorCertificacion;
  }
  return undefined;
};

describe('código del activo', () => {
  it('se deriva del número y vuelve a él', () => {
    expect(codigoDeActivo(1)).toBe('A-001');
    expect(codigoDeActivo(42)).toBe('A-042');
    expect(codigoDeActivo(1000)).toBe('A-1000');
    expect(numeroDeActivo('A-042')).toBe(42);
    expect(numeroDeActivo('A-1000')).toBe(1000);
  });
  it('rechaza números y códigos que no son del sistema', () => {
    for (const n of [0, -1, 1.5, Number.NaN, 1_000_000]) expect(() => codigoDeActivo(n)).toThrow(ErrorCertificacion);
    for (const c of ['R-001', 'A-1', 'a-001', 'A-001x', '', 'A-']) expect(() => numeroDeActivo(c)).toThrow(ErrorCertificacion);
  });
});

describe('Activo.crear', () => {
  it('crea un activo vigente con versión 1 y datos normalizados', () => {
    const a = Activo.crear({ ...base, nombre: '  Base de clientes  ', descripcion: '  Datos de contacto  ' });
    expect(a).toMatchObject({ codigo: 'A-001', nombre: 'Base de clientes', descripcion: 'Datos de contacto', estado: 'vigente', version: 1, vigente: true });
    expect(a.responsableId).toBe(PERSONA);
    expect(Object.isFrozen(a)).toBe(true);
  });
  it('acepta todos los tipos y clasificaciones cerrados', () => {
    expect(TIPOS_ACTIVO).toEqual(['informacion', 'aplicacion_sistema', 'infraestructura', 'persona', 'servicio_terceros', 'instalacion']);
    expect(CLASIFICACIONES_ACTIVO).toEqual(['publica', 'interna', 'confidencial', 'restringida']);
    for (const tipo of TIPOS_ACTIVO) expect(falla({ tipo })).toBeUndefined();
    for (const clasificacion of CLASIFICACIONES_ACTIVO) expect(falla({ clasificacion })).toBeUndefined();
  });
  it('la descripción es opcional y vacía equivale a ninguna', () => {
    expect(Activo.crear(base).descripcion).toBeNull();
    expect(Activo.crear({ ...base, descripcion: '   ' }).descripcion).toBeNull();
  });
  it.each([
    ['nombre', { nombre: '' }],
    ['nombre', { nombre: '   ' }],
    ['nombre', { nombre: 'x'.repeat(121) }],
    ['nombre', { nombre: 'a‮b' }],
    ['nombre', { nombre: 7 }],
    ['descripcion', { descripcion: 'x'.repeat(501) }],
    ['descripcion', { descripcion: 'a​b' }],
    ['tipo', { tipo: 'otro' }],
    ['tipo', { tipo: undefined }],
    ['clasificacion', { clasificacion: 'secreta' }],
    ['responsableId', { responsableId: null }],
    ['responsableId', { responsableId: 'no-es-uuid' }],
    ['id', { id: 'x' }],
    ['codigo', { codigo: 'R-001' }],
    ['estado', { estado: 'borrado' }],
    ['version', { version: 0 }],
  ])('rechaza %s no válido', (campo, cambio) => {
    expect(falla(cambio)?.campo).toBe(campo);
  });
  it('el error nunca incluye el valor recibido', () => {
    expect(falla({ nombre: 'x'.repeat(121) })?.message).not.toContain('xxxx');
  });
});

describe('Activo.conCambios y retirar', () => {
  const a = Activo.crear(base);
  it('aplica cambios y sube la versión; sin cambios devuelve el mismo', () => {
    const b = a.conCambios({ nombre: 'Clientes', clasificacion: 'restringida', responsableId: OTRA, descripcion: 'Nueva' });
    expect(b).toMatchObject({ nombre: 'Clientes', clasificacion: 'restringida', responsableId: OTRA, descripcion: 'Nueva', version: 2, codigo: 'A-001' });
    expect(a.nombre).toBe('Base de clientes');
    expect(a.conCambios({})).toBe(a);
    expect(a.conCambios({ nombre: 'Base de clientes', tipo: 'informacion' })).toBe(a);
  });
  it('null o vacío quita la descripción; el responsable nunca se quita', () => {
    const c = Activo.crear({ ...base, descripcion: 'algo' });
    expect(c.conCambios({ descripcion: null }).descripcion).toBeNull();
    expect(c.conCambios({ descripcion: '' }).descripcion).toBeNull();
    expect(() => a.conCambios({ responsableId: null as never })).toThrow(ErrorCertificacion);
  });
  it('valida los cambios', () => {
    expect(() => a.conCambios({ tipo: 'otro' as never })).toThrow(ErrorCertificacion);
    expect(() => a.conCambios({ nombre: '' })).toThrow(ErrorCertificacion);
  });
  it('retirar deja el activo retirado con la versión siguiente; no se retira dos veces', () => {
    const r = a.retirar();
    expect(r).toMatchObject({ estado: 'retirado', vigente: false, version: 2 });
    expect(() => r.retirar()).toThrow(ErrorCertificacion);
  });
  it('un activo retirado ya no se cambia', () => {
    expect(() => a.retirar().conCambios({ nombre: 'otro' })).toThrow(ErrorCertificacion);
  });
});
