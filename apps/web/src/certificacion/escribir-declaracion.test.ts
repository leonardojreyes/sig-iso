// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AlmacenAcceso } from '../auth/almacen-acceso';
import { leerConfiguracion } from '../auth/configuracion';
import type { ResultadoCallback } from '../auth/flujo';
import { crearServicioSesion, type DependenciasSesion } from '../auth/sesion';
import { aprobarDeclaracion, descargarBorradorDeclaracion, descargarVersionDeclaracion, leerAvisoEscritura } from './escribir';

const config = leerConfiguracion({ OIDC_CLIENT_SECRET: randomBytes(18).toString('base64url'), SESSION_SEALING_KEY: randomBytes(32).toString('base64url') });
const AHORA = new Date('2026-11-12T10:00:00Z');
const VERSION = 'dddddddd-1111-4111-8111-111111111111';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const callbackOk = (): Extract<ResultadoCallback, { ok: true }> => ({
  ok: true,
  tokens: { acceso: 'acceso-inicial', refresco: 'refresco-0', id: 'id.token.firmado' },
  identidad: { sub: '5eed0001-0000-4000-8000-0000000000a1', sid: 'sesion-kc-1' },
  retorno: '/',
  limpiarCookie: 'sig-oidc=; Max-Age=0',
});

interface Llamada { metodo: string; ruta: string; autorizacion: string | null; tipoContenido: string | null; cuerpoVacio: boolean }
type Manejador = (p: Request, e: { slugDeLaDireccion: string; slugVerificado: string | null; deps: DependenciasSesion; id?: string }) => Promise<Response>;

const montar = async (api: { estado?: number | 'lanza'; respuesta?: () => Response } = {}) => {
  const llamadas: Llamada[] = [];
  const fetchFn = (async (url: string, init: RequestInit = {}) => {
    if (url.startsWith(`${config.apiUrl}/sesion/`)) return new Response(null, { status: 204 });
    if (!url.startsWith(config.apiUrl)) return new Response(null, { status: 404 });
    const cabeceras = new Headers(init.headers);
    llamadas.push({ metodo: init.method ?? 'GET', ruta: url.replace(config.apiUrl, ''), autorizacion: cabeceras.get('authorization'), tipoContenido: cabeceras.get('content-type'), cuerpoVacio: init.body === undefined || init.body === null });
    if (api.estado === 'lanza') throw new Error('ECONNREFUSED');
    if (api.respuesta) return api.respuesta();
    return new Response('{}', { status: api.estado ?? 201 });
  }) as unknown as typeof fetch;
  const deps = { config, ahora: () => AHORA, fetchFn, almacen: new AlmacenAcceso() };
  const r = await crearServicioSesion(deps).iniciar(callbackOk());
  const cookie = r.headers.getSetCookie().find((c) => c.startsWith(`${config.nombreCookieSesion}=`))!.split(';')[0]!;
  llamadas.length = 0;
  const enviar = (manejador: Manejador, id: string | undefined, o: { metodo?: string; origen?: string | null; cookie?: string | null; slug?: string; verificado?: string | null } = {}) => {
    const { metodo = 'POST', origen = config.origen, cookie: c = cookie, slug = 'empresa-a', verificado = 'empresa-a' } = o;
    const peticion = new Request(`${config.origen}/e/${slug}/declaracion/x`, {
      method: metodo,
      headers: { ...(origen === null ? {} : { origin: origen }), ...(c ? { cookie: c } : {}) },
      ...(metodo === 'GET' ? {} : { body: new FormData() }),
    });
    return manejador(peticion, { slugDeLaDireccion: slug, slugVerificado: verificado, deps, ...(id !== undefined ? { id } : {}) });
  };
  return { llamadas, enviar, deps, cookie };
};

const destino = (r: Response): URL => new URL(r.headers.get('location')!);
const aviso = (r: Response) => destino(r).searchParams.get('aviso');

describe('aprobarDeclaracion', () => {
  it('pide a la API con el token, SIN cuerpo, y vuelve a la declaración con «declaracion_aprobada»', async () => {
    const { enviar, llamadas } = await montar({ estado: 201 });
    const r = await enviar(aprobarDeclaracion, undefined);
    expect(r.status).toBe(303);
    expect(destino(r).pathname).toBe('/e/empresa-a/declaracion');
    expect(aviso(r)).toBe('declaracion_aprobada');
    expect(llamadas).toEqual([{ metodo: 'POST', ruta: '/declaracion/aprobacion', autorizacion: 'Bearer acceso-inicial', tipoContenido: null, cuerpoVacio: true }]);
    expect(r.headers.get('cache-control')).toBe('no-store');
  });

  it.each([
    [409, 'declaracion_no_aprobada'],
    [403, 'sin_permiso'],
    [404, 'no_encontrado'],
    [400, 'no_valido'],
    [500, 'no_disponible'],
    [502, 'no_disponible'],
  ] as const)('si la API responde %d, el aviso es «%s» (cerrado: nunca texto de la API)', async (estado, esperado) => {
    const { enviar } = await montar({ estado, respuesta: () => new Response('{"detail":"TEXTO-DE-LA-API"}', { status: estado }) });
    const r = await enviar(aprobarDeclaracion, undefined);
    expect(aviso(r)).toBe(esperado);
    expect(r.headers.get('location')).not.toContain('TEXTO-DE-LA-API');
  });

  it('aprobar no depende del formulario: un POST vacío, sin tipo de contenido (como el de curl o fetch), también funciona', async () => {
    const { deps, llamadas, cookie } = await montar({ estado: 201 });
    const r = await aprobarDeclaracion(new Request(`${config.origen}/e/empresa-a/declaracion/aprobar`, { method: 'POST', headers: { origin: config.origen, cookie } }), { slugDeLaDireccion: 'empresa-a', slugVerificado: 'empresa-a', deps });
    expect(aviso(r)).toBe('declaracion_aprobada');
    expect(llamadas).toEqual([expect.objectContaining({ metodo: 'POST', ruta: '/declaracion/aprobacion', cuerpoVacio: true })]);
  });

  it('si la API no responde, «no_disponible»', async () => {
    const { enviar } = await montar({ estado: 'lanza' });
    expect(aviso(await enviar(aprobarDeclaracion, undefined))).toBe('no_disponible');
  });

  it('un 401 de la API cierra la sesión y manda a ingresar', async () => {
    const { enviar } = await montar({ estado: 401 });
    const r = await enviar(aprobarDeclaracion, undefined);
    expect(r.status).toBe(303);
    expect(destino(r).pathname).toBe('/auth/login');
    expect(r.headers.getSetCookie().some((c) => c.startsWith(`${config.nombreCookieSesion}=;`) || /Max-Age=0/.test(c))).toBe(true);
  });

  it('sin sesión manda a ingresar y no llama a la API', async () => {
    const { enviar, llamadas } = await montar();
    const r = await enviar(aprobarDeclaracion, undefined, { cookie: null });
    expect(destino(r).pathname).toBe('/auth/login');
    expect(llamadas).toEqual([]);
  });

  it.each([
    ['sin Origin', { origen: null }],
    ['con Origin «null»', { origen: 'null' }],
    ['con Origin de otro sitio', { origen: 'https://malo.example.test' }],
  ] as const)('%s: 403 y no llama a la API', async (_n, o) => {
    const { enviar, llamadas } = await montar();
    expect((await enviar(aprobarDeclaracion, undefined, o)).status).toBe(403);
    expect(llamadas).toEqual([]);
  });

  it('un GET responde 405 y no llama a la API', async () => {
    const { enviar, llamadas } = await montar();
    const r = await enviar(aprobarDeclaracion, undefined, { metodo: 'GET' });
    expect(r.status).toBe(405);
    expect(r.headers.get('allow')).toBe('POST');
    expect(llamadas).toEqual([]);
  });

  it('una empresa de la dirección distinta de la verificada es 404 y no llama a la API', async () => {
    const { enviar, llamadas } = await montar();
    expect((await enviar(aprobarDeclaracion, undefined, { slug: 'empresa-b', verificado: 'empresa-a' })).status).toBe(404);
    expect((await enviar(aprobarDeclaracion, undefined, { verificado: null })).status).toBe(404);
    expect(llamadas).toEqual([]);
  });

  it('los dos avisos nuevos se reconocen; uno desconocido se ignora', () => {
    expect(leerAvisoEscritura({ aviso: 'declaracion_aprobada' })).toBe('declaracion_aprobada');
    expect(leerAvisoEscritura({ aviso: 'declaracion_no_aprobada' })).toBe('declaracion_no_aprobada');
    expect(leerAvisoEscritura({ aviso: 'inventado' })).toBeNull();
  });
});

describe('descargas de la declaración', () => {
  const bytes = new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3, 4, 5, 6]);
  const ok = (extra: Record<string, string> = {}) => () =>
    new Response(bytes, { status: 200, headers: { 'content-type': DOCX, 'content-disposition': 'attachment; filename="declaracion-iso-iec-27001-borrador.docx"', 'content-length': String(bytes.length), ...extra } });

  it('el borrador: pide /declaracion/documento con el token, entrega idéntico como adjunto y no filtra el token', async () => {
    const { enviar, llamadas } = await montar({ respuesta: ok() });
    const r = await enviar(descargarBorradorDeclaracion, undefined, { metodo: 'GET' });
    expect(r.status).toBe(200);
    expect(Buffer.compare(Buffer.from(await r.arrayBuffer()), Buffer.from(bytes))).toBe(0);
    expect(llamadas).toEqual([expect.objectContaining({ metodo: 'GET', ruta: '/declaracion/documento', autorizacion: 'Bearer acceso-inicial' })]);
    expect(r.headers.get('content-type')).toBe(DOCX);
    expect(r.headers.get('content-disposition')).toMatch(/^attachment; filename="declaracion-iso-iec-27001-borrador\.docx"/);
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(r.headers.get('content-security-policy')).toBe("default-src 'none'; sandbox");
    expect(JSON.stringify([...r.headers.entries()])).not.toContain('acceso-inicial');
  });

  it('una versión: pide /declaracion/versiones/<id>/documento', async () => {
    const { enviar, llamadas } = await montar({ respuesta: ok() });
    const r = await enviar(descargarVersionDeclaracion, VERSION.toUpperCase(), { metodo: 'GET' });
    expect(r.status).toBe(200);
    expect(llamadas[0]?.ruta).toBe(`/declaracion/versiones/${VERSION}/documento`);
  });

  it.each(['no-es-uuid', '../x', '', undefined])('una versión con identificador %j es 404 y no llama a la API', async (id) => {
    const { enviar, llamadas } = await montar({ respuesta: ok() });
    expect((await enviar(descargarVersionDeclaracion, id, { metodo: 'GET' })).status).toBe(404);
    expect(llamadas).toEqual([]);
  });

  it('solo reenvía cabeceras de una lista cerrada', async () => {
    const { enviar } = await montar({ respuesta: ok({ 'set-cookie': 'robada=1', 'x-evil': '1', location: 'https://malo.example.test', 'content-security-policy': 'default-src *' }) });
    const r = await enviar(descargarBorradorDeclaracion, undefined, { metodo: 'GET' });
    expect(r.headers.get('x-evil')).toBeNull();
    expect(r.headers.get('location')).toBeNull();
    expect(r.headers.getSetCookie().some((c) => c.includes('robada'))).toBe(false);
    expect(r.headers.get('content-security-policy')).toBe("default-src 'none'; sandbox");
  });

  it('SIEMPRE adjunto: una disposición «inline» u hostil se cambia por un adjunto genérico', async () => {
    for (const d of ['inline; filename="x.docx"', 'attachment; filename="a"; x=y', '', 'attachment; filename="' + 'a'.repeat(300) + '"']) {
      const { enviar } = await montar({ respuesta: ok({ 'content-disposition': d }) });
      const r = await enviar(descargarBorradorDeclaracion, undefined, { metodo: 'GET' });
      expect(r.headers.get('content-disposition'), d).toBe('attachment; filename="declaracion.docx"');
    }
  });

  it.each(['application/pdf', 'text/html', 'image/svg+xml', 'application/zip', '', 'text/html; charset=utf-8'])('solo se entrega un Word: el tipo %j no se entrega («no_disponible»)', async (tipo) => {
    const { enviar } = await montar({ respuesta: ok({ 'content-type': tipo }) });
    const r = await enviar(descargarBorradorDeclaracion, undefined, { metodo: 'GET' });
    expect(r.status).toBe(303);
    expect(aviso(r)).toBe('no_disponible');
    expect(destino(r).pathname).toBe('/e/empresa-a/declaracion');
  });

  it.each([
    [403, 'sin_permiso'],
    [404, 'no_encontrado'],
    [500, 'no_disponible'],
  ] as const)('si la API responde %d, vuelve a la declaración con «%s» y no entrega nada', async (estado, esperado) => {
    const { enviar } = await montar({ estado });
    for (const [m, id] of [[descargarBorradorDeclaracion, undefined], [descargarVersionDeclaracion, VERSION]] as const) {
      const r = await enviar(m, id, { metodo: 'GET' });
      expect(r.status).toBe(303);
      expect(destino(r).pathname).toBe('/e/empresa-a/declaracion');
      expect(aviso(r)).toBe(esperado);
    }
  });

  it('un 401 cierra la sesión; sin sesión manda a ingresar sin llamar a la API', async () => {
    const a = await montar({ estado: 401 });
    expect(destino(await a.enviar(descargarBorradorDeclaracion, undefined, { metodo: 'GET' })).pathname).toBe('/auth/login');
    const b = await montar({ respuesta: ok() });
    const r = await b.enviar(descargarBorradorDeclaracion, undefined, { metodo: 'GET', cookie: null });
    expect(destino(r).pathname).toBe('/auth/login');
    expect(b.llamadas).toEqual([]);
  });

  it('un POST responde 405; una empresa distinta de la verificada es 404; sin llamar a la API', async () => {
    const { enviar, llamadas } = await montar({ respuesta: ok() });
    expect((await enviar(descargarBorradorDeclaracion, undefined)).status).toBe(405);
    expect((await enviar(descargarBorradorDeclaracion, undefined, { metodo: 'GET', slug: 'empresa-b', verificado: 'empresa-a' })).status).toBe(404);
    expect((await enviar(descargarVersionDeclaracion, VERSION, { metodo: 'GET', verificado: null })).status).toBe(404);
    expect(llamadas).toEqual([]);
  });
});
