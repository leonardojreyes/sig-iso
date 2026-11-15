// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AlmacenAcceso } from '../auth/almacen-acceso';
import { leerConfiguracion } from '../auth/configuracion';
import type { ResultadoCallback } from '../auth/flujo';
import { crearServicioSesion } from '../auth/sesion';
import { guardarMarca, leerAvisoMarca } from './editar';

const config = leerConfiguracion({ OIDC_CLIENT_SECRET: randomBytes(18).toString('base64url'), SESSION_SEALING_KEY: randomBytes(32).toString('base64url') });
const AHORA = new Date('2026-11-15T10:00:00Z');
const callbackOk = (): Extract<ResultadoCallback, { ok: true }> => ({
  ok: true,
  tokens: { acceso: 'acceso-inicial', refresco: 'refresco-0', id: 'id.token.firmado' },
  identidad: { sub: '5eed0001-0000-4000-8000-0000000000a1', sid: 'sesion-kc-1' },
  retorno: '/',
  limpiarCookie: 'sig-oidc=; Max-Age=0',
});

interface Llamada {
  ruta: string;
  metodo: string;
  autorizacion: string | null;
  cuerpo: unknown;
}

const montar = async (api: { respuesta?: () => Response | 'lanza' } = {}) => {
  const llamadas: Llamada[] = [];
  const fetchFn = (async (url: string, init: RequestInit = {}) => {
    if (url.startsWith(`${config.apiUrl}/sesion/`)) return new Response(null, { status: 204 });
    if (!url.startsWith(config.apiUrl)) return new Response(null, { status: 404 });
    llamadas.push({ ruta: url.replace(config.apiUrl, ''), metodo: init.method ?? 'GET', autorizacion: new Headers(init.headers).get('authorization'), cuerpo: init.body ? JSON.parse(String(init.body)) : null });
    const r = api.respuesta?.() ?? new Response('{}', { status: 200 });
    if (r === 'lanza') throw new Error('ECONNREFUSED');
    return r;
  }) as unknown as typeof fetch;
  const deps = { config, ahora: () => AHORA, fetchFn, almacen: new AlmacenAcceso() };
  const r = await crearServicioSesion(deps).iniciar(callbackOk());
  const cookie = r.headers.getSetCookie().find((c) => c.startsWith(`${config.nombreCookieSesion}=`))!.split(';')[0]!;
  llamadas.length = 0;
  const enviar = (campos: Record<string, string> | null, o: { metodo?: string; origen?: string | null; cookie?: string | null; slug?: string; verificado?: string | null } = {}) => {
    const { metodo = 'POST', origen = config.origen, cookie: c = cookie, slug = 'empresa-a', verificado = 'empresa-a' } = o;
    const peticion = new Request(`${config.origen}/e/${slug}/marca/guardar`, {
      method: metodo,
      headers: { ...(origen === null ? {} : { origin: origen }), ...(c ? { cookie: c } : {}), ...(campos ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
      ...(metodo === 'GET' || campos === null ? {} : { body: new URLSearchParams(campos).toString() }),
    });
    return guardarMarca(peticion, { slugDeLaDireccion: slug, slugVerificado: verificado }, deps);
  };
  return { llamadas, enviar };
};

const destino = (r: Response): URL => new URL(r.headers.get('location')!);
const aviso = (r: Response) => destino(r).searchParams.get('aviso');

describe('guardarMarca (web)', () => {
  it('manda color y logo a la API con el token, y vuelve con «guardada»', async () => {
    const { llamadas, enviar } = await montar();
    const r = await enviar({ color: '#0E5C42', logo: '  https://cdn.example.test/a.png  ' });
    expect(r.status).toBe(303);
    expect(destino(r).pathname).toBe('/e/empresa-a/marca');
    expect(aviso(r)).toBe('guardada');
    expect(llamadas).toEqual([{ ruta: '/empresa/marca', metodo: 'PUT', autorizacion: 'Bearer acceso-inicial', cuerpo: { colorPrimario: '#0E5C42', logoUrl: 'https://cdn.example.test/a.png' } }]);
  });

  it('un logo vacío quita el logo (nulo en la API)', async () => {
    const { llamadas, enviar } = await montar();
    await enviar({ color: '#0e5c42', logo: '   ' });
    expect(llamadas[0]!.cuerpo).toEqual({ colorPrimario: '#0e5c42', logoUrl: null });
  });

  it('a la API solo llegan el color y el logo: ni la empresa ni otros campos del formulario', async () => {
    const { llamadas, enviar } = await montar();
    await enviar({ color: '#0e5c42', logo: '', empresa: 'otra', empresaId: 'x', nombre: 'Otro' });
    expect(Object.keys(llamadas[0]!.cuerpo as object).sort()).toEqual(['colorPrimario', 'logoUrl']);
  });

  it.each([
    [400, 'no_valido'],
    [403, 'sin_permiso'],
    [429, 'no_disponible'],
    [500, 'no_disponible'],
  ])('la API responde %i: vuelve con el aviso «%s»', async (estado, esperado) => {
    const { enviar } = await montar({ respuesta: () => new Response(null, { status: estado }) });
    expect(aviso(await enviar({ color: '#0e5c42', logo: '' }))).toBe(esperado);
  });

  it('si la API no responde, vuelve con «no_disponible»', async () => {
    const { enviar } = await montar({ respuesta: () => 'lanza' });
    expect(aviso(await enviar({ color: '#0e5c42', logo: '' }))).toBe('no_disponible');
  });

  it('401 de la API: manda a ingresar y borra la sesión', async () => {
    const { enviar } = await montar({ respuesta: () => new Response(null, { status: 401 }) });
    const r = await enviar({ color: '#0e5c42', logo: '' });
    expect(destino(r).pathname).toBe('/auth/login');
    expect(destino(r).searchParams.get('retorno')).toBe('/e/empresa-a/marca');
  });

  describe('protección del formulario', () => {
    it.each([
      ['sin color', { logo: '' }],
      ['sin logo (campo ausente)', { color: '#0e5c42' }],
      ['un color mal formado', { color: 'rojo', logo: '' }],
      ['un color de 3 dígitos', { color: '#fff', logo: '' }],
      ['un logo con http', { color: '#0e5c42', logo: 'http://inseguro.example.test/x.png' }],
      ['un logo con javascript:', { color: '#0e5c42', logo: 'javascript:alert(1)' }],
      ['un logo que apunta a otro host con «//»', { color: '#0e5c42', logo: '//evil.example.test/x.png' }],
      ['un logo con credenciales', { color: '#0e5c42', logo: 'https://u:p@cdn.example.test/x.png' }],
      ['un logo de más de 2048 caracteres', { color: '#0e5c42', logo: 'https://cdn.example.test/' + 'a'.repeat(2100) }],
    ])('%s: vuelve con «no_valido» SIN llamar a la API', async (_n, campos) => {
      const { llamadas, enviar } = await montar();
      expect(aviso(await enviar(campos))).toBe('no_valido');
      expect(llamadas).toEqual([]);
    });
    it('solo POST: un GET responde 405', async () => {
      const { enviar } = await montar();
      const r = await enviar(null, { metodo: 'GET' });
      expect(r.status).toBe(405);
      expect(r.headers.get('allow')).toBe('POST');
    });
    it.each([[null], ['https://otro.example'], ['null']])('con el origen %j responde 403 y no llama a la API', async (origen) => {
      const { llamadas, enviar } = await montar();
      expect((await enviar({ color: '#0e5c42', logo: '' }, { origen })).status).toBe(403);
      expect(llamadas).toEqual([]);
    });
    it('la empresa de la dirección distinta de la verificada: 404', async () => {
      const { llamadas, enviar } = await montar();
      expect((await enviar({ color: '#0e5c42', logo: '' }, { slug: 'empresa-b', verificado: 'empresa-a' })).status).toBe(404);
      expect((await enviar({ color: '#0e5c42', logo: '' }, { verificado: null })).status).toBe(404);
      expect(llamadas).toEqual([]);
    });
    it('sin sesión: manda a ingresar', async () => {
      const { llamadas, enviar } = await montar();
      const r = await enviar({ color: '#0e5c42', logo: '' }, { cookie: null });
      expect(destino(r).pathname).toBe('/auth/login');
      expect(llamadas).toEqual([]);
    });
  });
});

describe('leerAvisoMarca', () => {
  it('solo acepta valores conocidos', () => {
    expect(leerAvisoMarca({ aviso: 'guardada' })).toBe('guardada');
    expect(leerAvisoMarca({ aviso: '<b>x</b>' })).toBeNull();
    expect(leerAvisoMarca({ aviso: ['guardada'] })).toBeNull();
    expect(leerAvisoMarca({})).toBeNull();
  });
});
