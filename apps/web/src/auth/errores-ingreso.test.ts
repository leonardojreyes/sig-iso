// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { leerErrorIngreso } from './errores-ingreso';

describe('leerErrorIngreso (el código genérico con que /auth/callback devuelve a la portada)', () => {
  it('sin parámetro no hay error', () => {
    expect(leerErrorIngreso({})).toBeNull();
  });
  it('acepta solo los tres códigos que emite el ingreso', () => {
    for (const c of ['ingreso_invalido', 'ingreso_cancelado', 'ingreso_no_disponible'] as const)
      expect(leerErrorIngreso({ error: c })).toBe(c);
  });
  it.each([
    ['desconocido', 'sesion_pendiente'],
    ['con HTML', '<script>alert(1)</script>'],
    ['vacío', ''],
    ['en mayúsculas', 'INGRESO_INVALIDO'],
    ['con espacios', ' ingreso_invalido'],
    ['repetido', ['ingreso_invalido', 'ingreso_cancelado']],
    ['un motivo interno que nunca debe mostrarse', 'state_invalido'],
  ])('se ignora: %s', (_n, valor) => {
    expect(leerErrorIngreso({ error: valor } as never)).toBeNull();
  });
});
