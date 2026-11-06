import { describe, expect, it } from 'vitest';
import { ErrorNormas } from './errores.js';
import { Libreria } from './libreria.js';

const ID = '11111111-1111-4111-8111-111111111111';
const base = { id: ID, codigo: 'ejemplo-estructura-armonizada', nombre: 'Ejemplo de Estructura Armonizada', version: '1.0.0', esEjemplo: true, fuente: 'elaboración propia SynapTech' };

describe('Libreria', () => {
  it('se crea con datos válidos y expone sus campos', () => {
    const l = Libreria.crear(base);
    expect(l).toMatchObject({ id: ID, codigo: 'ejemplo-estructura-armonizada', version: '1.0.0', esEjemplo: true });
  });

  it('recorta espacios del nombre y la fuente', () => {
    const l = Libreria.crear({ ...base, nombre: '  Mi librería ', fuente: ' propia ' });
    expect(l.nombre).toBe('Mi librería');
    expect(l.fuente).toBe('propia');
  });

  it.each([
    ['id', { id: 'no-uuid' }],
    ['id', { id: '00000000-0000-0000-0000-000000000000' }],
    ['codigo', { codigo: 'Mayúsculas' }],
    ['codigo', { codigo: '' }],
    ['codigo', { codigo: 'a'.repeat(65) }],
    ['nombre', { nombre: '  ' }],
    ['nombre', { nombre: 'n'.repeat(121) }],
    ['version', { version: '1.0' }],
    ['version', { version: 'v1.0.0' }],
    ['version', { version: '1.0.0-beta' }],
    ['fuente', { fuente: '' }],
    ['fuente', { fuente: 'f'.repeat(201) }],
    ['esEjemplo', { esEjemplo: 'si' as never }],
  ])('rechaza un valor inválido de %s', (campo, cambio) => {
    const error = (() => { try { Libreria.crear({ ...base, ...cambio }); } catch (e) { return e; } })();
    expect(error).toBeInstanceOf(ErrorNormas);
    expect((error as ErrorNormas).campo).toBe(campo);
  });

  it('los errores no repiten el valor recibido', () => {
    const secreto = 'VALOR-SENSIBLE-123';
    const error = (() => { try { Libreria.crear({ ...base, version: secreto }); } catch (e) { return e as Error; } })();
    expect(error?.message).not.toContain(secreto);
  });

  it('está congelada', () => {
    expect(Object.isFrozen(Libreria.crear(base))).toBe(true);
  });
});
