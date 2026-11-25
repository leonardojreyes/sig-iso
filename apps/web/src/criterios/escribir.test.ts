// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AlmacenAcceso } from '../auth/almacen-acceso';
import { leerConfiguracion } from '../auth/configuracion';
import type { ResultadoCallback } from '../auth/flujo';
import { crearServicioSesion } from '../auth/sesion';
import { guardarCriterios } from './escribir';

// Criterios de evaluación desde la web (ADR 038): la web no decide nada; reenvía a la API con el token y una lista cerrada de campos.
const config = leerConfiguracion({ OIDC_CLIENT_SECRET: randomBytes(18).toString('base64url'), SESSION_SEALING_KEY: randomBytes(32).toString('base64url') });
const AHORA = new Date('2026-11-18T10:00:00Z');
const callbackOk = (): Extract<ResultadoCallback, { ok: true }> => ({
  ok: true,
  tokens: { acceso: 'acceso-inicial', refresco: 'refresco-0', id: 'id.token.firmado' },
  identidad: { sub: '5eed0001-0000-4000-8000-0000000000a1', sid: 'sesion-kc-1' },
  retorno: '/',
  limpiarCookie: 'sig-oidc=; Max-Age=0',
});

type Llamada = { metodo: string; ruta: string; autorizacion: string | null; cuerpo: unknown };
const montar = async (estadoApi: number | 'lanza' = 200, cabecerasApi: Record<string, string> = {}) => {
  const llamadas: Llamada[] = [];
  const fetchFn = (async (url: string, init: RequestInit = {}) => {
    if (url.startsWith(`${config.apiUrl}/sesion/`)) return new Response(null, { status: 204 });
    if (url.startsWith(config.apiUrl)) {
      const cuerpo = init.body instanceof FormData ? [...init.body.keys()] : typeof init.body === 'string' ? JSON.parse(init.body) : null;
      llamadas.push({ metodo: init.method ?? 'GET', ruta: url.replace(config.apiUrl, ''), autorizacion: new Headers(init.headers).get('authorization'), cuerpo });
      if (estadoApi === 'lanza') throw new Error('ECONNREFUSED');
      return new Response(estadoApi === 204 ? null : '{}', { status: estadoApi, headers: cabecerasApi });
    }
    return new Response(null, { status: 404 });
  }) as unknown as typeof fetch;
  const deps = { config, ahora: () => AHORA, fetchFn, almacen: new AlmacenAcceso() };
  const r = await crearServicioSesion(deps).iniciar(callbackOk());
  const cookie = r.headers.getSetCookie().find((c) => c.startsWith(`${config.nombreCookieSesion}=`))!.split(';')[0]!;
  const enviar = (
    manejador: typeof guardarCriterios,
    ruta: string,
    campos: Record<string, string | string[]> | FormData,
    o: { metodo?: string; origen?: string | null; cookie?: string | null; slug?: string; verificado?: string | null; id?: string } = {},
  ) => {
    const { metodo = 'POST', origen = config.origen, cookie: c = cookie, slug = 'empresa-a', verificado = 'empresa-a', id } = o;
    let cuerpo: BodyInit | undefined;
    if (metodo !== 'GET') {
      if (campos instanceof FormData) cuerpo = campos;
      else {
        const p = new URLSearchParams();
        for (const [k, v] of Object.entries(campos)) for (const x of Array.isArray(v) ? v : [v]) p.append(k, x);
        cuerpo = p;
      }
    }
    const peticion = new Request(`${config.origen}/e/${slug}/criterios/${ruta}`, {
      method: metodo,
      headers: { ...(campos instanceof FormData || metodo === 'GET' ? {} : { 'content-type': 'application/x-www-form-urlencoded' }), ...(origen === null ? {} : { origin: origen }), ...(c ? { cookie: c } : {}) },
      ...(cuerpo !== undefined ? { body: cuerpo } : {}),
    });
    return manejador(peticion, { slugDeLaDireccion: slug, slugVerificado: verificado, deps, ...(id ? { id } : {}) });
  };
  llamadas.length = 0;
  return { llamadas, enviar };
};
const destino = (r: Response): URL => new URL(r.headers.get('location')!);
const aviso = (r: Response) => destino(r).searchParams.get('aviso');
const eje = (p: string) => Object.fromEntries([1, 2, 3, 4, 5].map((n) => [`${p}_${n}`, ` ${p} ${n} `]));
const form = { ...eje('probabilidad'), ...eje('impacto'), nivelAceptacion: 'medio', version: '0' };
const cinco = (p: string) => [1, 2, 3, 4, 5].map((n) => `${p} ${n}`);

describe('guardar los criterios', () => {
  it('reenvía con el token y SOLO los campos conocidos: diez descripciones recortadas, el nivel y la versión que se vio', async () => {
    const { enviar, llamadas } = await montar(200);
    const r = await enviar(guardarCriterios, 'guardar', { ...form, empresaId: 'otra', version: '3', origen: 'omision' });
    expect(r.status).toBe(303);
    expect(destino(r).pathname).toBe('/e/empresa-a/criterios');
    expect(aviso(r)).toBe('criterios_guardados');
    expect(llamadas).toEqual([{ metodo: 'PUT', ruta: '/criterios', autorizacion: 'Bearer acceso-inicial', cuerpo: { probabilidad: cinco('probabilidad'), impacto: cinco('impacto'), nivelAceptacion: 'medio', versionEsperada: 3 } }]);
  });
  it('un formulario incompleto o con valores fuera de lista no llega a la API', async () => {
    const { enviar, llamadas } = await montar(200);
    const sin = { ...form } as Record<string, string>;
    delete sin['impacto_3'];
    for (const mal of [sin, { ...form, probabilidad_2: '   ' }, { ...form, impacto_5: 'x'.repeat(201) }, { ...form, nivelAceptacion: 'enorme' }, { ...form, nivelAceptacion: '' }, { ...form, version: '-1' }, { ...form, version: 'x' }, { ...form, version: '' }])
      expect(aviso(await enviar(guardarCriterios, 'guardar', mal)), JSON.stringify(mal).slice(0, 60)).toBe('no_valido');
    expect(llamadas).toEqual([]);
  });
  it('los rechazos de la API vuelven como avisos cerrados', async () => {
    expect(aviso(await (await montar(403)).enviar(guardarCriterios, 'guardar', form))).toBe('sin_permiso');
    expect(aviso(await (await montar(409)).enviar(guardarCriterios, 'guardar', form))).toBe('conflicto');
    expect(aviso(await (await montar(400)).enviar(guardarCriterios, 'guardar', form))).toBe('no_valido');
    expect(aviso(await (await montar('lanza')).enviar(guardarCriterios, 'guardar', form))).toBe('no_disponible');
  });
  it('sin Origen propio, con otra empresa o con GET no hace nada; sin sesión lleva a ingresar', async () => {
    const { enviar, llamadas } = await montar(200);
    expect((await enviar(guardarCriterios, 'guardar', form, { origen: 'https://malo.example.test' })).status).toBe(403);
    expect((await enviar(guardarCriterios, 'guardar', form, { origen: null })).status).toBe(403);
    expect((await enviar(guardarCriterios, 'guardar', form, { slug: 'empresa-b', verificado: 'empresa-a' })).status).toBe(404);
    expect((await enviar(guardarCriterios, 'guardar', {}, { metodo: 'GET' })).status).toBe(405);
    expect((await enviar(guardarCriterios, 'guardar', form, { cookie: null })).headers.get('location')).toContain('/auth/login');
    expect(llamadas).toEqual([]);
  });
});
