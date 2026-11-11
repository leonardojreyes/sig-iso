// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AlmacenAcceso } from '../auth/almacen-acceso';
import { leerConfiguracion } from '../auth/configuracion';
import type { ResultadoCallback } from '../auth/flujo';
import { crearServicioSesion } from '../auth/sesion';
import { aprobarAlcance, evaluarEntrada, guardarAlcance, leerAvisoEscritura } from './escribir';

const AHORA = new Date('2026-11-10T10:00:00Z');
const config = leerConfiguracion({ OIDC_CLIENT_SECRET: randomBytes(18).toString('base64url'), SESSION_SEALING_KEY: randomBytes(32).toString('base64url') });

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
      return new Response('{}', { status: estadoApi });
    }
    return new Response(null, { status: 404 });
  }) as unknown as typeof fetch;
  const deps = { config, ahora: () => AHORA, fetchFn, almacen: new AlmacenAcceso() };
  const r = await crearServicioSesion(deps).iniciar(callbackOk());
  const cookie = r.headers.getSetCookie().find((c) => c.startsWith(`${config.nombreCookieSesion}=`))!.split(';')[0]!;
  const enviar = (
    manejador: typeof guardarAlcance,
    ruta: string,
    campos: Record<string, string>,
    o: { metodo?: string; origen?: string | null; cookie?: string | null; slug?: string; verificado?: string | null } = {},
  ) => {
    const { metodo = 'POST', origen = config.origen, cookie: c = cookie, slug = 'empresa-a', verificado = 'empresa-a' } = o;
    const cuerpo = new URLSearchParams(campos);
    const peticion = new Request(`${config.origen}/e/${slug}/${ruta}`, {
      method: metodo,
      headers: { 'content-type': 'application/x-www-form-urlencoded', ...(origen === null ? {} : { origin: origen }), ...(c ? { cookie: c } : {}) },
      ...(metodo === 'GET' ? {} : { body: cuerpo }),
    });
    return manejador(peticion, { slugDeLaDireccion: slug, slugVerificado: verificado, deps });
  };
  llamadas.length = 0;
  return { llamadas, enviar };
};

const destino = (r: Response): URL => new URL(r.headers.get('location')!);
const NORMA = 'ISO/IEC 27001';
const alcance = { norma: NORMA, texto: 'Desarrollo de software en Quito.' };
const evaluacion = { libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1', estado: 'parcial', comentario: ' Falta aprobar. ', fechaObjetivo: '2026-12-31', version: '2', f_estado: 'sin_evaluar', f_q: 'política', f_x: 'ignorado' };

describe('escrituras de alcance y diagnóstico desde la web', () => {
  it('guardar el alcance reenvía a la API con el token y SOLO los campos conocidos', async () => {
    const { enviar, llamadas } = await montar();
    const r = await enviar(guardarAlcance, 'alcance/guardar', { ...alcance, empresaId: 'otra-empresa', rol: 'administrador_sig' });
    expect(r.status).toBe(303);
    expect(destino(r).pathname + destino(r).search).toBe('/e/empresa-a/alcance?aviso=guardado');
    expect(llamadas).toEqual([{ metodo: 'PUT', ruta: '/alcances', autorizacion: 'Bearer acceso-inicial', cuerpo: alcance }]);
    expect(r.headers.get('cache-control')).toBe('no-store');
  });

  it('aprobar manda solo la norma', async () => {
    const { enviar, llamadas } = await montar();
    const r = await enviar(aprobarAlcance, 'alcance/aprobar', { norma: NORMA, texto: 'no se reenvía' });
    expect(destino(r).search).toBe('?aviso=aprobado');
    expect(llamadas[0]).toMatchObject({ metodo: 'POST', ruta: '/alcances/aprobacion', cuerpo: { norma: NORMA } });
  });

  it('evaluar arma el cuerpo con campos cerrados, recorta el comentario, manda la versión y conserva los filtros', async () => {
    const { enviar, llamadas } = await montar();
    const r = await enviar(evaluarEntrada, 'diagnostico/evaluar', evaluacion);
    expect(destino(r).pathname).toBe('/e/empresa-a/diagnostico');
    expect(destino(r).searchParams.get('aviso')).toBe('evaluado');
    expect(destino(r).searchParams.get('q')).toBe('política');
    expect(destino(r).searchParams.get('estado')).toBe('sin_evaluar'); // el filtro de la pantalla se conserva
    expect(destino(r).searchParams.get('x')).toBeNull();
    expect(llamadas[0]!.cuerpo).toEqual({ libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1', estado: 'parcial', comentario: 'Falta aprobar.', fechaObjetivo: '2026-12-31', versionEsperada: 2 });
  });

  it('sin versión es la primera vez (0) y el comentario vacío viaja como nulo', async () => {
    const { enviar, llamadas } = await montar();
    const sin: Record<string, string> = { ...evaluacion };
    delete sin.version;
    delete sin.comentario;
    await enviar(evaluarEntrada, 'diagnostico/evaluar', sin);
    expect(llamadas[0]!.cuerpo).toMatchObject({ versionEsperada: 0, comentario: null });
  });

  it('traduce cada estado de la API a un aviso cerrado', async () => {
    for (const [estado, aviso] of [[400, 'no_valido'], [403, 'sin_permiso'], [404, 'no_encontrado'], [409, 'conflicto'], [500, 'no_disponible'], ['lanza', 'no_disponible']] as const) {
      const { enviar } = await montar(estado);
      expect(destino(await enviar(evaluarEntrada, 'diagnostico/evaluar', evaluacion)).searchParams.get('aviso'), String(estado)).toBe(aviso);
    }
  });

  it('un 401 de la API lleva a ingresar y cierra la sesión', async () => {
    const { enviar } = await montar(401);
    const r = await enviar(guardarAlcance, 'alcance/guardar', alcance);
    expect(destino(r).pathname).toBe('/auth/login');
    expect(destino(r).searchParams.get('retorno')).toBe('/e/empresa-a/alcance');
    expect(r.headers.getSetCookie().some((c) => c.startsWith(`${config.nombreCookieSesion}=;`) || /Max-Age=0/i.test(c))).toBe(true);
  });

  it('rechaza lo que no es un formulario propio: GET 405, Origin ajeno o ausente 403, empresa distinta 404', async () => {
    const { enviar, llamadas } = await montar();
    expect((await enviar(guardarAlcance, 'alcance/guardar', alcance, { metodo: 'GET' })).status).toBe(405);
    expect((await enviar(guardarAlcance, 'alcance/guardar', alcance, { origen: 'https://malo.example.test' })).status).toBe(403);
    expect((await enviar(guardarAlcance, 'alcance/guardar', alcance, { origen: null })).status).toBe(403);
    expect((await enviar(guardarAlcance, 'alcance/guardar', alcance, { verificado: 'empresa-b' })).status).toBe(404);
    expect((await enviar(guardarAlcance, 'alcance/guardar', alcance, { verificado: null })).status).toBe(404);
    expect(llamadas).toEqual([]);
  });

  it('sin sesión lleva a ingresar, sin llamar a la API', async () => {
    const { enviar, llamadas } = await montar();
    const r = await enviar(guardarAlcance, 'alcance/guardar', alcance, { cookie: null });
    expect(destino(r).pathname).toBe('/auth/login');
    expect(llamadas).toEqual([]);
  });

  it('un formulario con datos mal formados vuelve con «no_valido» sin llamar a la API', async () => {
    const { enviar, llamadas } = await montar();
    const malos: Array<[typeof guardarAlcance, string, Record<string, string>]> = [
      [guardarAlcance, 'alcance/guardar', { norma: 'ISO <script>', texto: 'x' }],
      [guardarAlcance, 'alcance/guardar', { norma: NORMA, texto: '   ' }],
      [aprobarAlcance, 'alcance/aprobar', {}],
      [evaluarEntrada, 'diagnostico/evaluar', { ...evaluacion, estado: 'quizas' }],
      [evaluarEntrada, 'diagnostico/evaluar', { ...evaluacion, idEstable: '../x' }],
      [evaluarEntrada, 'diagnostico/evaluar', { ...evaluacion, version: '-1' }],
      [evaluarEntrada, 'diagnostico/evaluar', { ...evaluacion, fechaObjetivo: '31/12/2026' }],
      [evaluarEntrada, 'diagnostico/evaluar', { ...evaluacion, responsableId: 'no-uuid' }],
    ];
    for (const [m, ruta, campos] of malos) expect(destino(await enviar(m, ruta, campos)).searchParams.get('aviso'), JSON.stringify(campos)).toBe('no_valido');
    expect(llamadas).toEqual([]);
  });

  it('el aviso de la dirección solo acepta valores conocidos', () => {
    expect(leerAvisoEscritura({ aviso: 'conflicto' })).toBe('conflicto');
    expect(leerAvisoEscritura({ aviso: '<b>x</b>' })).toBeNull();
    expect(leerAvisoEscritura({ aviso: ['guardado', 'aprobado'] })).toBeNull();
    expect(leerAvisoEscritura({})).toBeNull();
  });
});
