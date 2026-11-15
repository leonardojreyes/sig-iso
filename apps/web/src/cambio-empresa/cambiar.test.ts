// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AlmacenAcceso } from '../auth/almacen-acceso';
import { leerConfiguracion } from '../auth/configuracion';
import type { ResultadoCallback } from '../auth/flujo';
import { crearServicioSesion } from '../auth/sesion';
import { cambiarEmpresa, leerAvisoCambio } from './cambiar';

const config = leerConfiguracion({ OIDC_CLIENT_SECRET: randomBytes(18).toString('base64url'), SESSION_SEALING_KEY: randomBytes(32).toString('base64url') });
const AHORA = new Date('2026-11-15T10:00:00Z');
const callbackOk = (): Extract<ResultadoCallback, { ok: true }> => ({
  ok: true,
  tokens: { acceso: 'acceso-inicial', refresco: 'refresco-0', id: 'id.token.firmado' },
  identidad: { sub: '5eed0005-0000-4000-8000-0000000000c1', sid: 'sesion-kc-1' },
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
    if (url.startsWith(`${config.apiUrl}/sesion/`) && !url.endsWith('/sesion/empresa')) return new Response(null, { status: 204 });
    if (!url.startsWith(config.apiUrl)) return new Response(null, { status: 404 });
    llamadas.push({ ruta: url.replace(config.apiUrl, ''), metodo: init.method ?? 'GET', autorizacion: new Headers(init.headers).get('authorization'), cuerpo: init.body ? JSON.parse(String(init.body)) : null });
    const r = api.respuesta?.() ?? new Response(JSON.stringify({ slug: 'empresa-b', nombre: 'Empresa B (prueba)' }), { status: 200 });
    if (r === 'lanza') throw new Error('ECONNREFUSED');
    return r;
  }) as unknown as typeof fetch;
  const almacen = new AlmacenAcceso();
  const deps = { config, ahora: () => AHORA, fetchFn, almacen };
  const r = await crearServicioSesion(deps).iniciar(callbackOk());
  const cookie = r.headers.getSetCookie().find((c) => c.startsWith(`${config.nombreCookieSesion}=`))!.split(';')[0]!;
  llamadas.length = 0;
  const enviar = (campos: Record<string, string> | null, o: { metodo?: string; origen?: string | null; cookie?: string | null; slug?: string; verificado?: string | null } = {}) => {
    const { metodo = 'POST', origen = config.origen, cookie: c = cookie, slug = 'empresa-a', verificado = 'empresa-a' } = o;
    const peticion = new Request(`${config.origen}/e/${slug}/empresa/cambiar`, {
      method: metodo,
      headers: { ...(origen === null ? {} : { origin: origen }), ...(c ? { cookie: c } : {}), ...(campos ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
      ...(metodo === 'GET' || campos === null ? {} : { body: new URLSearchParams(campos).toString() }),
    });
    return cambiarEmpresa(peticion, { slugDeLaDireccion: slug, slugVerificado: verificado }, deps);
  };
  return { llamadas, enviar, almacen, cookie };
};

const destino = (r: Response): URL => new URL(r.headers.get('location')!);

describe('cambiarEmpresa (web)', () => {
  it('manda el slug a la API con el token, y si la API acepta, entra a la nueva empresa y la recuerda para el proxy', async () => {
    const { llamadas, enviar, almacen } = await montar();
    const r = await enviar({ empresa: 'empresa-b' });
    expect(r.status).toBe(303);
    expect(destino(r).pathname).toBe('/e/empresa-b/panel');
    expect(destino(r).search).toBe('');
    expect(llamadas).toEqual([{ ruta: '/sesion/empresa', metodo: 'POST', autorizacion: 'Bearer acceso-inicial', cuerpo: { slug: 'empresa-b' } }]);
    expect(almacen.empresaDe('sesion-kc-1', AHORA.getTime())).toBe('empresa-b');
  });

  it('la API solo recibe el slug: ni la empresa actual ni ningún otro campo del formulario', async () => {
    const { llamadas, enviar } = await montar();
    await enviar({ empresa: 'empresa-b', empresaId: 'x', extra: 'y' });
    expect(llamadas[0]!.cuerpo).toEqual({ slug: 'empresa-b' });
  });

  it('si la API responde otra empresa distinta de la pedida, no se da por bueno y no cambia nada', async () => {
    const { enviar, almacen } = await montar({ respuesta: () => new Response(JSON.stringify({ slug: 'empresa-c', nombre: 'C' }), { status: 200 }) });
    const r = await enviar({ empresa: 'empresa-b' });
    expect(destino(r).searchParams.get('cambio')).toBe('no_disponible');
    expect(almacen.empresaDe('sesion-kc-1', AHORA.getTime())).toBeUndefined();
  });

  it.each([
    [404, 'no_encontrada'],
    [400, 'no_valido'],
    [429, 'no_disponible'],
    [500, 'no_disponible'],
  ])('la API responde %i: vuelve al panel de la empresa actual con el aviso «%s» y no cambia nada', async (estado, aviso) => {
    const { enviar, almacen } = await montar({ respuesta: () => new Response(null, { status: estado }) });
    const r = await enviar({ empresa: 'empresa-b' });
    expect(destino(r).pathname).toBe('/e/empresa-a/panel');
    expect(destino(r).searchParams.get('cambio')).toBe(aviso);
    expect(almacen.empresaDe('sesion-kc-1', AHORA.getTime())).toBeUndefined();
  });

  it('si la API no responde, vuelve con «no_disponible»', async () => {
    const { enviar } = await montar({ respuesta: () => 'lanza' });
    expect(destino(await enviar({ empresa: 'empresa-b' })).searchParams.get('cambio')).toBe('no_disponible');
  });

  it('401 de la API: manda a ingresar y borra la sesión', async () => {
    const { enviar, almacen } = await montar({ respuesta: () => new Response(null, { status: 401 }) });
    const r = await enviar({ empresa: 'empresa-b' });
    expect(destino(r).pathname).toBe('/auth/login');
    expect(destino(r).searchParams.get('retorno')).toBe('/e/empresa-a/panel');
    expect(almacen.obtener('sesion-kc-1')).toBeUndefined();
  });

  describe('protección del formulario', () => {
    it.each([[undefined], [''], ['EMPRESA-B'], ['../b'], ['a'.repeat(33)], ['empresa b']])('un slug mal formado (%j) vuelve con «no_valido» sin llamar a la API', async (empresa) => {
      const { llamadas, enviar } = await montar();
      const r = await enviar(empresa === undefined ? {} : { empresa });
      expect(destino(r).searchParams.get('cambio')).toBe('no_valido');
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
      expect((await enviar({ empresa: 'empresa-b' }, { origen })).status).toBe(403);
      expect(llamadas).toEqual([]);
    });
    it('la empresa de la dirección distinta de la verificada: 404', async () => {
      const { llamadas, enviar } = await montar();
      expect((await enviar({ empresa: 'empresa-b' }, { slug: 'empresa-b', verificado: 'empresa-a' })).status).toBe(404);
      expect((await enviar({ empresa: 'empresa-b' }, { verificado: null })).status).toBe(404);
      expect(llamadas).toEqual([]);
    });
    it('sin sesión: manda a ingresar', async () => {
      const { llamadas, enviar } = await montar();
      const r = await enviar({ empresa: 'empresa-b' }, { cookie: null });
      expect(destino(r).pathname).toBe('/auth/login');
      expect(llamadas).toEqual([]);
    });
  });
});

describe('leerAvisoCambio', () => {
  it('solo acepta valores conocidos', () => {
    expect(leerAvisoCambio({ cambio: 'no_encontrada' })).toBe('no_encontrada');
    expect(leerAvisoCambio({ cambio: '<b>x</b>' })).toBeNull();
    expect(leerAvisoCambio({ cambio: ['no_valido'] })).toBeNull();
    expect(leerAvisoCambio({})).toBeNull();
  });
});
