// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AlmacenAcceso } from '../auth/almacen-acceso';
import { leerConfiguracion } from '../auth/configuracion';
import type { ResultadoCallback } from '../auth/flujo';
import { crearServicioSesion } from '../auth/sesion';
import { PLANTILLA_LIBRERIA, NOMBRE_PLANTILLA } from './plantilla';
import { AlmacenResultadosCarga, resultadosCompartidos } from './resultados-carga';
import { ARCHIVOS_MAX, ARCHIVO_LIBRERIA_MAX, descargarPlantilla, etiquetaDeArchivo, leerAvisoNormas, subirLibrerias } from './subir';

const config = leerConfiguracion({ OIDC_CLIENT_SECRET: randomBytes(18).toString('base64url'), SESSION_SEALING_KEY: randomBytes(32).toString('base64url') });
const AHORA = new Date('2026-11-14T10:00:00Z');
const HUELLA = 'a'.repeat(64);
const callbackOk = (): Extract<ResultadoCallback, { ok: true }> => ({
  ok: true,
  tokens: { acceso: 'acceso-inicial', refresco: 'refresco-0', id: 'id.token.firmado' },
  identidad: { sub: '5eed0001-0000-4000-8000-0000000000a1', sid: 'sesion-kc-1' },
  retorno: '/',
  limpiarCookie: 'sig-oidc=; Max-Age=0',
});

const cargada = (codigo = 'propia-x') => ({ estado: 'cargada', motivo: null, codigo, version: '1.0.0', entradas: 2, huella: HUELLA, errores: [] });
const rechazada = { estado: 'rechazada', motivo: 'formato_invalido', codigo: null, version: null, entradas: null, huella: HUELLA, errores: [{ entrada: null, indice: null, ruta: 'codigo', codigo: 'campo_obligatorio' }] };

interface Llamada {
  ruta: string;
  autorizacion: string | null;
  campos: [string, string][];
}

const montar = async (api: { respuestas?: (n: number) => Response | 'lanza' } = {}) => {
  const llamadas: Llamada[] = [];
  const fetchFn = (async (url: string, init: RequestInit = {}) => {
    if (url.startsWith(`${config.apiUrl}/sesion/`)) return new Response(null, { status: 204 });
    if (!url.startsWith(config.apiUrl)) return new Response(null, { status: 404 });
    const cuerpo = init.body;
    llamadas.push({
      ruta: url.replace(config.apiUrl, ''),
      autorizacion: new Headers(init.headers).get('authorization'),
      campos: cuerpo instanceof FormData ? [...cuerpo.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : `archivo:${v.name}:${v.size}`]) : [],
    });
    const r = api.respuestas?.(llamadas.length) ?? new Response(JSON.stringify(cargada()), { status: 201, headers: { 'content-type': 'application/json' } });
    if (r === 'lanza') throw new Error('ECONNREFUSED');
    return r;
  }) as unknown as typeof fetch;
  const deps = { config, ahora: () => AHORA, fetchFn, almacen: new AlmacenAcceso() };
  const r = await crearServicioSesion(deps).iniciar(callbackOk());
  const cookie = r.headers.getSetCookie().find((c) => c.startsWith(`${config.nombreCookieSesion}=`))!.split(';')[0]!;
  llamadas.length = 0;
  const enviar = (f: FormData | null, o: { metodo?: string; origen?: string | null; cookie?: string | null; slug?: string; verificado?: string | null; cabeceras?: Record<string, string> } = {}) => {
    const { metodo = 'POST', origen = config.origen, cookie: c = cookie, slug = 'empresa-a', verificado = 'empresa-a' } = o;
    const peticion = new Request(`${config.origen}/e/${slug}/normas/subir`, {
      method: metodo,
      headers: { ...(origen === null ? {} : { origin: origen }), ...(c ? { cookie: c } : {}), ...(o.cabeceras ?? {}) },
      ...(metodo === 'GET' || f === null ? {} : { body: f }),
    });
    return subirLibrerias(peticion, { slugDeLaDireccion: slug, slugVerificado: verificado }, deps);
  };
  return { llamadas, enviar, cookie };
};

const yaml = (nombre: string, bytes = 100) => new File([new Uint8Array(bytes).fill(97)], nombre, { type: 'application/yaml' });
const formulario = (...archivos: File[]) => {
  const f = new FormData();
  for (const a of archivos) f.append('archivos', a);
  return f;
};
const destino = (r: Response): URL => new URL(r.headers.get('location')!);
const aviso = (r: Response) => destino(r).searchParams.get('aviso');
const tomar = (r: Response, slug = 'empresa-a') => resultadosCompartidos().tomar(destino(r).searchParams.get('carga')!, slug, AHORA.getTime());

describe('subirLibrerias', () => {
  it('manda cada archivo YAML por separado, con el token, y guarda el resultado para mostrarlo una vez', async () => {
    const { llamadas, enviar } = await montar();
    const r = await enviar(formulario(yaml('b.yaml'), yaml('a.yml')));
    expect(r.status).toBe(303);
    expect(destino(r).pathname).toBe('/e/empresa-a/normas');
    expect(llamadas.map((l) => [l.ruta, l.campos])).toEqual([
      ['/librerias/carga', [['archivo', 'archivo:a.yml:100']]],
      ['/librerias/carga', [['archivo', 'archivo:b.yaml:100']]],
    ]);
    expect(llamadas.every((l) => l.autorizacion === 'Bearer acceso-inicial')).toBe(true);
    const resultado = tomar(r)!;
    expect(resultado.archivos.map((a) => a.nombre)).toEqual(['a.yml', 'b.yaml']);
    expect(resultado).toMatchObject({ omitidos: 0, recortado: false });
    expect(tomar(r)).toBeNull(); // se entrega una sola vez
  });

  it('no manda la empresa ni ningún campo de texto a la API', async () => {
    const { llamadas, enviar } = await montar();
    const f = formulario(yaml('a.yaml'));
    f.append('empresa', 'otra');
    await enviar(f);
    expect(llamadas[0]!.campos.map(([k]) => k)).toEqual(['archivo']);
  });

  it('ignora los archivos que no son .yaml/.yml (como los de una carpeta) y los cuenta', async () => {
    const { llamadas, enviar } = await montar();
    const r = await enviar(formulario(yaml('a.yaml'), yaml('leeme.md'), yaml('norma.pdf')));
    expect(llamadas).toHaveLength(1);
    expect(tomar(r)).toMatchObject({ omitidos: 2 });
  });

  it('sin archivos YAML: aviso «sin_archivos» y no llama a la API', async () => {
    const { llamadas, enviar } = await montar();
    expect(aviso(await enviar(formulario(yaml('leeme.md'))))).toBe('sin_archivos');
    expect(aviso(await enviar(formulario(new File([], '')))) ).toBe('sin_archivos'); // un formulario sin elegir nada
    expect(aviso(await enviar(new FormData()))).toBe('sin_archivos');
    expect(llamadas).toEqual([]);
  });

  it(`procesa hasta ${ARCHIVOS_MAX} archivos y avisa que se recortó`, async () => {
    const { llamadas, enviar } = await montar();
    const r = await enviar(formulario(...Array.from({ length: ARCHIVOS_MAX + 3 }, (_, i) => yaml(`n${String(i).padStart(2, '0')}.yaml`))));
    expect(llamadas).toHaveLength(ARCHIVOS_MAX);
    expect(tomar(r)).toMatchObject({ recortado: true });
  });

  it('un archivo de más de 1 MB no se envía y se informa', async () => {
    const { llamadas, enviar } = await montar();
    const r = await enviar(formulario(yaml('grande.yaml', ARCHIVO_LIBRERIA_MAX + 1), yaml('ok.yaml')));
    expect(llamadas.map((l) => l.campos[0]![1])).toEqual(['archivo:ok.yaml:100']);
    expect(tomar(r)!.archivos).toMatchObject([{ nombre: 'grande.yaml', tipo: 'fallo', motivo: 'archivo_grande' }, { nombre: 'ok.yaml', tipo: 'respuesta' }]);
  });

  it('una petición que declara más de lo posible se rechaza sin leer el cuerpo', async () => {
    const { llamadas, enviar } = await montar();
    const r = await enviar(formulario(yaml('a.yaml')), { cabeceras: { 'content-length': String(ARCHIVOS_MAX * ARCHIVO_LIBRERIA_MAX + 600_000) } });
    expect(aviso(r)).toBe('archivo_grande');
    expect(llamadas).toEqual([]);
  });

  it('un archivo rechazado por la API se muestra con sus errores y los demás siguen', async () => {
    const { enviar } = await montar({ respuestas: (n) => new Response(JSON.stringify(n === 1 ? rechazada : cargada()), { status: n === 1 ? 200 : 201 }) });
    const r = await enviar(formulario(yaml('a.yaml'), yaml('b.yaml')));
    const [a, b] = tomar(r)!.archivos;
    expect(a).toMatchObject({ tipo: 'respuesta', carga: { estado: 'rechazada', motivo: 'formato_invalido' } });
    expect(b).toMatchObject({ tipo: 'respuesta', carga: { estado: 'cargada' } });
  });

  it('una respuesta de la API que no cumple el contrato no se muestra: es «no disponible»', async () => {
    const { enviar } = await montar({ respuestas: () => new Response(JSON.stringify({ estado: 'cargada', extra: 1 }), { status: 201 }) });
    expect(tomar(await enviar(formulario(yaml('a.yaml'))))!.archivos).toEqual([{ nombre: 'a.yaml', tipo: 'fallo', motivo: 'no_disponible' }]);
  });

  it('403 de la API: aviso «sin_permiso» y no se siguen mandando archivos', async () => {
    const { llamadas, enviar } = await montar({ respuestas: () => new Response(null, { status: 403 }) });
    expect(aviso(await enviar(formulario(yaml('a.yaml'), yaml('b.yaml'))))).toBe('sin_permiso');
    expect(llamadas).toHaveLength(1);
  });

  it.each([
    [413, 'archivo_grande'],
    [500, 'no_disponible'],
    [429, 'no_disponible'],
  ])('API %i: ese archivo falla como «%s» y no revienta la tanda', async (estado, motivo) => {
    const { enviar } = await montar({ respuestas: () => new Response(null, { status: estado }) });
    expect(tomar(await enviar(formulario(yaml('a.yaml'))))!.archivos).toEqual([{ nombre: 'a.yaml', tipo: 'fallo', motivo }]);
  });

  it('si la API no responde, ese archivo falla como «no_disponible»', async () => {
    const { enviar } = await montar({ respuestas: () => 'lanza' });
    expect(tomar(await enviar(formulario(yaml('a.yaml'))))!.archivos).toEqual([{ nombre: 'a.yaml', tipo: 'fallo', motivo: 'no_disponible' }]);
  });

  it('401 de la API: manda a ingresar y borra la sesión', async () => {
    const { enviar } = await montar({ respuestas: () => new Response(null, { status: 401 }) });
    const r = await enviar(formulario(yaml('a.yaml')));
    expect(r.status).toBe(303);
    expect(destino(r).pathname).toBe('/auth/login');
    expect(destino(r).searchParams.get('retorno')).toBe('/e/empresa-a/normas');
  });

  describe('protección del formulario', () => {
    it('solo POST: un GET responde 405', async () => {
      const { enviar } = await montar();
      const r = await enviar(null, { metodo: 'GET' });
      expect(r.status).toBe(405);
      expect(r.headers.get('allow')).toBe('POST');
    });
    it.each([[null], ['https://otro.example'], ['null']])('con el origen %j responde 403 y no llama a la API', async (origen) => {
      const { llamadas, enviar } = await montar();
      expect((await enviar(formulario(yaml('a.yaml')), { origen })).status).toBe(403);
      expect(llamadas).toEqual([]);
    });
    it('la empresa de la dirección distinta de la verificada: 404 como una empresa que no existe', async () => {
      const { llamadas, enviar } = await montar();
      expect((await enviar(formulario(yaml('a.yaml')), { slug: 'empresa-b', verificado: 'empresa-a' })).status).toBe(404);
      expect((await enviar(formulario(yaml('a.yaml')), { verificado: null })).status).toBe(404);
      expect(llamadas).toEqual([]);
    });
    it('sin sesión: manda a ingresar', async () => {
      const { llamadas, enviar } = await montar();
      const r = await enviar(formulario(yaml('a.yaml')), { cookie: null });
      expect(destino(r).pathname).toBe('/auth/login');
      expect(llamadas).toEqual([]);
    });
    it('el cuerpo mal formado vuelve con «no_valido»', async () => {
      const peticion = new Request(`${config.origen}/e/empresa-a/normas/subir`, { method: 'POST', headers: { origin: config.origen, 'content-type': 'multipart/form-data; boundary=x' }, body: 'basura' });
      const r = await subirLibrerias(peticion, { slugDeLaDireccion: 'empresa-a', slugVerificado: 'empresa-a' }, { config, ahora: () => AHORA, fetchFn: fetch, almacen: new AlmacenAcceso() });
      expect(aviso(r)).toBe('no_valido');
    });
  });
});

describe('resultados de carga en memoria', () => {
  const r = { archivos: [], omitidos: 0, recortado: false };
  it('se entregan una vez y solo a la empresa que los generó', () => {
    const a = new AlmacenResultadosCarga();
    const id = a.guardar('empresa-a', r, 0);
    expect(a.tomar(id, 'empresa-b', 1)).toBeNull();
    expect(a.tomar(id, 'empresa-a', 1)).toEqual(r); // el intento de la otra empresa no lo gastó
    expect(a.tomar(id, 'empresa-a', 1)).toBeNull();
  });
  it('vencen a los 5 minutos', () => {
    const a = new AlmacenResultadosCarga();
    const id = a.guardar('empresa-a', r, 0);
    expect(a.tomar(id, 'empresa-a', 5 * 60_000 + 1)).toBeNull();
  });
  it('un identificador inventado no da nada', () => expect(new AlmacenResultadosCarga().tomar('inventado', 'empresa-a', 0)).toBeNull());
  it('guarda como máximo 200 (sale el más antiguo)', () => {
    const a = new AlmacenResultadosCarga();
    const primero = a.guardar('e', r, 0);
    for (let i = 0; i < 200; i++) a.guardar('e', r, 0);
    expect(a.tamano).toBe(200);
    expect(a.tomar(primero, 'e', 1)).toBeNull();
  });
});

describe('plantilla y utilidades', () => {
  it('la plantilla se entrega como adjunto, de un tipo fijo y sin caché', async () => {
    const r = descargarPlantilla(new Request('http://x/e/empresa-a/normas/plantilla'), { slugDeLaDireccion: 'empresa-a', slugVerificado: 'empresa-a' }, PLANTILLA_LIBRERIA, NOMBRE_PLANTILLA);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-disposition')).toBe(`attachment; filename="${NOMBRE_PLANTILLA}"`);
    expect(r.headers.get('content-type')).toMatch(/^application\/yaml/);
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(await r.text()).toContain('codigo: propia-');
  });
  it('de otra empresa responde 404, y un POST 405', () => {
    const p = (m = 'GET') => new Request('http://x/e/b/normas/plantilla', { method: m });
    expect(descargarPlantilla(p(), { slugDeLaDireccion: 'b', slugVerificado: 'a' }, 'x', 'p.yaml').status).toBe(404);
    expect(descargarPlantilla(p('POST'), { slugDeLaDireccion: 'a', slugVerificado: 'a' }, 'x', 'p.yaml').status).toBe(405);
  });
  it('la etiqueta del archivo no deja caracteres raros ni nombres larguísimos', () => {
    expect(etiquetaDeArchivo('mi norma <script>.yaml')).toBe('mi norma _script_.yaml');
    expect(etiquetaDeArchivo('a'.repeat(200)).length).toBe(60);
    expect(etiquetaDeArchivo('///')).toBe('___');
  });
  it('el aviso de la dirección solo acepta valores conocidos', () => {
    expect(leerAvisoNormas({ aviso: 'sin_permiso' })).toBe('sin_permiso');
    expect(leerAvisoNormas({ aviso: '<b>x</b>' })).toBeNull();
    expect(leerAvisoNormas({ aviso: ['sin_permiso'] })).toBeNull();
    expect(leerAvisoNormas({})).toBeNull();
  });
});
