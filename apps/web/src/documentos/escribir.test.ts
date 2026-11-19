// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AlmacenAcceso } from '../auth/almacen-acceso';
import { leerConfiguracion } from '../auth/configuracion';
import type { ResultadoCallback } from '../auth/flujo';
import { crearServicioSesion } from '../auth/sesion';
import { aprobarVersion, cambiarDocumento, confirmarLectura, crearDocumento, descargarVersion, descartarVersion, desvincularDocumento, devolverVersion, distribuirDocumento, enviarVersion, guardarRetencion, retirarDocumento, revisarDocumento, subirVersion, vincularDocumento } from './escribir';

// Control documental desde la web (ADR 039): la web no decide nada; reenvía a la API con el token y una lista cerrada de campos.
const config = leerConfiguracion({ OIDC_CLIENT_SECRET: randomBytes(18).toString('base64url'), SESSION_SEALING_KEY: randomBytes(32).toString('base64url') });
const AHORA = new Date('2026-11-18T10:00:00Z');
const DOC = 'dddddddd-1111-4111-8111-111111111111';
const VER = 'eeeeeeee-1111-4111-8111-111111111111';
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
    manejador: typeof crearDocumento,
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
    const peticion = new Request(`${config.origen}/e/${slug}/documentos/${ruta}`, {
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
const nuevo = { tipo: 'politica', titulo: ' Política de acceso ', clasificacion: 'interna', responsableId: PERSONA, area: '  ', emisor: '', edicionFuente: '' };

describe('crear y cambiar un documento', () => {
  it('crear reenvía con el token y SOLO los campos conocidos; lo vacío no se manda', async () => {
    const { enviar, llamadas } = await montar(201);
    const r = await enviar(crearDocumento, 'crear', { ...nuevo, empresaId: 'otra', codigo: 'POL-999', estado: 'retirado' });
    expect(r.status).toBe(303);
    expect(destino(r).pathname).toBe('/e/empresa-a/documentos');
    expect(aviso(r)).toBe('documento_creado');
    expect(llamadas).toEqual([{ metodo: 'POST', ruta: '/documentos', autorizacion: 'Bearer acceso-inicial', cuerpo: { tipo: 'politica', titulo: 'Política de acceso', clasificacion: 'interna', responsableId: PERSONA } }]);
  });
  it('un documento externo manda su emisor y su edición', async () => {
    const { enviar, llamadas } = await montar(201);
    await enviar(crearDocumento, 'crear', { ...nuevo, tipo: 'externo', emisor: 'Un organismo', edicionFuente: '2024', area: 'Legal' });
    expect(llamadas[0]?.cuerpo).toMatchObject({ tipo: 'externo', emisor: 'Un organismo', edicionFuente: '2024', area: 'Legal' });
  });
  it('un formulario sin lo mínimo o con valores fuera de lista no llega a la API', async () => {
    const { enviar, llamadas } = await montar(201);
    for (const mal of [{ tipo: 'carta' }, { clasificacion: 'secreta' }, { titulo: '   ' }, { responsableId: 'x' }, { titulo: 'x'.repeat(121) }, { area: 'x'.repeat(61) }]) expect(aviso(await enviar(crearDocumento, 'crear', { ...nuevo, ...mal })), JSON.stringify(mal)).toBe('no_valido');
    expect(llamadas).toEqual([]);
  });
  it('cambiar manda la versión que se vio, va a la ruta del documento y vuelve a su pantalla; lo vacío borra', async () => {
    const { enviar, llamadas } = await montar(200);
    const r = await enviar(cambiarDocumento, `${DOC}/cambiar`, { version: '3', titulo: 'Nuevo', clasificacion: 'confidencial', responsableId: '', area: '', emisor: '', edicionFuente: '' }, { id: DOC });
    expect(destino(r).pathname).toBe(`/e/empresa-a/documentos/${DOC}`);
    expect(aviso(r)).toBe('documento_guardado');
    expect(llamadas).toEqual([{ metodo: 'PUT', ruta: `/documentos/${DOC}`, autorizacion: 'Bearer acceso-inicial', cuerpo: { versionEsperada: 3, titulo: 'Nuevo', clasificacion: 'confidencial', area: null, emisor: null, edicionFuente: null } }]);
    const sin = await montar(200);
    expect(aviso(await sin.enviar(cambiarDocumento, `${DOC}/cambiar`, { titulo: 'x', clasificacion: 'interna' }, { id: DOC }))).toBe('no_valido'); // sin versión
    expect(sin.llamadas).toEqual([]);
  });
  it('un identificador que no es UUID en la dirección responde 404 sin llamar a la API', async () => {
    const { enviar, llamadas } = await montar(200);
    expect((await enviar(retirarDocumento, 'x/retirar', {}, { id: 'no-es-uuid' })).status).toBe(404);
    expect(llamadas).toEqual([]);
  });
  it('retirar y revisar: sin cuerpo y con motivo y fecha acotados', async () => {
    const { enviar, llamadas } = await montar(204);
    expect(aviso(await enviar(retirarDocumento, `${DOC}/retirar`, {}, { id: DOC }))).toBe('documento_retirado');
    expect(llamadas[0]).toMatchObject({ metodo: 'POST', ruta: `/documentos/${DOC}/retiro`, cuerpo: null });
    const r = await montar(200);
    await r.enviar(revisarDocumento, `${DOC}/revisar`, { motivo: 'auditoria', proximaRevision: '2027-02-01' }, { id: DOC });
    expect(r.llamadas[0]?.cuerpo).toEqual({ motivo: 'auditoria', proximaRevision: '2027-02-01' });
    expect(aviso(await r.enviar(revisarDocumento, `${DOC}/revisar`, { motivo: 'porque sí' }, { id: DOC }))).toBe('no_valido');
    expect(aviso(await r.enviar(revisarDocumento, `${DOC}/revisar`, { proximaRevision: '1 de febrero' }, { id: DOC }))).toBe('no_valido');
  });
});

describe('versiones y flujo', () => {
  const archivo = (bytes = 100, nombre = 'politica.pdf') => new File([new Uint8Array(bytes)], nombre, { type: 'application/pdf' });
  it('subir arma el multipart con la nota ANTES del archivo, aunque el navegador los mande al revés', async () => {
    const { enviar, llamadas } = await montar(201);
    const f = new FormData();
    f.append('archivo', archivo());
    f.append('nota', ' versión inicial ');
    f.append('empresaId', 'otra');
    const r = await enviar(subirVersion, `${DOC}/subir`, f, { id: DOC });
    expect(aviso(r)).toBe('version_subida');
    expect(llamadas).toEqual([{ metodo: 'POST', ruta: `/documentos/${DOC}/versiones`, autorizacion: 'Bearer acceso-inicial', cuerpo: ['nota', 'archivo'] }]);
  });
  it('sin nota, sin archivo o con un archivo de más de 25 MB no llega a la API', async () => {
    const { enviar, llamadas } = await montar(201);
    const sinNota = new FormData();
    sinNota.append('archivo', archivo());
    expect(aviso(await enviar(subirVersion, `${DOC}/subir`, sinNota, { id: DOC }))).toBe('no_valido');
    const sinArchivo = new FormData();
    sinArchivo.append('nota', 'x');
    expect(aviso(await enviar(subirVersion, `${DOC}/subir`, sinArchivo, { id: DOC }))).toBe('no_valido');
    const grande = new FormData();
    grande.append('nota', 'x');
    grande.append('archivo', archivo(26_214_401));
    expect(aviso(await enviar(subirVersion, `${DOC}/subir`, grande, { id: DOC }))).toBe('archivo_grande');
    expect(llamadas).toEqual([]);
  });
  it('los rechazos de la API vuelven como avisos cerrados (415, 413, 409)', async () => {
    for (const [estado, esperado] of [[415, 'tipo_no_permitido'], [413, 'archivo_grande'], [409, 'conflicto']] as const) {
      const { enviar } = await montar(estado);
      const f = new FormData();
      f.append('nota', 'x');
      f.append('archivo', archivo());
      expect(aviso(await enviar(subirVersion, `${DOC}/subir`, f, { id: DOC })), String(estado)).toBe(esperado);
    }
  });
  it('enviar a revisión, devolver, aprobar y descartar vuelven al documento y mandan solo lo conocido', async () => {
    const { enviar, llamadas } = await montar(200);
    const volver = (r: Response) => destino(r).pathname;
    expect(volver(await enviar(enviarVersion, `versiones/${VER}/enviar`, { documento: DOC, aprobadorId: PERSONA.toUpperCase() }, { id: VER }))).toBe(`/e/empresa-a/documentos/${DOC}`);
    await enviar(devolverVersion, `versiones/${VER}/devolver`, { documento: DOC, motivo: 'incompleta', nota: ' falta ' }, { id: VER });
    await enviar(aprobarVersion, `versiones/${VER}/aprobar`, { documento: DOC, proximaRevision: '2027-03-01', requiereLectura: 'on', motivoExcepcion: ' soy el único ', empresaId: 'otra' }, { id: VER });
    await enviar(aprobarVersion, `versiones/${VER}/aprobar`, { documento: DOC }, { id: VER });
    await enviar(descartarVersion, `versiones/${VER}/descartar`, { documento: DOC }, { id: VER });
    expect(llamadas.map((l) => [l.metodo, l.ruta, l.cuerpo])).toEqual([
      ['POST', `/versiones/${VER}/envio`, { aprobadorId: PERSONA.toUpperCase().toLowerCase() }],
      ['POST', `/versiones/${VER}/devolucion`, { motivo: 'incompleta', nota: 'falta' }],
      ['POST', `/versiones/${VER}/aprobacion`, { proximaRevision: '2027-03-01', requiereLectura: true, motivoExcepcion: 'soy el único' }],
      ['POST', `/versiones/${VER}/aprobacion`, { requiereLectura: false }],
      ['POST', `/versiones/${VER}/descarte`, null],
    ]);
  });
  it('sin el documento oculto o con uno que no es UUID, se vuelve a la lista (nunca al id de la versión)', async () => {
    const { enviar } = await montar(200);
    expect(destino(await enviar(aprobarVersion, `versiones/${VER}/aprobar`, {}, { id: VER })).pathname).toBe('/e/empresa-a/documentos');
    expect(destino(await enviar(aprobarVersion, `versiones/${VER}/aprobar`, { documento: '../../x' }, { id: VER })).pathname).toBe('/e/empresa-a/documentos');
  });
  it('datos inválidos no llegan a la API: motivo fuera de lista, aprobador que no es UUID, fecha rara', async () => {
    const { enviar, llamadas } = await montar(200);
    expect(aviso(await enviar(devolverVersion, `versiones/${VER}/devolver`, { motivo: 'me cae mal' }, { id: VER }))).toBe('no_valido');
    expect(aviso(await enviar(enviarVersion, `versiones/${VER}/enviar`, { aprobadorId: 'x' }, { id: VER }))).toBe('no_valido');
    expect(aviso(await enviar(aprobarVersion, `versiones/${VER}/aprobar`, { proximaRevision: 'mañana' }, { id: VER }))).toBe('no_valido');
    expect(llamadas).toEqual([]);
  });
  it('confirmar la lectura no lleva cuerpo y vuelve a la lista', async () => {
    const { enviar, llamadas } = await montar(204);
    const r = await enviar(confirmarLectura, `versiones/${VER}/confirmar`, {}, { id: VER });
    expect(aviso(r)).toBe('lectura_confirmada');
    expect(destino(r).pathname).toBe('/e/empresa-a/documentos');
    expect(llamadas).toEqual([{ metodo: 'POST', ruta: `/versiones/${VER}/lectura`, autorizacion: 'Bearer acceso-inicial', cuerpo: null }]);
  });
});

describe('distribución, vínculos y retención', () => {
  it('distribuir manda las personas y los roles marcados, sin repetir y solo con forma válida', async () => {
    const { enviar, llamadas } = await montar(200);
    await enviar(distribuirDocumento, `${DOC}/distribuir`, { usuarioIds: [PERSONA, PERSONA.toUpperCase()], roles: ['colaborador'] }, { id: DOC });
    expect(llamadas[0]).toMatchObject({ metodo: 'PUT', ruta: `/documentos/${DOC}/distribucion`, cuerpo: { usuarioIds: [PERSONA], roles: ['colaborador'] } });
    expect(aviso(await enviar(distribuirDocumento, `${DOC}/distribuir`, { usuarioIds: ['x'] }, { id: DOC }))).toBe('no_valido');
    expect(aviso(await enviar(distribuirDocumento, `${DOC}/distribuir`, { roles: ['Rol Malo'] }, { id: DOC }))).toBe('no_valido');
    expect(llamadas).toHaveLength(1);
  });
  it('vincular acepta un control o una entrada, nunca otra cosa; desvincular usa la ruta de eliminación', async () => {
    const { enviar, llamadas } = await montar(201);
    await enviar(vincularDocumento, `${DOC}/vincular`, { controlId: PERSONA }, { id: DOC });
    await enviar(vincularDocumento, `${DOC}/vincular`, { libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1' }, { id: DOC });
    await enviar(desvincularDocumento, `${DOC}/desvincular`, { libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1' }, { id: DOC });
    expect(llamadas.map((l) => [l.ruta, l.cuerpo])).toEqual([
      [`/documentos/${DOC}/vinculos`, { controlId: PERSONA }],
      [`/documentos/${DOC}/vinculos`, { libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1' }],
      [`/documentos/${DOC}/vinculos/eliminacion`, { libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1' }],
    ]);
    expect(aviso(await enviar(vincularDocumento, `${DOC}/vincular`, { libreriaCodigo: 'Mal Código', idEstable: 'x' }, { id: DOC }))).toBe('no_valido');
    expect(aviso(await enviar(vincularDocumento, `${DOC}/vincular`, {}, { id: DOC }))).toBe('no_valido');
  });
  it('guardar la retención manda años, motivo y la versión que se vio (si la hay)', async () => {
    const { enviar, llamadas } = await montar(200);
    await enviar(guardarRetencion, 'retencion', { tipo: 'politica', anios: '5', motivo: ' política de la empresa ' });
    await enviar(guardarRetencion, 'retencion', { tipo: 'manual', anios: '7', motivo: 'ley', version: '2' });
    expect(llamadas.map((l) => l.cuerpo)).toEqual([{ tipo: 'politica', anios: 5, motivo: 'política de la empresa' }, { tipo: 'manual', anios: 7, motivo: 'ley', versionEsperada: 2 }]);
    for (const mal of [{ tipo: 'carta' }, { anios: 'cinco' }, { anios: '' }, { motivo: '' }, { version: '0' }] as Record<string, string>[]) expect(aviso(await enviar(guardarRetencion, 'retencion', { tipo: 'politica', anios: '5', motivo: 'x', ...mal })), JSON.stringify(mal)).toBe('no_valido');
  });
});

describe('guardias del formulario', () => {
  it('sin Origen propio, con otra empresa en la dirección o con GET, no hace nada', async () => {
    const { enviar, llamadas } = await montar(201);
    expect((await enviar(crearDocumento, 'crear', nuevo, { origen: 'https://malo.example.test' })).status).toBe(403);
    expect((await enviar(crearDocumento, 'crear', nuevo, { origen: null })).status).toBe(403);
    expect((await enviar(crearDocumento, 'crear', nuevo, { slug: 'empresa-b', verificado: 'empresa-a' })).status).toBe(404);
    expect((await enviar(crearDocumento, 'crear', {}, { metodo: 'GET' })).status).toBe(405);
    expect(llamadas).toEqual([]);
  });
  it('sin sesión va a ingresar; si la API dice 401, borra la sesión; 403 y 404 vuelven como avisos', async () => {
    const sin = await montar(201);
    const r = await sin.enviar(crearDocumento, 'crear', nuevo, { cookie: null });
    expect(r.headers.get('location')).toContain('/auth/login');
    expect(sin.llamadas).toEqual([]);
    expect((await (await montar(401)).enviar(crearDocumento, 'crear', nuevo)).headers.get('location')).toContain('/auth/login');
    expect(aviso(await (await montar(403)).enviar(crearDocumento, 'crear', nuevo))).toBe('sin_permiso');
    expect(aviso(await (await montar(404)).enviar(cambiarDocumento, `${DOC}/cambiar`, { version: '1', titulo: 'x', clasificacion: 'interna' }, { id: DOC }))).toBe('no_encontrado');
    expect(aviso(await (await montar('lanza')).enviar(crearDocumento, 'crear', nuevo))).toBe('no_disponible');
  });
});

describe('descarga de una versión', () => {
  const entregar = async (cabeceras: Record<string, string>, estado = 200) => {
    const { enviar } = await montar(estado, cabeceras);
    return enviar(descargarVersion, `versiones/${VER}/descargar`, {}, { metodo: 'GET', id: VER });
  };
  it('entrega siempre como adjunto, con el tipo permitido y sin caché', async () => {
    const r = await entregar({ 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="politica.pdf"' });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-disposition')).toBe('attachment; filename="politica.pdf"');
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('cache-control')).toBe('no-store');
  });
  it('si la API manda una disposición rara o un tipo no permitido, no se entrega tal cual', async () => {
    expect((await entregar({ 'content-type': 'application/pdf', 'content-disposition': 'inline' })).headers.get('content-disposition')).toBe('attachment; filename="documento"');
    expect(aviso(await entregar({ 'content-type': 'text/html' }))).toBe('no_disponible');
    expect(aviso(await entregar({}, 404))).toBe('no_encontrado');
  });
});
