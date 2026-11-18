// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AlmacenAcceso } from '../auth/almacen-acceso';
import { leerConfiguracion } from '../auth/configuracion';
import type { ResultadoCallback } from '../auth/flujo';
import { crearServicioSesion } from '../auth/sesion';
import { guardarMotivoDeclaracion, guardarReferenciaDeclaracion, quitarMotivoDeclaracion, quitarReferenciaDeclaracion } from './escribir';

// Motivos de inclusión y referencias al tratamiento de la Declaración desde la web (ADR 037): la web no decide nada; reenvía a la API con el token y una lista cerrada de campos.
const config = leerConfiguracion({ OIDC_CLIENT_SECRET: randomBytes(18).toString('base64url'), SESSION_SEALING_KEY: randomBytes(32).toString('base64url') });
const AHORA = new Date('2026-11-17T10:00:00Z');
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
    manejador: typeof guardarMotivoDeclaracion,
    ruta: string,
    campos: Record<string, string>,
    o: { metodo?: string; origen?: string | null; cookie?: string | null; slug?: string; verificado?: string | null } = {},
  ) => {
    const { metodo = 'POST', origen = config.origen, cookie: c = cookie, slug = 'empresa-a', verificado = 'empresa-a' } = o;
    const peticion = new Request(`${config.origen}/e/${slug}/declaracion/${ruta}`, {
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
const motivo = { entrada: ENTRADA, tipo: 'legal', nota: '  Ley de protección de datos  ' };
const ref = { tipo: 'plan', titulo: ' Plan de tratamiento 2026 ', versionDoc: '1.2', fecha: '2026-11-01', ubicacion: ' SIG-PL-004 ' };

describe('motivos de inclusión desde la web', () => {
  it('crear: reenvía a la API con el token y SOLO los campos conocidos, SIN versión, y vuelve a la declaración', async () => {
    const { enviar, llamadas } = await montar(200);
    const r = await enviar(guardarMotivoDeclaracion, 'motivo/guardar', { ...motivo, empresaId: 'otra', estado: 'x', extra: 'y' });
    expect(r.status).toBe(303);
    expect(destino(r).pathname).toBe('/e/empresa-a/declaracion');
    expect(aviso(r)).toBe('motivo_guardado');
    expect(llamadas).toEqual([{ metodo: 'PUT', ruta: '/declaracion/motivos', autorizacion: 'Bearer acceso-inicial', cuerpo: { libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1', tipo: 'legal', nota: 'Ley de protección de datos' } }]);
  });

  it('cambiar: manda la versión que se vio', async () => {
    const { enviar, llamadas } = await montar(200);
    await enviar(guardarMotivoDeclaracion, 'motivo/guardar', { ...motivo, version: '2' });
    expect(llamadas[0]?.cuerpo).toMatchObject({ versionEsperada: 2, tipo: 'legal' });
  });

  it('quitar: acepta el 204, exige la versión y la manda', async () => {
    const { enviar, llamadas } = await montar(204);
    expect(aviso(await enviar(quitarMotivoDeclaracion, 'motivo/quitar', { entrada: ENTRADA, tipo: 'otro', version: '3' }))).toBe('motivo_quitado');
    expect(llamadas).toEqual([{ metodo: 'POST', ruta: '/declaracion/motivos/eliminacion', autorizacion: 'Bearer acceso-inicial', cuerpo: { libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1', tipo: 'otro', versionEsperada: 3 } }]);
  });

  it('traduce cada estado de la API a un aviso cerrado (el 409 es «otra persona lo cambió antes»)', async () => {
    for (const [estado, esperado] of [[400, 'no_valido'], [403, 'sin_permiso'], [404, 'no_encontrado'], [409, 'conflicto'], [500, 'no_disponible'], ['lanza', 'no_disponible']] as const) {
      const { enviar } = await montar(estado);
      expect(aviso(await enviar(guardarMotivoDeclaracion, 'motivo/guardar', motivo)), String(estado)).toBe(esperado);
    }
  });

  it('un formulario mal formado vuelve con «no_valido» sin llamar a la API', async () => {
    const { enviar, llamadas } = await montar();
    const malos: Array<[typeof guardarMotivoDeclaracion, string, Record<string, string>]> = [
      [guardarMotivoDeclaracion, 'motivo/guardar', {}], [guardarMotivoDeclaracion, 'motivo/guardar', { ...motivo, nota: '   ' }], [guardarMotivoDeclaracion, 'motivo/guardar', { ...motivo, nota: 'x'.repeat(501) }],
      [guardarMotivoDeclaracion, 'motivo/guardar', { ...motivo, tipo: 'riesgo' }], [guardarMotivoDeclaracion, 'motivo/guardar', { ...motivo, tipo: '' }],
      [guardarMotivoDeclaracion, 'motivo/guardar', { ...motivo, entrada: 'sin-barra' }], [guardarMotivoDeclaracion, 'motivo/guardar', { ...motivo, entrada: 'a|b|c' }],
      [guardarMotivoDeclaracion, 'motivo/guardar', { ...motivo, version: '0' }], [guardarMotivoDeclaracion, 'motivo/guardar', { ...motivo, version: 'uno' }],
      [quitarMotivoDeclaracion, 'motivo/quitar', { entrada: ENTRADA, tipo: 'legal' }], [quitarMotivoDeclaracion, 'motivo/quitar', { entrada: ENTRADA, tipo: 'legal', version: '0' }],
      [quitarMotivoDeclaracion, 'motivo/quitar', { entrada: ENTRADA, tipo: 'riesgo', version: '1' }], [quitarMotivoDeclaracion, 'motivo/quitar', { entrada: 'x', tipo: 'legal', version: '1' }],
    ];
    for (const [m, ruta, campos] of malos) expect(aviso(await enviar(m, ruta, campos)), JSON.stringify(campos)).toBe('no_valido');
    expect(llamadas).toEqual([]);
  });
});

describe('referencias al tratamiento desde la web', () => {
  it('crear: manda los datos recortados, sin versión; cambiar: con la versión que se vio', async () => {
    const { enviar, llamadas } = await montar(200);
    expect(aviso(await enviar(guardarReferenciaDeclaracion, 'referencia/guardar', { ...ref, empresaId: 'otra' }))).toBe('referencia_guardada');
    expect(llamadas[0]).toEqual({ metodo: 'PUT', ruta: '/declaracion/referencias', autorizacion: 'Bearer acceso-inicial', cuerpo: { tipo: 'plan', titulo: 'Plan de tratamiento 2026', versionDoc: '1.2', fecha: '2026-11-01', ubicacion: 'SIG-PL-004' } });
    await enviar(guardarReferenciaDeclaracion, 'referencia/guardar', { ...ref, version: '4' });
    expect(llamadas[1]?.cuerpo).toMatchObject({ versionEsperada: 4 });
  });

  it('quitar: acepta el 204 y manda tipo y versión', async () => {
    const { enviar, llamadas } = await montar(204);
    expect(aviso(await enviar(quitarReferenciaDeclaracion, 'referencia/quitar', { tipo: 'analisis', version: '2' }))).toBe('referencia_quitada');
    expect(llamadas[0]).toEqual({ metodo: 'POST', ruta: '/declaracion/referencias/eliminacion', autorizacion: 'Bearer acceso-inicial', cuerpo: { tipo: 'analisis', versionEsperada: 2 } });
  });

  it('un formulario mal formado vuelve con «no_valido» sin llamar a la API', async () => {
    const { enviar, llamadas } = await montar();
    const malos: Array<[typeof guardarReferenciaDeclaracion, string, Record<string, string>]> = [
      [guardarReferenciaDeclaracion, 'referencia/guardar', {}], [guardarReferenciaDeclaracion, 'referencia/guardar', { ...ref, tipo: 'otro' }], [guardarReferenciaDeclaracion, 'referencia/guardar', { ...ref, titulo: ' ' }],
      [guardarReferenciaDeclaracion, 'referencia/guardar', { ...ref, titulo: 'x'.repeat(121) }], [guardarReferenciaDeclaracion, 'referencia/guardar', { ...ref, versionDoc: '' }], [guardarReferenciaDeclaracion, 'referencia/guardar', { ...ref, versionDoc: 'x'.repeat(41) }],
      [guardarReferenciaDeclaracion, 'referencia/guardar', { ...ref, fecha: '01/11/2026' }], [guardarReferenciaDeclaracion, 'referencia/guardar', { ...ref, ubicacion: '' }], [guardarReferenciaDeclaracion, 'referencia/guardar', { ...ref, ubicacion: 'x'.repeat(201) }],
      [guardarReferenciaDeclaracion, 'referencia/guardar', { ...ref, version: '0' }],
      [quitarReferenciaDeclaracion, 'referencia/quitar', { tipo: 'plan' }], [quitarReferenciaDeclaracion, 'referencia/quitar', { tipo: 'otro', version: '1' }], [quitarReferenciaDeclaracion, 'referencia/quitar', { tipo: 'plan', version: 'x' }],
    ];
    for (const [m, ruta, campos] of malos) expect(aviso(await enviar(m, ruta, campos)), JSON.stringify(campos)).toBe('no_valido');
    expect(llamadas).toEqual([]);
  });

  it('traduce el 409 («otra persona lo cambió antes») y los demás estados a avisos cerrados', async () => {
    for (const [estado, esperado] of [[400, 'no_valido'], [403, 'sin_permiso'], [409, 'conflicto'], [500, 'no_disponible']] as const) {
      const { enviar } = await montar(estado);
      expect(aviso(await enviar(guardarReferenciaDeclaracion, 'referencia/guardar', ref)), String(estado)).toBe(esperado);
    }
  });
});

describe('lo común a las cuatro escrituras', () => {
  const casos: Array<[string, typeof guardarMotivoDeclaracion, string, Record<string, string>]> = [
    ['guardar motivo', guardarMotivoDeclaracion, 'motivo/guardar', motivo],
    ['quitar motivo', quitarMotivoDeclaracion, 'motivo/quitar', { entrada: ENTRADA, tipo: 'legal', version: '1' }],
    ['guardar referencia', guardarReferenciaDeclaracion, 'referencia/guardar', ref],
    ['quitar referencia', quitarReferenciaDeclaracion, 'referencia/quitar', { tipo: 'plan', version: '1' }],
  ];
  it.each(casos)('%s: rechaza GET, Origin ajeno o ausente y empresa distinta, sin llamar a la API', async (_n, m, ruta, campos) => {
    const { enviar, llamadas } = await montar();
    expect((await enviar(m, ruta, campos, { metodo: 'GET' })).status).toBe(405);
    expect((await enviar(m, ruta, campos, { origen: 'https://malo.example.test' })).status).toBe(403);
    expect((await enviar(m, ruta, campos, { origen: null })).status).toBe(403);
    expect((await enviar(m, ruta, campos, { verificado: 'empresa-b' })).status).toBe(404);
    expect(llamadas).toEqual([]);
  });
  it.each(casos)('%s: sin sesión lleva a ingresar y un 401 de la API cierra la sesión', async (_n, m, ruta, campos) => {
    const a = await montar();
    expect(destino(await a.enviar(m, ruta, campos, { cookie: null })).pathname).toBe('/auth/login');
    expect(a.llamadas).toEqual([]);
    const b = await montar(401);
    const r = await b.enviar(m, ruta, campos);
    expect(destino(r).pathname).toBe('/auth/login');
    expect(destino(r).searchParams.get('retorno')).toBe('/e/empresa-a/declaracion');
  });
});
