import { crearEmpresaId } from '@sig/tenancy';
import { describe, expect, it } from 'vitest';
import { Control, MAPEOS_POR_CONTROL_MAX } from './control.js';
import { ErrorCertificacion } from './errores.js';

const EMPRESA = crearEmpresaId('aaaaaaaa-0000-4000-8000-0000000000e1');
const ID = 'cccccccc-1111-4111-8111-111111111111';
const PERSONA = '22222222-2222-4222-8222-222222222222';
const base = { id: ID, empresaId: EMPRESA, codigo: 'C-001', nombre: 'Política de contraseñas' };
const falla = (cambio: Record<string, unknown>) => {
  try { Control.crear({ ...base, ...cambio } as never); } catch (e) { return e as ErrorCertificacion; }
  return undefined;
};

describe('Control.crear', () => {
  it('acepta un control mínimo: vigente, versión 1 y opcionales nulos', () => {
    const c = Control.crear(base);
    expect(c).toMatchObject({ codigo: 'C-001', nombre: 'Política de contraseñas', descripcion: null, responsableId: null, estado: 'vigente', version: 1 });
    expect(c.vigente).toBe(true);
  });

  it('recorta nombre y descripción, y deja nula una descripción vacía', () => {
    const c = Control.crear({ ...base, nombre: '  Revisión de accesos  ', descripcion: '  Cada trimestre.  ' });
    expect(c.nombre).toBe('Revisión de accesos');
    expect(c.descripcion).toBe('Cada trimestre.');
    expect(Control.crear({ ...base, descripcion: '   ' }).descripcion).toBeNull();
  });

  it('normaliza el responsable a minúsculas', () => {
    expect(Control.crear({ ...base, responsableId: PERSONA.toUpperCase() }).responsableId).toBe(PERSONA);
  });

  it.each([
    ['código vacío', { codigo: '' }], ['código con espacios', { codigo: 'C 1' }], ['código que empieza con símbolo', { codigo: '-C1' }],
    ['código demasiado largo', { codigo: 'C'.repeat(21) }], ['código con barra', { codigo: 'C/1' }],
    ['nombre vacío', { nombre: '   ' }], ['nombre demasiado largo', { nombre: 'x'.repeat(121) }], ['nombre con caracteres de control', { nombre: 'hola\u0000' }],
    ['descripción demasiado larga', { descripcion: 'x'.repeat(1001) }], ['descripción con caracteres de control', { descripcion: 'a\u0007b' }],
    ['responsable que no es UUID', { responsableId: 'x' }], ['id que no es UUID', { id: 'x' }],
    ['estado desconocido', { estado: 'borrado' }], ['versión cero', { version: 0 }], ['versión con decimales', { version: 1.5 }],
    ['nombre que no es texto', { nombre: 7 }],
  ])('rechaza %s', (_n, cambio) => {
    expect(falla(cambio)).toBeInstanceOf(ErrorCertificacion);
  });

  it('el código distingue mayúsculas y acepta puntos, guiones y guiones bajos', () => {
    expect(Control.crear({ ...base, codigo: 'ctl.ACC_01-a' }).codigo).toBe('ctl.ACC_01-a');
  });

  it('el error nombra el campo y nunca repite el valor recibido', () => {
    const e = falla({ descripcion: 'SECRETO'.repeat(300) });
    expect(e?.campo).toBe('descripcion');
    expect(String(e?.message)).not.toContain('SECRETO');
  });
});

describe('Control.conCambios', () => {
  const c = Control.crear({ ...base, descripcion: 'Antes', responsableId: PERSONA });

  it('cambia lo indicado, sube la versión y no toca el original', () => {
    const n = c.conCambios({ nombre: 'Nuevo nombre' });
    expect(n).toMatchObject({ nombre: 'Nuevo nombre', descripcion: 'Antes', responsableId: PERSONA, version: 2 });
    expect(c.version).toBe(1);
    expect(c.nombre).toBe('Política de contraseñas');
  });

  it('lo no indicado se conserva y `null` lo quita', () => {
    expect(c.conCambios({ descripcion: null, responsableId: null })).toMatchObject({ descripcion: null, responsableId: null, nombre: base.nombre, version: 2 });
  });

  it('si nada cambia devuelve el mismo control (sin versión nueva)', () => {
    expect(c.conCambios({})).toBe(c);
    expect(c.conCambios({ nombre: '  Política de contraseñas ', descripcion: 'Antes' })).toBe(c);
  });

  it('valida lo nuevo con las mismas reglas', () => {
    expect(() => c.conCambios({ nombre: '' })).toThrow(ErrorCertificacion);
    expect(() => c.conCambios({ responsableId: 'x' })).toThrow(ErrorCertificacion);
  });

  it('un control retirado no se cambia', () => {
    const r = c.retirar();
    try { r.conCambios({ nombre: 'otro' }); expect.unreachable(); } catch (e) { expect((e as ErrorCertificacion).motivos).toEqual(['retirado']); }
  });
});

describe('Control.retirar', () => {
  it('pasa a retirado, sube la versión y no se puede retirar dos veces', () => {
    const c = Control.crear(base);
    const r = c.retirar();
    expect(r).toMatchObject({ estado: 'retirado', version: 2 });
    expect(r.vigente).toBe(false);
    expect(c.estado).toBe('vigente');
    try { r.retirar(); expect.unreachable(); } catch (e) { expect((e as ErrorCertificacion).motivos).toEqual(['ya_retirado']); }
  });
});

describe('Control.validarNuevoMapeo', () => {
  const c = Control.crear(base);
  it('admite mapeos hasta el tope', () => {
    expect(() => c.validarNuevoMapeo(0)).not.toThrow();
    expect(() => c.validarNuevoMapeo(MAPEOS_POR_CONTROL_MAX - 1)).not.toThrow();
  });
  it('rechaza pasar del tope', () => {
    try { c.validarNuevoMapeo(MAPEOS_POR_CONTROL_MAX); expect.unreachable(); } catch (e) { expect((e as ErrorCertificacion).motivos).toEqual(['tope_de_mapeos']); }
  });
  it('un control retirado no recibe mapeos nuevos', () => {
    try { c.retirar().validarNuevoMapeo(0); expect.unreachable(); } catch (e) { expect((e as ErrorCertificacion).motivos).toEqual(['retirado']); }
  });
});
