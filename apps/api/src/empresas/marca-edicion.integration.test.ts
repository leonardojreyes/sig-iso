import { AutorizacionFake } from '@sig/autorizacion';
import { ObtenerIdentidadUseCase, ObtenerMarcaUseCase, type DatosEmpresa, type EmpresaRepositoryPort } from '@sig/empresas';
import { crearEmpresaId } from '@sig/tenancy';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearArnes, hechosEnMemoria, type Arnes } from '../autenticacion/prueba/arnes.js';
import { erroresDeEsquema } from '../autenticacion/prueba/contrato.js';
import { EmpresaSesionModule } from './empresa-sesion.module.js';
import { empresaActivaDePrueba } from './prueba/empresa-activa.js';
import { marcaDePrueba } from './prueba/marca.js';

// PUT /empresa/marca sobre una aplicación Nest REAL con el caso de uso real y un almacén en memoria que respeta el aislamiento.
// Cada respuesta se valida contra los esquemas de openapi.yaml.
const A = crearEmpresaId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
const B = crearEmpresaId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
const ADMIN_A = '44444444-4444-4444-8444-444444444444';
const COLAB_A = '55555555-5555-4555-8555-555555555555';
const ADMIN_B = '66666666-6666-4666-8666-666666666666';

const inicial = (): Record<string, DatosEmpresa> => ({
  [A]: { id: A, slug: 'empresa-a', nombre: 'Empresa A (prueba)', colorPrimario: '#0b5fff', logoUrl: null },
  [B]: { id: B, slug: 'empresa-b', nombre: 'Empresa B (prueba)', colorPrimario: '#b45309', logoUrl: null },
});

describe('PUT /empresa/marca (M6b-2)', () => {
  let arnes: Arnes;
  const empresas = inicial();
  const { estado, hechos } = hechosEnMemoria();
  let marca: ReturnType<typeof marcaDePrueba>;
  let sesion = 0;
  const token = (empresa: string, usuario: string) => arnes.firmar(empresa, usuario, { sid: `s-${++sesion}` });
  const editar = (t: string | undefined, cuerpo: unknown) => arnes.pedir('/empresa/marca', t, 'PUT', cuerpo);
  const json = async (r: Response) => (await r.json()) as Record<string, unknown>;

  beforeAll(async () => {
    const autorizacion = new AutorizacionFake();
    autorizacion.asignar(A, ADMIN_A, 'administrador_sig');
    autorizacion.asignar(A, COLAB_A, 'colaborador');
    autorizacion.asignar(B, ADMIN_B, 'administrador_sig');
    const repo: EmpresaRepositoryPort = { obtenerPropia: async (e) => empresas[e] ?? null, obtenerPersona: async (e, u) => (u === ADMIN_A || u === COLAB_A || u === ADMIN_B ? { id: u, nombre: 'Persona' } : null) };
    marca = marcaDePrueba(empresas, autorizacion);
    arnes = await crearArnes({
      hechos,
      modulos: [EmpresaSesionModule.register({ identidades: new ObtenerIdentidadUseCase(repo, autorizacion), marcas: new ObtenerMarcaUseCase(repo), hechos, actualizarMarca: marca.caso, ...empresaActivaDePrueba(hechos) })],
    });
  });
  afterAll(async () => {
    await arnes.cerrar();
  });
  beforeEach(() => {
    for (const k of Object.keys(empresas)) delete empresas[k];
    Object.assign(empresas, inicial());
    marca.estado.eventos = [];
    marca.estado.fallaBitacora = false;
    estado.eventos = [];
    estado.falla = false;
  });

  it('el administrador cambia el color y el logo: 200 con la forma del contrato, sin caché, y se ve en GET', async () => {
    const r = await editar(await token(A, ADMIN_A), { colorPrimario: '#0E5C42', logoUrl: 'https://cdn.example.test/a.png' });
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    const c = await json(r);
    expect(c).toMatchObject({ nombre: 'Empresa A (prueba)', colorOriginal: '#0e5c42', logoUrl: 'https://cdn.example.test/a.png', ajustadoPorContraste: false });
    expect(erroresDeEsquema('Marca', c)).toEqual([]);
    const get = await json(await arnes.pedir('/empresa/marca', await token(A, COLAB_A)));
    expect(get).toMatchObject({ colorOriginal: '#0e5c42', logoUrl: 'https://cdn.example.test/a.png' });
    expect(marca.estado.eventos).toMatchObject([{ empresaId: A, accion: 'marca.cambiada', resultado: 'ok', objeto: 'empresa:empresa-a', despues: { color_cambiado: true, logo_cambiado: true } }]);
  });

  it('un color que no cumple el contraste se guarda tal cual y la respuesta avisa que se aplica ajustado', async () => {
    const c = await json(await editar(await token(A, ADMIN_A), { colorPrimario: '#ffe066', logoUrl: null }));
    expect(c).toMatchObject({ colorOriginal: '#ffe066', ajustadoPorContraste: true });
    expect(c['colorPrimario']).not.toBe('#ffe066');
    expect(erroresDeEsquema('Marca', c)).toEqual([]);
  });

  it('un archivo de imagen bajo /logos/ sí se acepta', async () => {
    const c = await json(await editar(await token(A, ADMIN_A), { colorPrimario: '#0b5fff', logoUrl: '/logos/empresa-a.png' }));
    expect(c['logoUrl']).toBe('/logos/empresa-a.png');
  });

  it('el logo puede quitarse (nulo)', async () => {
    const t = await token(A, ADMIN_A);
    await editar(t, { colorPrimario: '#0b5fff', logoUrl: 'https://cdn.example.test/a.png' });
    const c = await json(await editar(t, { colorPrimario: '#0b5fff', logoUrl: null }));
    expect(c['logoUrl']).toBeNull();
  });

  it('un colaborador recibe 403 (aunque mande basura) y queda UN acceso.denegado con el permiso que faltó; nada cambia', async () => {
    for (const cuerpo of [{ colorPrimario: '#112233', logoUrl: null }, { colorPrimario: 'basura', logoUrl: 7 }, undefined]) {
      estado.eventos = [];
      const r = await editar(await token(A, COLAB_A), cuerpo);
      expect(r.status).toBe(403);
      expect(await json(r)).toMatchObject({ status: 403, codigo: 'sin_permiso' });
      expect(estado.eventos).toMatchObject([{ empresaId: A, accion: 'acceso.denegado', resultado: 'rechazado', motivo: 'sin_permiso', objeto: 'accion:marca.editar' }]);
    }
    expect(empresas[A]).toMatchObject({ colorPrimario: '#0b5fff', logoUrl: null });
    expect(marca.estado.eventos).toEqual([]);
  });

  it('exige token (401)', async () => {
    expect((await editar(undefined, { colorPrimario: '#112233', logoUrl: null })).status).toBe(401);
  });

  it.each([
    ['sin cuerpo', undefined],
    ['un cuerpo vacío', {}],
    ['una lista', [{ colorPrimario: '#112233', logoUrl: null }]],
    ['sin el logo', { colorPrimario: '#112233' }],
    ['sin el color', { logoUrl: null }],
    ['un color mal formado', { colorPrimario: 'rojo', logoUrl: null }],
    ['un color de 3 dígitos', { colorPrimario: '#fff', logoUrl: null }],
    ['un logo con http', { colorPrimario: '#112233', logoUrl: 'http://inseguro.example.test/x.png' }],
    ['un logo con javascript:', { colorPrimario: '#112233', logoUrl: 'javascript:alert(1)' }],
    ['un logo con otro host por «//»', { colorPrimario: '#112233', logoUrl: '//evil.example.test/x.png' }],
    ['un logo con credenciales', { colorPrimario: '#112233', logoUrl: 'https://u:p@cdn.example.test/x.png' }],
    ['una ruta del sitio que no es una imagen (la descarga de un documento)', { colorPrimario: '#112233', logoUrl: '/e/empresa-a/declaracion/documento' }],
    ['una ruta de inicio de sesión como logo', { colorPrimario: '#112233', logoUrl: '/auth/login?retorno=/' }],
    ['un logo vacío', { colorPrimario: '#112233', logoUrl: '' }],
    ['un logo que no es texto', { colorPrimario: '#112233', logoUrl: 5 }],
    ['un campo de más (el nombre)', { colorPrimario: '#112233', logoUrl: null, nombre: 'Otra' }],
    ['la empresa en el cuerpo', { colorPrimario: '#112233', logoUrl: null, empresaId: B }],
  ])('un cuerpo inválido (%s) es 400 y no cambia nada', async (_n, cuerpo) => {
    const r = await editar(await token(A, ADMIN_A), cuerpo);
    expect(r.status).toBe(400);
    expect(erroresDeEsquema('Problema', await json(r))).toEqual([]);
    expect(empresas[A]).toMatchObject({ colorPrimario: '#0b5fff', logoUrl: null, nombre: 'Empresa A (prueba)' });
    expect(marca.estado.eventos).toEqual([]);
  });

  describe('aislamiento entre empresas', () => {
    it('el administrador de B cambia SOLO la marca de B; la de A queda intacta', async () => {
      await editar(await token(B, ADMIN_B), { colorPrimario: '#112233', logoUrl: 'https://cdn.example.test/b.png' });
      expect(empresas[B]).toMatchObject({ colorPrimario: '#112233', logoUrl: 'https://cdn.example.test/b.png' });
      expect(empresas[A]).toMatchObject({ colorPrimario: '#0b5fff', logoUrl: null });
      expect(marca.estado.eventos).toMatchObject([{ empresaId: B, objeto: 'empresa:empresa-b' }]);
    });
    it('el administrador de A con un token que dice «A» nunca toca B, diga lo que diga el cuerpo', async () => {
      await editar(await token(A, ADMIN_A), { colorPrimario: '#445566', logoUrl: null });
      expect(empresas[B]).toMatchObject({ colorPrimario: '#b45309', logoUrl: null });
    });
    it('un administrador de A con un token de B no tiene permiso en B (la empresa sale del token)', async () => {
      const r = await editar(await token(B, ADMIN_A), { colorPrimario: '#445566', logoUrl: null });
      expect(r.status).toBe(403);
      expect(empresas[B]).toMatchObject({ colorPrimario: '#b45309' });
    });
  });

  it('repetir lo mismo no registra otro hecho', async () => {
    const t = await token(A, ADMIN_A);
    await editar(t, { colorPrimario: '#112233', logoUrl: null });
    await editar(t, { colorPrimario: '#112233', logoUrl: null });
    expect(marca.estado.eventos).toHaveLength(1);
  });

  it('si no se puede registrar el hecho, responde 500 y el cambio se revierte', async () => {
    marca.estado.fallaBitacora = true;
    const r = await editar(await token(A, ADMIN_A), { colorPrimario: '#112233', logoUrl: null });
    expect(r.status).toBe(500);
    expect(empresas[A]).toMatchObject({ colorPrimario: '#0b5fff' });
  });
});
