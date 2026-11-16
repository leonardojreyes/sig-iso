import { describe, expect, it } from 'vitest';
import { ALFABETO_CODIGO, FORMA_CODIGO, generarCodigo, TOPE_SOLICITUDES_VIGENTES, VIDA_SOLICITUD_MS } from './solicitud-acceso';

// Código corto de una solicitud de acceso (ADR 036): ocho caracteres `XXXX-XXXX`, alfabeto sin ambiguos, aleatoriedad inyectada.
const desde = (bytes: readonly number[]) => {
  let i = 0;
  return (n: number) => Uint8Array.from({ length: n }, () => bytes[i++ % bytes.length]!);
};

describe('código de solicitud', () => {
  it('el alfabeto no tiene 0, O, 1, I ni L, y tiene 31 caracteres distintos', () => {
    for (const c of '01OIL') expect(ALFABETO_CODIGO).not.toContain(c);
    expect(ALFABETO_CODIGO).toHaveLength(31);
    expect(new Set(ALFABETO_CODIGO).size).toBe(31);
  });

  it('tiene la forma XXXX-XXXX y cabe en la restricción de la base de datos', () => {
    const codigo = generarCodigo(desde([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]));
    expect(codigo).toMatch(FORMA_CODIGO);
    expect(codigo).toBe('ABCD-EFGH');
  });

  it('usa todo el alfabeto: el último carácter sale de un byte alto aceptado y no hay sesgo por módulo', () => {
    // 247 = 31 * 8 - 1 es el último byte aceptado; 248 a 255 se descartan y se vuelve a pedir.
    expect(generarCodigo(desde([247, 247, 247, 247, 247, 247, 247, 247]))).toBe('9999-9999');
    expect(generarCodigo(desde([255, 254, 253, 252, 251, 250, 249, 248, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('AAAA-AAAA');
  });

  it('con aleatoriedad real: siempre válido y casi nunca repetido', () => {
    const real = (n: number) => crypto.getRandomValues(new Uint8Array(n));
    const vistos = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const c = generarCodigo(real);
      expect(c).toMatch(FORMA_CODIGO);
      vistos.add(c);
    }
    expect(vistos.size).toBeGreaterThan(1990);
  });

  it('rechaza formas y caracteres no permitidos', () => {
    for (const malo of [
      '0000-0000',
      'ABCD1234',
      'abcd-efgh',
      'AAAA-BBBI',
      'AAAA-BBBL',
      'AAAA-BBBO',
      'AAAA-BBB',
      'AAAA-BBBBB',
      ' AAAA-BBBB',
      '',
    ])
      expect(FORMA_CODIGO.test(malo), malo).toBe(false);
  });

  it('una solicitud vive 7 días y hay un tope de 50 vigentes por empresa', () => {
    expect(VIDA_SOLICITUD_MS).toBe(7 * 24 * 3600 * 1000);
    expect(TOPE_SOLICITUDES_VIGENTES).toBe(50);
  });
});
