import { describe, expect, it } from 'vitest';
import { LimiteFrecuencia } from './limite-frecuencia.js';

const P1 = '44444444-4444-4444-8444-444444444444';
const P2 = '55555555-5555-4555-8555-555555555555';
const P3 = '66666666-6666-4666-8666-666666666666';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const crear = (persona: number, empresa: number, extra: { ventanaMs?: number; maxClaves?: number } = {}) => {
  const reloj = { t: 1_000_000 };
  const limite = new LimiteFrecuencia({ persona, empresa, ahora: () => reloj.t, ...extra });
  return { limite, reloj };
};

describe('LimiteFrecuencia — por persona', () => {
  it('admite tantas solicitudes seguidas como la capacidad y rechaza la siguiente', () => {
    const { limite } = crear(3, 100);
    expect([limite.intentar(P1, A), limite.intentar(P1, A), limite.intentar(P1, A)]).toEqual([0, 0, 0]);
    expect(limite.intentar(P1, A)).toBeGreaterThan(0);
  });

  it('el tiempo de espera es un entero de segundos, nunca menor que 1', () => {
    const { limite } = crear(60, 1000, { ventanaMs: 60_000 });
    for (let i = 0; i < 60; i++) limite.intentar(P1, A);
    const espera = limite.intentar(P1, A);
    expect(Number.isInteger(espera)).toBe(true);
    expect(espera).toBeGreaterThanOrEqual(1);
    expect(espera).toBe(1); // 60 por minuto = una ficha por segundo
  });

  it('con pocas solicitudes por ventana la espera es mayor (2 por minuto = 30 s por ficha)', () => {
    const { limite } = crear(2, 1000, { ventanaMs: 60_000 });
    limite.intentar(P1, A);
    limite.intentar(P1, A);
    expect(limite.intentar(P1, A)).toBe(30);
  });

  it('recupera fichas con el tiempo, de forma gradual (sin esperar a que acabe una ventana entera)', () => {
    const { limite, reloj } = crear(60, 1000, { ventanaMs: 60_000 });
    for (let i = 0; i < 60; i++) limite.intentar(P1, A);
    expect(limite.intentar(P1, A)).toBeGreaterThan(0);
    reloj.t += 1_000; // una ficha por segundo
    expect(limite.intentar(P1, A)).toBe(0);
    expect(limite.intentar(P1, A)).toBeGreaterThan(0);
  });

  it('nunca acumula más que la capacidad aunque pase mucho tiempo', () => {
    const { limite, reloj } = crear(3, 100);
    limite.intentar(P1, A);
    reloj.t += 3_600_000;
    expect([limite.intentar(P1, A), limite.intentar(P1, A), limite.intentar(P1, A)]).toEqual([0, 0, 0]);
    expect(limite.intentar(P1, A)).toBeGreaterThan(0);
  });

  it('cada persona tiene su propio cubo', () => {
    const { limite } = crear(2, 100);
    limite.intentar(P1, A);
    limite.intentar(P1, A);
    expect(limite.intentar(P1, A)).toBeGreaterThan(0);
    expect(limite.intentar(P2, A)).toBe(0);
  });

  it('si el reloj retrocede (aunque sea mucho) no inventa fichas ni falla', () => {
    const { limite, reloj } = crear(2, 100);
    limite.intentar(P1, A);
    limite.intentar(P1, A);
    reloj.t -= 3_600_000;
    expect(limite.intentar(P1, A)).toBeGreaterThan(0);
    reloj.t += 3_600_000 + 30_000; // al volver a la hora real solo cuenta el tiempo transcurrido desde el último momento válido
    expect(limite.intentar(P1, A)).toBe(0);
  });
});

describe('LimiteFrecuencia — por empresa', () => {
  it('todas las personas de una empresa comparten su cubo aunque cada una esté por debajo de su límite', () => {
    const { limite } = crear(100, 4);
    expect([limite.intentar(P1, A), limite.intentar(P2, A), limite.intentar(P1, A), limite.intentar(P2, A)]).toEqual([0, 0, 0, 0]);
    expect(limite.intentar(P3, A)).toBeGreaterThan(0);
    expect(limite.intentar(P1, A)).toBeGreaterThan(0);
  });

  it('otra empresa no se ve afectada', () => {
    const { limite } = crear(100, 2);
    limite.intentar(P1, A);
    limite.intentar(P2, A);
    expect(limite.intentar(P3, A)).toBeGreaterThan(0);
    expect(limite.intentar(P3, B)).toBe(0);
  });

  it('una persona bloqueada NO gasta fichas de su empresa', () => {
    const { limite } = crear(1, 3);
    expect(limite.intentar(P1, A)).toBe(0); // gasta 1 de la persona y 1 de la empresa
    for (let i = 0; i < 10; i++) expect(limite.intentar(P1, A)).toBeGreaterThan(0); // bloqueada: no debe vaciar la empresa
    expect(limite.intentar(P2, A)).toBe(0);
    expect(limite.intentar(P3, A)).toBe(0); // la empresa tenía 3: 1 + 1 + 1
  });

  it('una empresa agotada NO gasta fichas de la persona', () => {
    const { limite, reloj } = crear(2, 1, { ventanaMs: 60_000 });
    expect(limite.intentar(P1, A)).toBe(0); // empresa a 0; persona a 1
    for (let i = 0; i < 5; i++) expect(limite.intentar(P1, A)).toBeGreaterThan(0);
    reloj.t += 60_000; // la empresa recupera su ficha; la persona estaba en 1 y recupera hasta 2
    expect(limite.intentar(P1, A)).toBe(0);
  });

  it('con ambos cubos agotados la espera es la mayor de las dos', () => {
    const { limite } = crear(1, 1, { ventanaMs: 60_000 });
    limite.intentar(P1, A);
    expect(limite.intentar(P1, A)).toBe(60);
  });
});

describe('LimiteFrecuencia — memoria y configuración', () => {
  it('no crece sin límite aunque lleguen muchas personas distintas', () => {
    const { limite, reloj } = crear(5, 1000, { maxClaves: 50 });
    for (let i = 0; i < 2000; i++) {
      reloj.t += 10;
      limite.intentar(`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, `10000000-0000-4000-8000-${String(i % 7).padStart(12, '0')}`);
    }
    expect(limite.tamano()).toBeLessThanOrEqual(100);
  });

  it('al hacer sitio se expulsa primero a quien casi no ha gastado y se conserva a quien está castigado', () => {
    const { limite } = crear(1, 1000, { maxClaves: 5 });
    limite.intentar(P1, A); // P1 gasta su única ficha: queda castigada
    expect(limite.intentar(P1, A)).toBeGreaterThan(0);
    for (let i = 0; i < 3; i++) limite.intentar(`20000000-0000-4000-8000-00000000000${i}`, B); // la memoria llega a su tope
    expect(limite.tamano()).toBeLessThanOrEqual(5);
    expect(limite.intentar(P1, A)).toBeGreaterThan(0); // sigue castigada: se expulsó el cubo casi lleno de la empresa A
  });

  it('nunca expulsa los cubos de la solicitud en curso: su propio gasto cuenta siempre', () => {
    const { limite } = crear(1, 1000, { maxClaves: 2 });
    for (let i = 0; i < 20; i++) {
      const persona = `30000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      expect(limite.intentar(persona, A)).toBe(0);
      expect(limite.intentar(persona, A)).toBeGreaterThan(0); // la segunda solicitud inmediata de la misma persona siempre se frena
    }
    expect(limite.tamano()).toBeLessThanOrEqual(2);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rechaza una capacidad inválida (%j)', (n) => {
    expect(() => new LimiteFrecuencia({ persona: n, empresa: 10, ahora: () => 0 })).toThrow();
    expect(() => new LimiteFrecuencia({ persona: 10, empresa: n, ahora: () => 0 })).toThrow();
  });

  it.each([0, -5, Number.NaN])('rechaza una ventana inválida (%j)', (v) => {
    expect(() => new LimiteFrecuencia({ persona: 1, empresa: 1, ventanaMs: v, ahora: () => 0 })).toThrow();
  });
});
