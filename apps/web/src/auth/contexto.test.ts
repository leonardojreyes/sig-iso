// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { responderContexto } from './contexto';

const con = (cabecera: string | null) => new Headers(cabecera === null ? {} : { 'x-sig-empresa': cabecera });

describe('responderContexto (empresa verificada de la sesión)', () => {
  it('si la empresa de la dirección es la verificada por el proxy, la devuelve, sin caché', async () => {
    const r = responderContexto('empresa-a', con('empresa-a'));
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toMatch(/no-store/);
    expect(await r.json()).toEqual({ empresa: 'empresa-a' });
  });

  it('si no coincide, o el proxy no la verificó (se saltó el proxy), es 404 SIN datos', async () => {
    for (const [dir, cab] of [
      ['empresa-b', 'empresa-a'],
      ['empresa-a', 'empresa-b'],
      ['empresa-a', null],
      ['empresa-a', ''],
      ['EMPRESA-A', 'EMPRESA-A'],
      ['a..b', 'a..b'],
    ] as const) {
      const r = responderContexto(dir, con(cab));
      expect(r.status, `${dir}/${cab}`).toBe(404);
      expect(await r.text()).toBe('');
      expect(r.headers.get('cache-control')).toMatch(/no-store/);
    }
  });
});
