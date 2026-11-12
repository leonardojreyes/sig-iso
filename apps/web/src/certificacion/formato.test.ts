// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { hoyEnEcuador, huellaCorta, tamanoLegible } from './formato';

describe('hoyEnEcuador', () => {
  it('usa el día de Ecuador (UTC-5), no el del servidor', () => {
    expect(hoyEnEcuador(new Date('2026-11-11T03:00:00Z'))).toBe('2026-11-10');
    expect(hoyEnEcuador(new Date('2026-11-11T05:00:00Z'))).toBe('2026-11-11');
    expect(hoyEnEcuador(new Date('2027-01-01T02:00:00Z'))).toBe('2026-12-31');
  });
});

describe('tamanoLegible', () => {
  it.each([[1, '1 B'], [812, '812 B'], [1023, '1023 B'], [1024, '1,0 KB'], [1536, '1,5 KB'], [1_048_576, '1,0 MB'], [3_355_443, '3,2 MB'], [26_214_400, '25,0 MB'], [5 * 1024 ** 3, '5,0 GB']])('%d → %s', (b, esperado) => {
    expect(tamanoLegible(b)).toBe(esperado);
  });
});

describe('huellaCorta', () => {
  it('muestra los 12 primeros caracteres', () => {
    expect(huellaCorta('abcdef0123456789'.repeat(4))).toBe('abcdef012345…');
  });
});
