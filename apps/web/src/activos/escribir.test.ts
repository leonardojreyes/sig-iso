// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AlmacenAcceso } from '../auth/almacen-acceso';
import { leerConfiguracion } from '../auth/configuracion';
import type { ResultadoCallback } from '../auth/flujo';
import { crearServicioSesion } from '../auth/sesion';
import { cambiarActivo, crearActivo, desligarActivo, ligarActivo, retirarActivo } from './escribir';

// Activos de información desde la web (ADR 038): la web no decide nada; reenvía a la API con el token y una lista cerrada de campos.
const config = leerConfiguracion({ OIDC_CLIENT_SECRET: randomBytes(18).toString('base64url'), SESSION_SEALING_KEY: randomBytes(32).toString('base64url') });
const AHORA = new Date('2026-11-18T10:00:00Z');
const ACT = 'aaaaaaaa-1111-4111-8111-111111111111';
const RIESGO = 'eeeeeeee-1111-4111-8111-111111111111';
const PERSONA = '22222222-2222-4222-8222-222222222222';
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
    manejador: typeof crearActivo,
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
    const peticion = new Request(`${config.origen}/e/${slug}/activos/${ruta}`, {
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
const nuevo = { nombre: ' Servidor de archivos ', descripcion: '  ', tipo: 'infraestructura', clasificacion: 'confidencial', responsableId: PERSONA };

describe('crear, cambiar y retirar un activo', () => {
  it('crear reenvía con el token y SOLO los campos conocidos; lo vacío no se manda', async () => {
    const { enviar, llamadas } = await montar(201);
    const r = await enviar(crearActivo, 'crear', { ...nuevo, empresaId: 'otra', codigo: 'A-999', estado: 'retirado' });
    expect(r.status).toBe(303);
    expect(destino(r).pathname).toBe('/e/empresa-a/activos');
    expect(aviso(r)).toBe('activo_creado');
    expect(llamadas).toEqual([{ metodo: 'POST', ruta: '/activos', autorizacion: 'Bearer acceso-inicial', cuerpo: { nombre: 'Servidor de archivos', tipo: 'infraestructura', clasificacion: 'confidencial', responsableId: PERSONA } }]);
  });
  it('un formulario sin lo mínimo o con valores fuera de lista no llega a la API', async () => {
    const { enviar, llamadas } = await montar(201);
    for (const mal of [{ tipo: 'cosa' }, { clasificacion: 'secreta' }, { nombre: '   ' }, { responsableId: 'x' }, { responsableId: '' }, { nombre: 'x'.repeat(121) }, { descripcion: 'x'.repeat(501) }]) expect(aviso(await enviar(crearActivo, 'crear', { ...nuevo, ...mal })), JSON.stringify(mal)).toBe('no_valido');
    expect(llamadas).toEqual([]);
  });
  it('cambiar manda la versión que se vio, va a la ruta del activo y vuelve a su pantalla; la descripción vacía la borra', async () => {
    const { enviar, llamadas } = await montar(200);
    const r = await enviar(cambiarActivo, `${ACT}/cambiar`, { version: '3', ...nuevo }, { id: ACT });
    expect(destino(r).pathname).toBe(`/e/empresa-a/activos/${ACT}`);
    expect(aviso(r)).toBe('activo_guardado');
    expect(llamadas).toEqual([{ metodo: 'PUT', ruta: `/activos/${ACT}`, autorizacion: 'Bearer acceso-inicial', cuerpo: { versionEsperada: 3, nombre: 'Servidor de archivos', tipo: 'infraestructura', clasificacion: 'confidencial', responsableId: PERSONA, descripcion: null } }]);
    const sin = await montar(200);
    expect(aviso(await sin.enviar(cambiarActivo, `${ACT}/cambiar`, { ...nuevo }, { id: ACT }))).toBe('no_valido'); // sin versión
    expect(sin.llamadas).toEqual([]);
  });
  it('retirar manda la versión y un identificador que no es UUID responde 404 sin llamar a la API', async () => {
    const { enviar, llamadas } = await montar(200);
    expect(aviso(await enviar(retirarActivo, `${ACT}/retirar`, { version: '2' }, { id: ACT }))).toBe('activo_retirado');
    expect(llamadas[0]).toMatchObject({ metodo: 'POST', ruta: `/activos/${ACT}/retiro`, cuerpo: { versionEsperada: 2 } });
    expect((await enviar(retirarActivo, 'x/retirar', { version: '2' }, { id: 'no-es-uuid' })).status).toBe(404);
    expect(aviso(await enviar(retirarActivo, `${ACT}/retirar`, {}, { id: ACT }))).toBe('no_valido');
    expect(llamadas).toHaveLength(1);
  });
});

describe('ligar y desligar un activo de un riesgo', () => {
  it('manda el riesgo en la ruta y el activo en el cuerpo, y vuelve al detalle del riesgo', async () => {
    const { enviar, llamadas } = await montar(201);
    const r = await enviar(ligarActivo, 'ligar-activo', { riesgoId: RIESGO, activoId: ACT.toUpperCase() });
    expect(destino(r).pathname).toBe(`/e/empresa-a/riesgos/${RIESGO}`);
    expect(aviso(r)).toBe('activo_ligado');
    await enviar(desligarActivo, 'desligar-activo', { riesgoId: RIESGO, activoId: ACT });
    expect(llamadas.map((l) => [l.ruta, l.cuerpo])).toEqual([[`/riesgos/${RIESGO}/activos`, { activoId: ACT }], [`/riesgos/${RIESGO}/activos/eliminacion`, { activoId: ACT }]]);
  });
  it('sin riesgo o sin activo válidos no llega a la API', async () => {
    const { enviar, llamadas } = await montar(201);
    expect(aviso(await enviar(ligarActivo, 'ligar-activo', { riesgoId: 'x', activoId: ACT }))).toBe('no_valido');
    expect(aviso(await enviar(ligarActivo, 'ligar-activo', { riesgoId: RIESGO }))).toBe('no_valido');
    expect(llamadas).toEqual([]);
  });
});

describe('guardias del formulario y respuestas de la API', () => {
  it('sin Origen propio, con otra empresa o con GET, no hace nada', async () => {
    const { enviar, llamadas } = await montar(201);
    expect((await enviar(crearActivo, 'crear', nuevo, { origen: 'https://malo.example.test' })).status).toBe(403);
    expect((await enviar(crearActivo, 'crear', nuevo, { origen: null })).status).toBe(403);
    expect((await enviar(crearActivo, 'crear', nuevo, { slug: 'empresa-b', verificado: 'empresa-a' })).status).toBe(404);
    expect((await enviar(crearActivo, 'crear', {}, { metodo: 'GET' })).status).toBe(405);
    expect(llamadas).toEqual([]);
  });
  it('los rechazos de la API vuelven como avisos cerrados', async () => {
    expect(aviso(await (await montar(403)).enviar(crearActivo, 'crear', nuevo))).toBe('sin_permiso');
    expect(aviso(await (await montar(409)).enviar(cambiarActivo, `${ACT}/cambiar`, { version: '1', ...nuevo }, { id: ACT }))).toBe('conflicto');
    expect(aviso(await (await montar(404)).enviar(retirarActivo, `${ACT}/retirar`, { version: '1' }, { id: ACT }))).toBe('no_encontrado');
    expect(aviso(await (await montar('lanza')).enviar(crearActivo, 'crear', nuevo))).toBe('no_disponible');
    expect((await (await montar(201)).enviar(crearActivo, 'crear', nuevo, { cookie: null })).headers.get('location')).toContain('/auth/login');
  });
});
