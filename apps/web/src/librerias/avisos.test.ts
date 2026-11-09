// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { leerAviso } from './avisos';

const UUID = '5eed0001-0000-4000-8000-0000000000a1';

describe('leerAviso (resultado de la adopción que viaja en la dirección; solo valores conocidos)', () => {
  it('sin parámetro no hay aviso', () => {
    expect(leerAviso({})).toBeNull();
  });

  it('acepta los resultados conocidos; los dos de éxito llevan la librería', () => {
    expect(leerAviso({ adopcion: 'adoptada', libreria: UUID })).toEqual({ tipo: 'adoptada', libreriaId: UUID });
    expect(leerAviso({ adopcion: 'ya_adoptada', libreria: UUID })).toEqual({ tipo: 'ya_adoptada', libreriaId: UUID });
    for (const tipo of ['sin_permiso', 'no_encontrada', 'no_disponible'] as const) {
      expect(leerAviso({ adopcion: tipo })).toEqual({ tipo });
    }
  });

  it('un éxito sin librería válida no se muestra', () => {
    expect(leerAviso({ adopcion: 'adoptada' })).toBeNull();
    expect(leerAviso({ adopcion: 'adoptada', libreria: 'no-es-uuid' })).toBeNull();
    expect(leerAviso({ adopcion: 'ya_adoptada', libreria: ['a', 'b'] } as never)).toBeNull();
  });

  it.each([
    ['valor desconocido', { adopcion: 'hecho' }],
    ['valor con HTML', { adopcion: '<script>alert(1)</script>' }],
    ['valor vacío', { adopcion: '' }],
    ['valor repetido', { adopcion: ['adoptada', 'sin_permiso'] }],
    ['mayúsculas', { adopcion: 'ADOPTADA' }],
  ])('se ignora: %s', (_n, sp) => {
    expect(leerAviso(sp as never)).toBeNull();
  });

  it('para los resultados de error ignora la librería que venga', () => {
    expect(leerAviso({ adopcion: 'sin_permiso', libreria: UUID })).toEqual({ tipo: 'sin_permiso' });
  });
});
