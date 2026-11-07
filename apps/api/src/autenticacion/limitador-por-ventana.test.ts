import { describe, expect, it } from 'vitest';
import { LimitadorPorVentana } from './limitador-por-ventana.js';

describe('LimitadorPorVentana', () => {
  it('deja pasar el primer intento de cada clave y frena los siguientes dentro de la ventana', () => {
    const l = new LimitadorPorVentana(60_000, () => 0);
    expect(l.permitir('a')).toBe(true);
    expect(l.permitir('a')).toBe(false);
    expect(l.permitir('a')).toBe(false);
    expect(l.permitir('b')).toBe(true);
  });

  it('vuelve a dejar pasar al terminar la ventana (en el límite exacto)', () => {
    let t = 1000;
    const l = new LimitadorPorVentana(60_000, () => t);
    l.permitir('a');
    t = 1000 + 59_999;
    expect(l.permitir('a')).toBe(false);
    t = 1000 + 60_000;
    expect(l.permitir('a')).toBe(true);
    expect(l.permitir('a')).toBe(false);
  });

  it('cuenta lo suprimido por clave y lo reinicia al volver a permitir', () => {
    let t = 0;
    const l = new LimitadorPorVentana(10, () => t);
    l.permitir('a');
    l.permitir('a');
    l.permitir('a');
    expect(l.suprimidos('a')).toBe(2);
    expect(l.suprimidos('b')).toBe(0);
    t = 10;
    l.permitir('a');
    expect(l.suprimidos('a')).toBe(0);
  });

  it('no crece sin límite aunque lleguen claves distintas (descarta las vencidas)', () => {
    let t = 0;
    const l = new LimitadorPorVentana(10, () => t, 100);
    for (let i = 0; i < 1000; i++) { t += 11; l.permitir(`k${i}`); }
    expect(l.tamano()).toBeLessThanOrEqual(100);
  });

  it('con claves no vencidas por encima del máximo, deja de admitir nuevas en vez de crecer', () => {
    const l = new LimitadorPorVentana(60_000, () => 0, 5);
    const r = Array.from({ length: 10 }, (_, i) => l.permitir(`k${i}`));
    expect(l.tamano()).toBeLessThanOrEqual(5);
    expect(r.filter(Boolean).length).toBeLessThanOrEqual(5);
  });

  it.each([0, -1, Number.NaN])('rechaza una ventana inválida (%j)', (v) => {
    expect(() => new LimitadorPorVentana(v, () => 0)).toThrow();
  });
});
