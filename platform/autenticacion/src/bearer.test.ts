import { describe, expect, it } from 'vitest';
import { extraerBearer } from './bearer.js';

const T = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ4In0.firma_de-prueba';

describe('extraerBearer', () => {
  it('devuelve el token de «Bearer <token>»', () => {
    expect(extraerBearer(`Bearer ${T}`)).toBe(T);
  });

  it('el esquema no distingue mayúsculas (RFC 7235)', () => {
    expect(extraerBearer(`bearer ${T}`)).toBe(T);
    expect(extraerBearer(`BEARER ${T}`)).toBe(T);
  });

  it.each([
    undefined, null, '', 'Bearer', 'Bearer ', `Basic ${T}`, `Token ${T}`, T, `Bearer ${T} otro`, ` Bearer ${T}`, `Bearer ${T} `,
    `Bearer  ${T}`, `Bearer\t${T}`, `Bearer ${T}\r\nX-Evil: 1`, `Bearer ${T}\n`, 'Bearer a b', `Bearer ${'a'.repeat(8193)}`,
    ['Bearer a', 'Bearer b'], 42, {},
  ])('rechaza %j', (cabecera) => {
    expect(extraerBearer(cabecera as never)).toBeNull();
  });

  it('acepta justo el tamaño máximo', () => {
    expect(extraerBearer(`Bearer ${'a'.repeat(8192)}`)).toHaveLength(8192);
  });

  it('solo admite los caracteres de un JWT (base64url y puntos)', () => {
    expect(extraerBearer('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    for (const malo of ['abc def', 'abc"def', 'abc<def>', 'abc;def', 'ábc.def']) expect(extraerBearer(`Bearer ${malo}`)).toBeNull();
  });
});
