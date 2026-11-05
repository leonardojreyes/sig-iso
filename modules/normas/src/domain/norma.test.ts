import { describe, expect, it } from 'vitest';
import { Norma } from './norma.js';

describe('Norma', () => {
  it('crea una norma válida', () => {
    const n = Norma.crear({ codigo: ' ISO 9001 ', nombre: 'Calidad', edicion: '2015' });
    expect(n.codigo).toBe('ISO 9001');
  });
  it('rechaza código vacío', () => {
    expect(() => Norma.crear({ codigo: ' ', nombre: 'x', edicion: '2015' })).toThrow();
  });
  it('rechaza edición que no es un año', () => {
    expect(() => Norma.crear({ codigo: 'ISO 9001', nombre: 'x', edicion: '15' })).toThrow();
  });
});
