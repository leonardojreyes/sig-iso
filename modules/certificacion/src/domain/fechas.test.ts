import { describe, expect, it } from 'vitest';
import { fechaValida, hoyEnEcuador } from './fechas.js';

describe('fechaValida', () => {
  it('acepta días que existen, incluido el 29 de febrero de un año bisiesto', () => {
    for (const f of ['2026-11-10', '2024-02-29', '2026-12-31', '2026-01-01']) expect(fechaValida(f), f).toBe(true);
  });
  it('rechaza días inexistentes, formatos distintos y lo que no es texto', () => {
    for (const f of ['2026-02-31', '2025-02-29', '2026-13-01', '2026-00-10', '2026-11-00', '10/11/2026', '2026-1-1', '2026-11-10T00:00:00Z', ' 2026-11-10', '', null, undefined, 20261110, {}]) expect(fechaValida(f), String(f)).toBe(false);
  });
});

describe('hoyEnEcuador', () => {
  it('usa el día de Ecuador (UTC-5), no el del servidor', () => {
    expect(hoyEnEcuador(new Date('2026-11-11T03:00:00Z'))).toBe('2026-11-10'); // 22:00 del 10 en Ecuador
    expect(hoyEnEcuador(new Date('2026-11-11T05:00:00Z'))).toBe('2026-11-11'); // medianoche del 11 en Ecuador
    expect(hoyEnEcuador(new Date('2026-11-11T04:59:59Z'))).toBe('2026-11-10');
  });
  it('cruza bien el fin de año', () => {
    expect(hoyEnEcuador(new Date('2027-01-01T02:00:00Z'))).toBe('2026-12-31');
  });
});
