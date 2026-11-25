import { describe, expect, it } from 'vitest';
import { serializarCanonico } from './canonico.js';

describe('serialización canónica', () => {
  it('no depende del orden de las claves, en ningún nivel', () => {
    const a = { b: 1, a: { d: [3, { y: 1, x: 2 }], c: null }, e: 'é' };
    const b = { e: 'é', a: { c: null, d: [3, { x: 2, y: 1 }] }, b: 1 };
    expect(serializarCanonico(a)).toBe(serializarCanonico(b));
    expect(serializarCanonico(a)).toBe('{"a":{"c":null,"d":[3,{"x":2,"y":1}]},"b":1,"e":"é"}');
  });

  it('conserva el orden de los arreglos y descarta lo indefinido', () => {
    expect(serializarCanonico({ l: [2, 1], z: undefined })).toBe('{"l":[2,1]}');
  });

  it('sobrevive al viaje de ida y vuelta por JSON (lo que hace jsonb)', () => {
    const v = { zeta: { b: [1, 2], a: 'x' }, alfa: true };
    expect(serializarCanonico(JSON.parse(JSON.stringify(v)))).toBe(serializarCanonico(v));
  });
});
