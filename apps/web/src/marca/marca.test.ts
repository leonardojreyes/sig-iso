// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { cargarMarca, validarMarca } from './marca';

const valida = {
  nombre: 'Empresa A (prueba)',
  colorPrimario: '#0b5fff',
  colorOriginal: '#0b5fff',
  ajustadoPorContraste: false,
  logoUrl: null,
};
const respuesta = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'content-type': 'application/json' } });

describe('validarMarca (la respuesta de la API se trata como no confiable)', () => {
  it('acepta la forma del contrato, con y sin logo', () => {
    expect(validarMarca(valida)).toEqual({ nombre: 'Empresa A (prueba)', primario: '#0b5fff', logoUrl: undefined });
    expect(validarMarca({ ...valida, logoUrl: 'https://cdn.ejemplo.ec/logo.png' })).toMatchObject({
      logoUrl: 'https://cdn.ejemplo.ec/logo.png',
    });
    expect(validarMarca({ ...valida, logoUrl: '/logos/a.svg' })).toMatchObject({ logoUrl: '/logos/a.svg' });
  });

  it.each([
    ['no es un objeto', null],
    ['es un arreglo', []],
    ['es un texto', 'x'],
    ['sin nombre', { ...valida, nombre: undefined }],
    ['nombre vacío', { ...valida, nombre: '' }],
    ['nombre de más de 120 caracteres', { ...valida, nombre: 'a'.repeat(121) }],
    ['nombre que no es texto', { ...valida, nombre: 5 }],
    ['color que no es #RRGGBB', { ...valida, colorPrimario: 'azul' }],
    ['color original que no es #RRGGBB', { ...valida, colorOriginal: 'rojo' }],
    ['ajustadoPorContraste que no es booleano', { ...valida, ajustadoPorContraste: 'si' }],
    ['color corto', { ...valida, colorPrimario: '#fff' }],
    ['color con CSS inyectado', { ...valida, colorPrimario: '#000000;}</style><script>alert(1)</script>' }],
    ['color con espacios', { ...valida, colorPrimario: ' #0b5fff' }],
    ['color que no es texto', { ...valida, colorPrimario: 123456 }],
    ['logo http (no https)', { ...valida, logoUrl: 'http://cdn.ejemplo.ec/l.png' }],
    ['logo con esquema relativo', { ...valida, logoUrl: '//evil.example/l.png' }],
    ['logo javascript', { ...valida, logoUrl: 'javascript:alert(1)' }],
    ['logo data', { ...valida, logoUrl: 'data:image/svg+xml;base64,AAAA' }],
    ['logo con credenciales', { ...valida, logoUrl: 'https://u:p@cdn.ejemplo.ec/l.png' }],
    ['logo con barra invertida', { ...valida, logoUrl: '/\\evil.example' }],
    ['logo con espacios', { ...valida, logoUrl: 'https://cdn.ejemplo.ec/a b.png' }],
    ['logo desmesurado', { ...valida, logoUrl: `https://cdn.ejemplo.ec/${'a'.repeat(2100)}` }],
    ['logo que no es texto ni nulo', { ...valida, logoUrl: 5 }],
  ])('rechaza: %s', (_n, cuerpo) => {
    expect(validarMarca(cuerpo)).toBeNull();
  });
});

describe('cargarMarca', () => {
  const llamar = async (fetchFn: unknown, slug = 'empresa-a') =>
    cargarMarca({ slug, acceso: 'token-de-acceso', apiUrl: 'http://127.0.0.1:3001', fetchFn: fetchFn as typeof fetch });

  it('pide GET /empresa/marca con el token de la sesión y arma la empresa con el slug verificado', async () => {
    const fetchFn = vi.fn(async () => respuesta(valida));
    const r = await llamar(fetchFn);
    expect(r).toEqual({
      ok: true,
      empresa: { id: 'empresa-a', nombre: 'Empresa A (prueba)', primario: '#0b5fff', logoUrl: undefined },
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:3001/empresa/marca');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer token-de-acceso');
    expect(init.method ?? 'GET').toBe('GET');
    expect(init.cache).toBe('no-store');
    expect(init.redirect).toBe('error');
  });

  it.each([201, 202, 203, 403, 404])(
    'un estado %s (distinto de 200) → no disponible, aunque traiga un cuerpo igual al de la marca',
    async (estado) => {
      expect(await llamar(vi.fn(async () => respuesta(valida, estado)))).toEqual({
        ok: false,
        motivo: 'no_disponible',
      });
    },
  );

  it('401 → no autenticada (hay que volver a ingresar)', async () => {
    expect(await llamar(vi.fn(async () => respuesta({}, 401)))).toEqual({ ok: false, motivo: 'no_autenticado' });
  });

  it.each([
    ['429', () => respuesta({}, 429)],
    ['500', () => respuesta({}, 500)],
    ['respuesta que no es JSON', () => new Response('<html>', { status: 200 })],
    ['forma inválida', () => respuesta({ ...valida, colorPrimario: 'rojo' })],
    ['campos de más', () => respuesta({ ...valida, otraEmpresa: 'b' })],
  ])('%s → no disponible (nunca se inventa una marca)', async (_n, resp) => {
    expect(await llamar(vi.fn(async () => resp()))).toEqual({ ok: false, motivo: 'no_disponible' });
  });

  it('la red caída → no disponible', async () => {
    expect(await llamar(vi.fn(async () => Promise.reject(new Error('ECONNREFUSED'))))).toEqual({
      ok: false,
      motivo: 'no_disponible',
    });
  });

  it('un slug inválido nunca llega a la API', async () => {
    const fetchFn = vi.fn();
    for (const slug of ['EMPRESA', 'a b', '../x', '', 'a'.repeat(33)]) {
      expect(await llamar(fetchFn, slug), slug).toEqual({ ok: false, motivo: 'no_disponible' });
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
