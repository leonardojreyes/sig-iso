// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { aRespuesta } from './proxy-adaptador';

const peticion = (ruta = '/e/empresa-a/panel', cabeceras: Record<string, string> = {}) =>
  new NextRequest(`http://localhost:3000${ruta}`, { headers: cabeceras });

describe('aRespuesta (de la decisión al NextResponse)', () => {
  it('pasar: continúa con la empresa verificada, sin caché, y pisa cualquier x-sig-empresa que mande el cliente', () => {
    const r = aRespuesta(
      { tipo: 'pasar', empresa: 'empresa-a', cookies: [] },
      peticion('/e/empresa-a/panel', { 'x-sig-empresa': 'empresa-b' }),
    );
    expect(r.headers.get('x-middleware-next')).toBe('1');
    expect(r.headers.get('x-middleware-request-x-sig-empresa')).toBe('empresa-a');
    expect(r.headers.get('cache-control')).toMatch(/no-store/);
  });

  it('pasar sin empresa verificada: elimina el encabezado que mande el cliente (no se puede falsificar)', () => {
    const r = aRespuesta(
      { tipo: 'pasar', empresa: null, cookies: [] },
      peticion('/e/empresa-a/ingreso', { 'x-sig-empresa': 'empresa-b' }),
    );
    expect(r.headers.get('x-middleware-request-x-sig-empresa')).toBeNull();
    const reenviados = r.headers.get('x-middleware-override-headers') ?? '';
    expect(reenviados.split(',')).not.toContain('x-sig-empresa');
  });

  it('login: 307 a /auth/login con el retorno codificado, sin caché', () => {
    const r = aRespuesta({ tipo: 'login', retorno: '/e/empresa-a/requisitos?q=a b', cookies: [] }, peticion());
    expect(r.status).toBe(307);
    expect(r.headers.get('location')).toBe(
      'http://localhost:3000/auth/login?retorno=%2Fe%2Fempresa-a%2Frequisitos%3Fq%3Da+b',
    );
    expect(r.headers.get('cache-control')).toMatch(/no-store/);
  });

  it('login desde un POST (p. ej. adoptar con la sesión vencida): 303, para que el navegador pida /auth/login con GET', () => {
    const post = new NextRequest('http://localhost:3000/e/empresa-a/librerias/x/adopcion', { method: 'POST' });
    const r = aRespuesta({ tipo: 'login', retorno: '/e/empresa-a/requisitos', cookies: [] }, post);
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toContain('/auth/login?retorno=');
    for (const metodo of ['GET', 'HEAD']) {
      expect(
        aRespuesta(
          { tipo: 'login', retorno: '/', cookies: [] },
          new NextRequest('http://localhost:3000/e/empresa-a/panel', { method: metodo }),
        ).status,
      ).toBe(307);
    }
  });

  it('no encontrado: reescribe a una ruta inexistente (404 de Next, sin revelar nada) y sin caché', () => {
    const r = aRespuesta({ tipo: 'no_encontrado', cookies: [] }, peticion('/e/empresa-b/panel'));
    expect(r.headers.get('x-middleware-rewrite')).toBe('http://localhost:3000/no-encontrado');
    expect(r.headers.get('cache-control')).toMatch(/no-store/);
  });

  it('no disponible: 503 sin detalles', async () => {
    const r = aRespuesta({ tipo: 'no_disponible' }, peticion());
    expect(r.status).toBe(503);
    expect(r.headers.get('cache-control')).toMatch(/no-store/);
    expect(await r.text()).not.toMatch(/api|keycloak|token/i);
  });

  it('las cookies de la decisión se envían tal cual en todos los casos', () => {
    const c = 'sig-sesion=nueva; Path=/; HttpOnly; SameSite=Lax';
    for (const d of [
      { tipo: 'pasar' as const, empresa: 'empresa-a', cookies: [c] },
      { tipo: 'login' as const, retorno: '/', cookies: [c] },
      { tipo: 'no_encontrado' as const, cookies: [c] },
    ]) {
      expect(aRespuesta(d, peticion()).headers.getSetCookie()).toEqual([c]);
    }
  });
});
