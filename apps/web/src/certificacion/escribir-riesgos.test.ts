// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AlmacenAcceso } from '../auth/almacen-acceso';
import { leerConfiguracion } from '../auth/configuracion';
import type { ResultadoCallback } from '../auth/flujo';
import { crearServicioSesion } from '../auth/sesion';
import { cambiarRiesgo, crearRiesgo, desvincularRiesgoControl, preverTratamientoRiesgo, quitarTratamientoRiesgo, retirarRiesgo, vincularRiesgoControl } from './escribir';

// Riesgos y sus vínculos desde la web (ADR 037): la web no decide nada; reenvía a la API con el token y una lista cerrada de campos.
const config = leerConfiguracion({ OIDC_CLIENT_SECRET: randomBytes(18).toString('base64url'), SESSION_SEALING_KEY: randomBytes(32).toString('base64url') });
const AHORA = new Date('2026-11-17T10:00:00Z');
const RIESGO = 'eeeeeeee-1111-4111-8111-111111111111';
const CONTROL = 'cccccccc-1111-4111-8111-111111111111';
const PERSONA = '22222222-2222-4222-8222-222222222222';
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
    manejador: typeof crearRiesgo,
    ruta: string,
    campos: Record<string, string>,
    o: { metodo?: string; origen?: string | null; cookie?: string | null; slug?: string; verificado?: string | null } = {},
  ) => {
    const { metodo = 'POST', origen = config.origen, cookie: c = cookie, slug = 'empresa-a', verificado = 'empresa-a' } = o;
    const peticion = new Request(`${config.origen}/e/${slug}/riesgos/${ruta}`, {
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
const nuevo = { titulo: ' Pérdida de portátiles ', descripcion: '  ', probabilidad: '3', impacto: '4', decision: 'mitigar', responsableId: '' };

describe('escrituras de riesgos y vínculos desde la web', () => {
  it('crear reenvía a la API con el token y SOLO los campos conocidos, y vuelve a la lista', async () => {
    const { enviar, llamadas } = await montar(201);
    const r = await enviar(crearRiesgo, 'crear', { ...nuevo, empresaId: 'otra', estado: 'retirado', nivel: 'critico', codigo: 'R-999', f_retirados: 'true' });
    expect(r.status).toBe(303);
    expect(destino(r).pathname).toBe('/e/empresa-a/riesgos');
    expect(aviso(r)).toBe('riesgo_creado');
    expect(destino(r).searchParams.get('retirados')).toBe('true');
    expect(llamadas).toEqual([{ metodo: 'POST', ruta: '/riesgos', autorizacion: 'Bearer acceso-inicial', cuerpo: { titulo: 'Pérdida de portátiles', descripcion: null, probabilidad: 3, impacto: 4, decision: 'mitigar', responsableId: null } }]);
  });

  it('crear con responsable lo manda; «aceptar» sin responsable lo decide la API, no la web', async () => {
    const { enviar, llamadas } = await montar(201);
    await enviar(crearRiesgo, 'crear', { ...nuevo, decision: 'aceptar', responsableId: PERSONA.toUpperCase() });
    expect(llamadas[0]?.cuerpo).toMatchObject({ decision: 'aceptar', responsableId: PERSONA.toUpperCase() });
    const { enviar: e2, llamadas: l2 } = await montar(400);
    expect(aviso(await e2(crearRiesgo, 'crear', { ...nuevo, decision: 'aceptar' }))).toBe('no_valido'); // la API respondió 400
    expect(l2).toHaveLength(1);
  });

  it('cambiar manda la versión que se vio, va a la ruta del riesgo y vuelve a su detalle; el responsable vacío lo quita', async () => {
    const { enviar, llamadas } = await montar();
    const r = await enviar(cambiarRiesgo, 'cambiar', { riesgoId: RIESGO.toUpperCase(), version: '3', ...nuevo, probabilidad: '5', impacto: '5', descripcion: 'Texto de la empresa', responsableId: '' });
    expect(aviso(r)).toBe('guardado');
    expect(destino(r).pathname).toBe(`/e/empresa-a/riesgos/${RIESGO}`);
    expect(llamadas).toEqual([{ metodo: 'PUT', ruta: `/riesgos/${RIESGO}`, autorizacion: 'Bearer acceso-inicial', cuerpo: { versionEsperada: 3, titulo: 'Pérdida de portátiles', descripcion: 'Texto de la empresa', probabilidad: 5, impacto: 5, decision: 'mitigar', responsableId: null } }]);
  });

  it('retirar manda solo la versión y vuelve a la lista', async () => {
    const { enviar, llamadas } = await montar();
    const r = await enviar(retirarRiesgo, 'retirar', { riesgoId: RIESGO, version: '2' });
    expect(aviso(r)).toBe('riesgo_retirado');
    expect(destino(r).pathname).toBe('/e/empresa-a/riesgos');
    expect(llamadas).toEqual([{ metodo: 'POST', ruta: `/riesgos/${RIESGO}/retiro`, autorizacion: 'Bearer acceso-inicial', cuerpo: { versionEsperada: 2 } }]);
  });

  it('vincular con un control: 201 «vinculado» y 200 «ya existía» (sin error); vuelve al detalle', async () => {
    for (const [estado, esperado] of [[201, 'vinculado'], [200, 'sin_cambios']] as const) {
      const { enviar, llamadas } = await montar(estado);
      const r = await enviar(vincularRiesgoControl, 'vincular', { riesgoId: RIESGO, controlId: CONTROL.toUpperCase(), extra: 'x' });
      expect(aviso(r), String(estado)).toBe(esperado);
      expect(destino(r).pathname).toBe(`/e/empresa-a/riesgos/${RIESGO}`);
      expect(llamadas[0]).toMatchObject({ metodo: 'POST', ruta: `/riesgos/${RIESGO}/controles`, cuerpo: { controlId: CONTROL } });
    }
  });

  it('quitar el vínculo acepta el 204 de la API', async () => {
    const { enviar, llamadas } = await montar(204);
    expect(aviso(await enviar(desvincularRiesgoControl, 'desvincular', { riesgoId: RIESGO, controlId: CONTROL }))).toBe('desvinculado');
    expect(llamadas[0]).toMatchObject({ metodo: 'POST', ruta: `/riesgos/${RIESGO}/controles/eliminacion`, cuerpo: { controlId: CONTROL } });
  });

  it('prever el tratamiento: 201 «previsto» y 200 «ya existía»; quitarlo acepta el 204', async () => {
    for (const [estado, esperado] of [[201, 'tratamiento_previsto'], [200, 'sin_cambios']] as const) {
      const { enviar, llamadas } = await montar(estado);
      expect(aviso(await enviar(preverTratamientoRiesgo, 'prever', { riesgoId: RIESGO, entrada: ENTRADA })), String(estado)).toBe(esperado);
      expect(llamadas[0]).toMatchObject({ metodo: 'POST', ruta: `/riesgos/${RIESGO}/tratamientos`, cuerpo: { libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1' } });
    }
    const { enviar, llamadas } = await montar(204);
    expect(aviso(await enviar(quitarTratamientoRiesgo, 'quitar-prevision', { riesgoId: RIESGO, entrada: ENTRADA }))).toBe('tratamiento_quitado');
    expect(llamadas[0]).toMatchObject({ ruta: `/riesgos/${RIESGO}/tratamientos/eliminacion` });
  });

  it('traduce cada estado de la API a un aviso cerrado', async () => {
    for (const [estado, esperado] of [[400, 'no_valido'], [403, 'sin_permiso'], [404, 'no_encontrado'], [409, 'conflicto'], [500, 'no_disponible'], ['lanza', 'no_disponible']] as const) {
      const { enviar } = await montar(estado);
      expect(aviso(await enviar(retirarRiesgo, 'retirar', { riesgoId: RIESGO, version: '1' })), String(estado)).toBe(esperado);
    }
  });

  it('un 401 de la API lleva a ingresar y cierra la sesión', async () => {
    const { enviar } = await montar(401);
    const r = await enviar(crearRiesgo, 'crear', nuevo);
    expect(destino(r).pathname).toBe('/auth/login');
    expect(destino(r).searchParams.get('retorno')).toBe('/e/empresa-a/riesgos');
  });

  it('rechaza lo que no es un formulario propio: GET 405, Origin ajeno o ausente 403, empresa distinta 404, sin llamar a la API', async () => {
    const { enviar, llamadas } = await montar();
    expect((await enviar(crearRiesgo, 'crear', nuevo, { metodo: 'GET' })).status).toBe(405);
    expect((await enviar(crearRiesgo, 'crear', nuevo, { origen: 'https://malo.example.test' })).status).toBe(403);
    expect((await enviar(crearRiesgo, 'crear', nuevo, { origen: null })).status).toBe(403);
    expect((await enviar(crearRiesgo, 'crear', nuevo, { verificado: 'empresa-b' })).status).toBe(404);
    expect((await enviar(crearRiesgo, 'crear', nuevo, { verificado: null })).status).toBe(404);
    expect(llamadas).toEqual([]);
  });

  it('sin sesión lleva a ingresar, sin llamar a la API', async () => {
    const { enviar, llamadas } = await montar();
    expect(destino(await enviar(crearRiesgo, 'crear', nuevo, { cookie: null })).pathname).toBe('/auth/login');
    expect(llamadas).toEqual([]);
  });

  it('un formulario con datos mal formados vuelve con «no_valido» sin llamar a la API', async () => {
    const { enviar, llamadas } = await montar();
    const base = { riesgoId: RIESGO, version: '1', ...nuevo };
    const malos: Array<[typeof crearRiesgo, string, Record<string, string>]> = [
      [crearRiesgo, 'crear', {}], [crearRiesgo, 'crear', { ...nuevo, titulo: '   ' }], [crearRiesgo, 'crear', { ...nuevo, titulo: 'x'.repeat(121) }],
      [crearRiesgo, 'crear', { ...nuevo, probabilidad: '6' }], [crearRiesgo, 'crear', { ...nuevo, probabilidad: '0' }], [crearRiesgo, 'crear', { ...nuevo, impacto: 'alto' }],
      [crearRiesgo, 'crear', { ...nuevo, decision: 'ignorar' }], [crearRiesgo, 'crear', { ...nuevo, responsableId: 'Ana Pérez' }], [crearRiesgo, 'crear', { ...nuevo, descripcion: 'x'.repeat(1001) }],
      [cambiarRiesgo, 'cambiar', { ...base, riesgoId: 'no-uuid' }], [cambiarRiesgo, 'cambiar', { ...base, version: '0' }], [cambiarRiesgo, 'cambiar', { ...base, version: 'uno' }], [cambiarRiesgo, 'cambiar', { ...base, titulo: '' }],
      [retirarRiesgo, 'retirar', { riesgoId: RIESGO }], [retirarRiesgo, 'retirar', { riesgoId: '../x', version: '1' }],
      [vincularRiesgoControl, 'vincular', { riesgoId: RIESGO, controlId: 'x' }], [vincularRiesgoControl, 'vincular', { controlId: CONTROL }], [desvincularRiesgoControl, 'desvincular', { riesgoId: 'x', controlId: CONTROL }],
      [preverTratamientoRiesgo, 'prever', { riesgoId: RIESGO, entrada: 'sin-barra' }], [preverTratamientoRiesgo, 'prever', { riesgoId: RIESGO, entrada: 'a|b|c' }], [preverTratamientoRiesgo, 'prever', { entrada: ENTRADA }],
      [quitarTratamientoRiesgo, 'quitar-prevision', { riesgoId: 'x', entrada: ENTRADA }],
    ];
    for (const [m, ruta, campos] of malos) expect(aviso(await enviar(m, ruta, campos)), JSON.stringify(campos)).toBe('no_valido');
    expect(llamadas).toEqual([]);
  });

  it('un filtro conservado inválido se descarta, no se refleja', async () => {
    const { enviar } = await montar(201);
    const r = await enviar(crearRiesgo, 'crear', { ...nuevo, f_retirados: '<script>' });
    expect([...destino(r).searchParams.keys()]).toEqual(['aviso']);
  });

  it('un id raro en el formulario nunca llega a la dirección de vuelta', async () => {
    const { enviar } = await montar(409);
    const r = await enviar(cambiarRiesgo, 'cambiar', { riesgoId: '../../admin', version: '1', ...nuevo });
    expect(destino(r).pathname).toBe('/e/empresa-a/riesgos'); // vuelve a la lista, no a una ruta armada con lo recibido
  });
});
