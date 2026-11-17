import { describe, expect, it } from 'vitest';
import { ErrorDatosPersona, validarDatosPersona } from './datos-persona';

// Nombre y correo que escribe el administrador SIG al aprobar una solicitud (ADR 036). Nunca salen del token ni van a la bitácora.
describe('datos de una persona', () => {
  it('acepta un nombre y un correo, recorta espacios y pasa el correo a minúsculas', () => {
    expect(validarDatosPersona({ nombre: '  Laura Mena  ', correo: ' Laura.Mena@Example.TEST ' })).toEqual({
      nombre: 'Laura Mena',
      correo: 'laura.mena@example.test',
    });
  });

  it('acepta nombres con tildes, eñes y apóstrofos', () => {
    expect(validarDatosPersona({ nombre: "María José Ñáñez O'Brien", correo: 'maria@example.test' }).nombre).toBe(
      "María José Ñáñez O'Brien",
    );
  });

  it.each([
    ['nombre vacío', { nombre: '   ', correo: 'a@example.test' }],
    ['nombre que no es texto', { nombre: 7, correo: 'a@example.test' }],
    ['nombre de más de 120 caracteres', { nombre: 'x'.repeat(121), correo: 'a@example.test' }],
    ['nombre con salto de línea', { nombre: 'Ana\nPérez', correo: 'a@example.test' }],
    ['nombre con carácter de control', { nombre: 'Ana\u0007', correo: 'a@example.test' }],
    ['correo sin arroba', { nombre: 'Ana', correo: 'ana.example.test' }],
    ['correo con dos arrobas', { nombre: 'Ana', correo: 'a@b@example.test' }],
    ['correo sin dominio', { nombre: 'Ana', correo: 'ana@' }],
    ['correo con espacios', { nombre: 'Ana', correo: 'ana perez@example.test' }],
    ['correo de más de 254 caracteres', { nombre: 'Ana', correo: `${'a'.repeat(250)}@example.test` }],
    ['correo que no es texto', { nombre: 'Ana', correo: null }],
  ])('rechaza %s sin repetir lo recibido', (_caso, entrada) => {
    try {
      validarDatosPersona(entrada);
      throw new Error('debía rechazar');
    } catch (error) {
      expect(error).toBeInstanceOf(ErrorDatosPersona);
      expect(String((error as Error).message)).not.toContain('Pérez');
      expect(String((error as Error).message)).not.toContain('example.test');
    }
  });
});
