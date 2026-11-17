// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AlmacenAcceso } from '../auth/almacen-acceso';
import { leerConfiguracion } from '../auth/configuracion';
import type { ResultadoCallback } from '../auth/flujo';
import { crearServicioSesion } from '../auth/sesion';
import { aprobarSolicitudAcceso, cambiarRolPersona, darDeBajaPersona, descartarSolicitudAcceso, leerAvisoEscritura } from './escribir';

// Escrituras de personas desde la web (M7, ADR 036): la web NO decide nada; solo protege el formulario y reenvía a la API.
const AHORA = new Date('2026-11-16T10:00:00Z');
const config = leerConfiguracion({ OIDC_CLIENT_SECRET: randomBytes(18).toString('base64url'), SESSION_SEALING_KEY: randomBytes(32).toString('base64url') });
const SOL = '33333333-3333-4333-8333-333333333333';
const PER = '11111111-1111-4111-8111-111111111111';

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
      llamadas.push({ metodo: init.method ?? 'GET', ruta: url.replace(config.apiUrl, ''), autorizacion: new Headers(init.headers).get('authorization'), cuerpo: typeof init.body === 'string' ? JSON.parse(init.body) : init.body });
      if (estadoApi === 'lanza') throw new Error('ECONNREFUSED');
      return new Response(estadoApi === 204 ? null : '{}', { status: estadoApi });
    }
    return new Response(null, { status: 404 });
  }) as unknown as typeof fetch;
  const deps = { config, ahora: () => AHORA, fetchFn, almacen: new AlmacenAcceso() };
  const r = await crearServicioSesion(deps).iniciar(callbackOk());
  const cookie = r.headers.getSetCookie().find((c) => c.startsWith(`${config.nombreCookieSesion}=`))!.split(';')[0]!;
  const enviar = (
    manejador: typeof aprobarSolicitudAcceso,
    ruta: string,
    campos: Record<string, string>,
    o: { metodo?: string; origen?: string | null; cookie?: string | null; slug?: string; verificado?: string | null } = {},
  ) => {
    const { metodo = 'POST', origen = config.origen, cookie: c = cookie, slug = 'empresa-a', verificado = 'empresa-a' } = o;
    const peticion = new Request(`${config.origen}/e/${slug}/${ruta}`, {
      method: metodo,
      headers: { 'content-type': 'application/x-www-form-urlencoded', ...(origen === null ? {} : { origin: origen }), ...(c ? { cookie: c } : {}) },
      ...(metodo === 'GET' ? {} : { body: new URLSearchParams(campos) }),
    });
    return manejador(peticion, { slugDeLaDireccion: slug, slugVerificado: verificado, deps });
  };
  llamadas.length = 0;
  return { llamadas, enviar };
};

const aviso = (r: Response): string | null => new URL(r.headers.get('location')!).searchParams.get('aviso');
const aprobacion = { solicitud: SOL, nombre: '  Laura Mena ', correo: ' laura.mena@example.test ', rol: 'colaborador' };

describe('aprobar una solicitud de acceso', () => {
  it('reenvía a la API con el token y SOLO nombre, correo y rol (recortados); la empresa o la persona del formulario se ignoran', async () => {
    const { enviar, llamadas } = await montar(201);
    const r = await enviar(aprobarSolicitudAcceso, 'personas/aprobar', { ...aprobacion, empresaId: 'otra', usuarioId: PER, extra: 'x' });
    expect(r.status).toBe(303);
    expect(new URL(r.headers.get('location')!).pathname).toBe('/e/empresa-a/personas');
    expect(aviso(r)).toBe('persona_aprobada');
    expect(llamadas).toEqual([{ metodo: 'POST', ruta: `/personas/solicitudes/${SOL}/aprobacion`, autorizacion: 'Bearer acceso-inicial', cuerpo: { nombre: 'Laura Mena', correo: 'laura.mena@example.test', rol: 'colaborador' } }]);
    expect(r.headers.get('cache-control')).toBe('no-store');
    // Nada de lo escrito vuelve en la dirección.
    expect(r.headers.get('location')).not.toMatch(/Laura|Mena|example/);
  });

  it.each([
    ['rol inventado', { rol: 'jefe' }],
    ['sin nombre', { nombre: '   ' }],
    ['sin correo', { correo: '' }],
    ['nombre de más de 120 caracteres', { nombre: 'x'.repeat(121) }],
    ['solicitud que no es UUID', { solicitud: 'abc' }],
    ['sin solicitud', { solicitud: '' }],
  ])('%s → «no_valido» sin llamar a la API', async (_c, mala) => {
    const { enviar, llamadas } = await montar();
    const r = await enviar(aprobarSolicitudAcceso, 'personas/aprobar', { ...aprobacion, ...mala });
    expect(aviso(r)).toBe('no_valido');
    expect(llamadas).toEqual([]);
  });

  it.each([
    [201, 'persona_aprobada'],
    [200, 'persona_aprobada'],
    [403, 'sin_permiso'],
    [404, 'no_encontrado'],
    [409, 'personas_conflicto'],
    [400, 'no_valido'],
    [500, 'no_disponible'],
    ['lanza' as const, 'no_disponible'],
  ])('si la API responde %s, el aviso es «%s» (lista cerrada; nada del texto de la API)', async (estado, esperado) => {
    const { enviar } = await montar(estado);
    expect(aviso(await enviar(aprobarSolicitudAcceso, 'personas/aprobar', aprobacion))).toBe(esperado);
  });
});

describe('descartar una solicitud', () => {
  it('reenvía sin cuerpo y vuelve con el aviso', async () => {
    const { enviar, llamadas } = await montar(204);
    const r = await enviar(descartarSolicitudAcceso, 'personas/descartar', { solicitud: SOL });
    expect(aviso(r)).toBe('solicitud_descartada');
    expect(llamadas).toMatchObject([{ metodo: 'POST', ruta: `/personas/solicitudes/${SOL}/descarte`, autorizacion: 'Bearer acceso-inicial' }]);
  });
  it('una solicitud mal formada no llega a la API', async () => {
    const { enviar, llamadas } = await montar();
    expect(aviso(await enviar(descartarSolicitudAcceso, 'personas/descartar', { solicitud: '../x' }))).toBe('no_valido');
    expect(llamadas).toEqual([]);
  });
});

describe('cambiar el rol y dar de baja', () => {
  it('cambiar el rol manda el rol y la versión que vio el administrador, a la persona del formulario', async () => {
    const { enviar, llamadas } = await montar();
    const r = await enviar(cambiarRolPersona, 'personas/rol', { id: PER.toUpperCase(), rol: 'auditor_interno', version: '3' });
    expect(aviso(r)).toBe('rol_cambiado');
    expect(llamadas).toEqual([{ metodo: 'PUT', ruta: `/personas/${PER}/rol`, autorizacion: 'Bearer acceso-inicial', cuerpo: { rol: 'auditor_interno', versionEsperada: 3 } }]);
  });

  it.each([
    ['rol inventado', { rol: 'jefe', version: '3' }],
    ['versión que no es número', { rol: 'colaborador', version: '3; drop' }],
    ['versión 0', { rol: 'colaborador', version: '0' }],
    ['sin versión', { rol: 'colaborador' }],
  ])('cambiar el rol con %s → «no_valido» sin llamar a la API', async (_c, mala) => {
    const { enviar, llamadas } = await montar();
    expect(aviso(await enviar(cambiarRolPersona, 'personas/rol', { id: PER, ...mala }))).toBe('no_valido');
    expect(llamadas).toEqual([]);
  });

  it('dar de baja manda solo la versión', async () => {
    const { enviar, llamadas } = await montar();
    const r = await enviar(darDeBajaPersona, 'personas/baja', { id: PER, version: '2', rol: 'administrador_sig' });
    expect(aviso(r)).toBe('persona_dada_de_baja');
    expect(llamadas).toEqual([{ metodo: 'POST', ruta: `/personas/${PER}/baja`, autorizacion: 'Bearer acceso-inicial', cuerpo: { versionEsperada: 2 } }]);
  });

  it('un 409 (último administrador, versión vieja) vuelve como «personas_conflicto»', async () => {
    const { enviar } = await montar(409);
    expect(aviso(await enviar(darDeBajaPersona, 'personas/baja', { id: PER, version: '2' }))).toBe('personas_conflicto');
    expect(aviso(await enviar(cambiarRolPersona, 'personas/rol', { id: PER, rol: 'colaborador', version: '2' }))).toBe('personas_conflicto');
  });
});

describe.each([
  ['aprobar', aprobarSolicitudAcceso, aprobacion],
  ['descartar', descartarSolicitudAcceso, { solicitud: SOL }],
  ['rol', cambiarRolPersona, { id: PER, rol: 'colaborador', version: '1' }],
  ['baja', darDeBajaPersona, { id: PER, version: '1' }],
])('protección del formulario: %s', (_n, manejador, campos) => {
  it('un GET responde 405; sin Origin o con Origin ajeno, 403; empresa distinta a la verificada, 404; sin sesión, a ingresar; sin llamar a la API', async () => {
    const { enviar, llamadas } = await montar();
    expect((await enviar(manejador, 'p', campos, { metodo: 'GET' })).status).toBe(405);
    expect((await enviar(manejador, 'p', campos, { origen: null })).status).toBe(403);
    expect((await enviar(manejador, 'p', campos, { origen: 'https://malo.example' })).status).toBe(403);
    expect((await enviar(manejador, 'p', campos, { slug: 'empresa-b', verificado: 'empresa-a' })).status).toBe(404);
    expect((await enviar(manejador, 'p', campos, { verificado: null })).status).toBe(404);
    const sinSesion = await enviar(manejador, 'p', campos, { cookie: null });
    expect(sinSesion.status).toBe(303);
    expect(sinSesion.headers.get('location')).toContain('/auth/login');
    expect(llamadas).toEqual([]);
  });
});

describe('avisos de personas', () => {
  it('los cinco avisos nuevos se leen de la dirección y lo desconocido se ignora', () => {
    for (const a of ['persona_aprobada', 'solicitud_descartada', 'rol_cambiado', 'persona_dada_de_baja', 'personas_conflicto'])
      expect(leerAvisoEscritura({ aviso: a })).toBe(a);
    expect(leerAvisoEscritura({ aviso: 'inventado' })).toBeNull();
  });
});
