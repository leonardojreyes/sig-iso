// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AlmacenAcceso } from '../auth/almacen-acceso';
import { leerConfiguracion } from '../auth/configuracion';
import type { ResultadoCallback } from '../auth/flujo';
import { crearServicioSesion } from '../auth/sesion';
import { cambiarControl, crearControl, desmapearControl, mapearControl, retirarControl } from './escribir';

const config = leerConfiguracion({ OIDC_CLIENT_SECRET: randomBytes(18).toString('base64url'), SESSION_SEALING_KEY: randomBytes(32).toString('base64url') });
const AHORA = new Date('2026-11-11T10:00:00Z');
const ID = 'cccccccc-1111-4111-8111-111111111111';
const callbackOk = (): Extract<ResultadoCallback, { ok: true }> => ({
  ok: true,
  tokens: { acceso: 'acceso-inicial', refresco: 'refresco-0', id: 'id.token.firmado' },
  identidad: { sub: '5eed0001-0000-4000-8000-0000000000a1', sid: 'sesion-kc-1' },
  retorno: '/',
  limpiarCookie: 'sig-oidc=; Max-Age=0',
});

const montar = async (estadoApi: number | 'lanza' = 200) => {
  const llamadas: Array<{ metodo: string; ruta: string; autorizacion: string | null; cuerpo: unknown }> = [];
  const fetchFn = (async (url: string, init: RequestInit = {}) => {
    if (url.startsWith(`${config.apiUrl}/sesion/`)) return new Response(null, { status: 204 });
    if (url.startsWith(config.apiUrl)) {
      llamadas.push({ metodo: init.method ?? 'GET', ruta: url.replace(config.apiUrl, ''), autorizacion: new Headers(init.headers).get('authorization'), cuerpo: typeof init.body === 'string' ? JSON.parse(init.body) : null });
      if (estadoApi === 'lanza') throw new Error('ECONNREFUSED');
      return new Response(estadoApi === 204 ? null : '{}', { status: estadoApi });
    }
    return new Response(null, { status: 404 });
  }) as unknown as typeof fetch;
  const deps = { config, ahora: () => AHORA, fetchFn, almacen: new AlmacenAcceso() };
  const r = await crearServicioSesion(deps).iniciar(callbackOk());
  const cookie = r.headers.getSetCookie().find((c) => c.startsWith(`${config.nombreCookieSesion}=`))!.split(';')[0]!;
  const enviar = (
    manejador: typeof crearControl,
    ruta: string,
    campos: Record<string, string>,
    o: { metodo?: string; origen?: string | null; cookie?: string | null; slug?: string; verificado?: string | null } = {},
  ) => {
    const { metodo = 'POST', origen = config.origen, cookie: c = cookie, slug = 'empresa-a', verificado = 'empresa-a' } = o;
    const peticion = new Request(`${config.origen}/e/${slug}/controles/${ruta}`, {
      method: metodo,
      headers: { 'content-type': 'application/x-www-form-urlencoded', ...(origen === null ? {} : { origin: origen }), ...(c ? { cookie: c } : {}) },
      ...(metodo === 'GET' ? {} : { body: new URLSearchParams(campos) }),
    });
    return manejador(peticion, { slugDeLaDireccion: slug, slugVerificado: verificado, deps });
  };
  llamadas.length = 0;
  return { llamadas, enviar };
};
const destino = (r: Response): URL => new URL(r.headers.get('location')!);
const aviso = (r: Response) => destino(r).searchParams.get('aviso');
const ENTRADA = 'iso-27001-2022-anexo-a|a27-5-1';

describe('escrituras de controles y mapeos desde la web', () => {
  it('crear reenvía a la API con el token y SOLO los campos conocidos', async () => {
    const { enviar, llamadas } = await montar(201);
    const r = await enviar(crearControl, 'crear', { codigo: ' C-001 ', nombre: ' Política de contraseñas ', descripcion: '  ', empresaId: 'otra', estado: 'retirado', f_norma: 'ISO 9001', f_retirados: 'true' });
    expect(r.status).toBe(303);
    expect(destino(r).pathname).toBe('/e/empresa-a/controles');
    expect(aviso(r)).toBe('creado');
    expect(destino(r).searchParams.get('norma')).toBe('ISO 9001');
    expect(destino(r).searchParams.get('retirados')).toBe('true');
    expect(llamadas).toEqual([{ metodo: 'POST', ruta: '/controles', autorizacion: 'Bearer acceso-inicial', cuerpo: { codigo: 'C-001', nombre: 'Política de contraseñas', descripcion: null } }]);
  });

  it('cambiar manda la versión que se vio y va a la ruta del control', async () => {
    const { enviar, llamadas } = await montar();
    const r = await enviar(cambiarControl, 'cambiar', { id: ID.toUpperCase(), version: '3', nombre: 'Gestión de contraseñas', descripcion: 'Cada trimestre.', responsableId: 'no-se-reenvia' });
    expect(aviso(r)).toBe('guardado');
    expect(llamadas).toEqual([{ metodo: 'PUT', ruta: `/controles/${ID}`, autorizacion: 'Bearer acceso-inicial', cuerpo: { versionEsperada: 3, nombre: 'Gestión de contraseñas', descripcion: 'Cada trimestre.' } }]);
  });

  it('retirar manda solo la versión', async () => {
    const { enviar, llamadas } = await montar();
    expect(aviso(await enviar(retirarControl, 'retirar', { id: ID, version: '2' }))).toBe('retirado');
    expect(llamadas[0]).toMatchObject({ metodo: 'POST', ruta: `/controles/${ID}/retiro`, cuerpo: { versionEsperada: 2 } });
  });

  it('relacionar: 201 «relacionada» y 200 «ya existía» (sin error)', async () => {
    for (const [estado, esperado] of [[201, 'mapeado'], [200, 'sin_cambios']] as const) {
      const { enviar, llamadas } = await montar(estado);
      expect(aviso(await enviar(mapearControl, 'mapear', { id: ID, entrada: ENTRADA })), String(estado)).toBe(esperado);
      expect(llamadas[0]).toMatchObject({ metodo: 'POST', ruta: `/controles/${ID}/mapeos`, cuerpo: { libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1' } });
    }
  });

  it('quitar la relación acepta el 204 de la API', async () => {
    const { enviar, llamadas } = await montar(204);
    expect(aviso(await enviar(desmapearControl, 'desmapear', { id: ID, entrada: ENTRADA }))).toBe('desmapeado');
    expect(llamadas[0]).toMatchObject({ metodo: 'POST', ruta: `/controles/${ID}/mapeos/eliminacion` });
  });

  it('traduce cada estado de la API a un aviso cerrado', async () => {
    for (const [estado, esperado] of [[400, 'no_valido'], [403, 'sin_permiso'], [404, 'no_encontrado'], [409, 'conflicto'], [500, 'no_disponible'], ['lanza', 'no_disponible']] as const) {
      const { enviar } = await montar(estado);
      expect(aviso(await enviar(retirarControl, 'retirar', { id: ID, version: '1' })), String(estado)).toBe(esperado);
    }
  });

  it('un 401 de la API lleva a ingresar y cierra la sesión', async () => {
    const { enviar } = await montar(401);
    const r = await enviar(crearControl, 'crear', { codigo: 'C-1', nombre: 'x' });
    expect(destino(r).pathname).toBe('/auth/login');
    expect(destino(r).searchParams.get('retorno')).toBe('/e/empresa-a/controles');
  });

  it('rechaza lo que no es un formulario propio: GET 405, Origin ajeno o ausente 403, empresa distinta 404, sin llamar a la API', async () => {
    const { enviar, llamadas } = await montar();
    const campos = { codigo: 'C-1', nombre: 'x' };
    expect((await enviar(crearControl, 'crear', campos, { metodo: 'GET' })).status).toBe(405);
    expect((await enviar(crearControl, 'crear', campos, { origen: 'https://malo.example.test' })).status).toBe(403);
    expect((await enviar(crearControl, 'crear', campos, { origen: null })).status).toBe(403);
    expect((await enviar(crearControl, 'crear', campos, { verificado: 'empresa-b' })).status).toBe(404);
    expect((await enviar(crearControl, 'crear', campos, { verificado: null })).status).toBe(404);
    expect(llamadas).toEqual([]);
  });

  it('sin sesión lleva a ingresar, sin llamar a la API', async () => {
    const { enviar, llamadas } = await montar();
    expect(destino(await enviar(crearControl, 'crear', { codigo: 'C-1', nombre: 'x' }, { cookie: null })).pathname).toBe('/auth/login');
    expect(llamadas).toEqual([]);
  });

  it('un formulario con datos mal formados vuelve con «no_valido» sin llamar a la API', async () => {
    const { enviar, llamadas } = await montar();
    const malos: Array<[typeof crearControl, string, Record<string, string>]> = [
      [crearControl, 'crear', { codigo: 'C 1', nombre: 'x' }], [crearControl, 'crear', { codigo: 'C-1', nombre: '   ' }], [crearControl, 'crear', {}],
      [cambiarControl, 'cambiar', { id: 'no-uuid', version: '1', nombre: 'x' }], [cambiarControl, 'cambiar', { id: ID, version: '0', nombre: 'x' }],
      [cambiarControl, 'cambiar', { id: ID, version: 'uno', nombre: 'x' }], [cambiarControl, 'cambiar', { id: ID, version: '1', nombre: '' }],
      [retirarControl, 'retirar', { id: ID }], [retirarControl, 'retirar', { id: '../x', version: '1' }],
      [mapearControl, 'mapear', { id: ID, entrada: 'sin-barra' }], [mapearControl, 'mapear', { id: ID, entrada: 'ISO|a27' }],
      [mapearControl, 'mapear', { id: ID, entrada: 'a|b|c' }], [mapearControl, 'mapear', { id: ID, entrada: 'x|../y' }], [mapearControl, 'mapear', { entrada: ENTRADA }],
      [desmapearControl, 'desmapear', { id: 'x', entrada: ENTRADA }],
    ];
    for (const [m, ruta, campos] of malos) expect(aviso(await enviar(m, ruta, campos)), JSON.stringify(campos)).toBe('no_valido');
    expect(llamadas).toEqual([]);
  });

  it('un filtro conservado inválido se descarta, no se refleja', async () => {
    const { enviar } = await montar();
    const r = await enviar(retirarControl, 'retirar', { id: ID, version: '1', f_norma: '<script>', f_retirados: 'raro' });
    expect([...destino(r).searchParams.keys()]).toEqual(['aviso']);
  });
});
