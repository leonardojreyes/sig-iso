import { AutorizacionFake } from '@sig/autorizacion';
import { ObtenerIdentidadUseCase, ObtenerMarcaUseCase, type DatosEmpresa, type DatosPersona, type EmpresaRepositoryPort } from '@sig/empresas';
import { crearEmpresaId } from '@sig/tenancy';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearArnes, hechosEnMemoria, type Arnes } from '../autenticacion/prueba/arnes.js';
import { erroresDeEsquema } from '../autenticacion/prueba/contrato.js';
import { EmpresaSesionModule } from './empresa-sesion.module.js';

// /me, /empresa/marca, /sesion/inicio y /sesion/cierre sobre una aplicación Nest REAL, con repositorios en memoria que
// respetan el aislamiento por empresa. Cada respuesta se valida contra los esquemas de openapi.yaml.
const A = crearEmpresaId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
const B = crearEmpresaId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
const SIN_FILA = crearEmpresaId('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
const ADMIN_A = '44444444-4444-4444-8444-444444444444';
const COLAB_A = '55555555-5555-4555-8555-555555555555';
const ADMIN_B = '66666666-6666-4666-8666-666666666666';
const DESACTIVADO_A = '77777777-7777-4777-8777-777777777777';
const FANTASMA = '88888888-8888-4888-8888-888888888888';

const empresas: Record<string, DatosEmpresa> = {
  [A]: { id: A, slug: 'empresa-a', nombre: 'Empresa A (prueba)', colorPrimario: '#0b5fff', logoUrl: 'https://cdn.empresa-a.test/logo.png' },
  [B]: { id: B, slug: 'empresa-b', nombre: 'Empresa B (prueba)', colorPrimario: '#ffe066', logoUrl: 'http://inseguro.empresa-b.test/logo.png' },
};
const personas: Record<string, Record<string, DatosPersona>> = {
  [A]: { [ADMIN_A]: { id: ADMIN_A, nombre: 'Administradora A' }, [COLAB_A]: { id: COLAB_A, nombre: 'Colaborador A' }, [DESACTIVADO_A]: { id: DESACTIVADO_A, nombre: 'Persona desactivada' } },
  [B]: { [ADMIN_B]: { id: ADMIN_B, nombre: 'Administrador B' } },
};

describe('/me, /empresa/marca y /sesion/* (tareas 6.5; H1.1, H3.1–H3.3, H6.1, H6.3)', () => {
  let arnes: Arnes;
  const { estado, hechos } = hechosEnMemoria();
  let sesion = 0;
  const token = (empresa: string, usuario: string, extra: Record<string, unknown> = {}) => arnes.firmar(empresa, usuario, { sid: `sesion-${++sesion}`, ...extra });

  beforeAll(async () => {
    const autorizacion = new AutorizacionFake();
    autorizacion.asignar(A, ADMIN_A, 'administrador_sig');
    autorizacion.asignar(A, COLAB_A, 'colaborador');
    autorizacion.asignar(B, ADMIN_B, 'administrador_sig');
    // DESACTIVADO_A existe como persona pero ya no tiene roles.
    const repo: EmpresaRepositoryPort = {
      obtenerPropia: async (e) => empresas[e] ?? null,
      obtenerPersona: async (e, u) => personas[e]?.[u] ?? null,
    };
    arnes = await crearArnes({
      hechos,
      modulos: [EmpresaSesionModule.register({ identidades: new ObtenerIdentidadUseCase(repo, autorizacion), marcas: new ObtenerMarcaUseCase(repo), hechos })],
    });
  });
  afterAll(async () => { await arnes.cerrar(); });
  beforeEach(() => { estado.eventos = []; estado.falla = false; estado.origenes.clear(); });

  const json = async (r: Response) => (await r.json()) as Record<string, unknown>;
  const problema = async (r: Response, status: number, codigo: string) => {
    expect(r.status).toBe(status);
    const c = await json(r);
    expect(c).toMatchObject({ status, codigo });
    expect(erroresDeEsquema('Problema', c)).toEqual([]);
  };

  describe('GET /me (H1.1)', () => {
    it('devuelve la persona, sus roles y el nombre y slug de SU empresa, conforme al contrato', async () => {
      const r = await arnes.pedir('/me', await token(A, ADMIN_A));
      expect(r.status).toBe(200);
      expect(r.headers.get('cache-control')).toBe('no-store');
      const c = await json(r);
      expect(c).toEqual({ usuarioId: ADMIN_A, nombre: 'Administradora A', roles: ['administrador_sig'], empresa: { slug: 'empresa-a', nombre: 'Empresa A (prueba)' } });
      expect(erroresDeEsquema('Identidad', c)).toEqual([]);
    });

    it('un colaborador ve su rol; una persona de B ve la empresa B', async () => {
      expect((await json(await arnes.pedir('/me', await token(A, COLAB_A)))).roles).toEqual(['colaborador']);
      const deB = await json(await arnes.pedir('/me', await token(B, ADMIN_B)));
      expect(deB.empresa).toEqual({ slug: 'empresa-b', nombre: 'Empresa B (prueba)' });
    });

    it('no expone el identificador interno de la empresa ni datos de la otra', async () => {
      const texto = JSON.stringify(await json(await arnes.pedir('/me', await token(A, ADMIN_A))));
      expect(texto).not.toContain(A);
      expect(texto).not.toContain(B);
      expect(texto).not.toMatch(/empresa-b|Empresa B/);
    });

    it('la empresa del token manda aunque el cliente pida otra (encabezado o consulta)', async () => {
      const t = await token(A, ADMIN_A);
      for (const ruta of [`/me?empresa=${B}`, `/me?tenant=${B}`]) expect(((await json(await arnes.pedir(ruta, t))).empresa as { slug: string }).slug).toBe('empresa-a');
    });

    it('sin token → 401', async () => {
      await problema(await arnes.pedir('/me'), 401, 'no_autenticado');
    });

    it('una persona que ya no tiene roles (cuenta desactivada) o que no existe en la empresa → 401', async () => {
      await problema(await arnes.pedir('/me', await token(A, DESACTIVADO_A)), 401, 'no_autenticado');
      await problema(await arnes.pedir('/me', await token(A, FANTASMA)), 401, 'no_autenticado');
      await problema(await arnes.pedir('/me', await token(A, ADMIN_B)), 401, 'no_autenticado');
    });

    it('una empresa del token sin fila → 401', async () => {
      await problema(await arnes.pedir('/me', await token(SIN_FILA, ADMIN_A)), 401, 'no_autenticado');
    });
  });

  describe('GET /empresa/marca (H3.1–H3.3)', () => {
    it('devuelve la marca de la empresa del token, conforme al contrato y sin monograma', async () => {
      const r = await arnes.pedir('/empresa/marca', await token(A, COLAB_A));
      expect(r.status).toBe(200);
      expect(r.headers.get('cache-control')).toBe('no-store');
      const c = await json(r);
      expect(c).toEqual({ nombre: 'Empresa A (prueba)', colorPrimario: '#0b5fff', colorOriginal: '#0b5fff', ajustadoPorContraste: false, logoUrl: 'https://cdn.empresa-a.test/logo.png' });
      expect(erroresDeEsquema('Marca', c)).toEqual([]);
    });

    it('H3.1: A recibe solo lo de A y B solo lo de B; nada de la otra viaja en la respuesta', async () => {
      const deA = JSON.stringify(await json(await arnes.pedir('/empresa/marca', await token(A, ADMIN_A))));
      const deB = JSON.stringify(await json(await arnes.pedir('/empresa/marca', await token(B, ADMIN_B))));
      expect(deA).not.toMatch(/Empresa B|ffe066|inseguro/i);
      expect(deB).not.toMatch(/Empresa A|0b5fff|empresa-a\.test/i);
    });

    it('H3.2 y H3.3: ajusta el color por contraste y descarta el logo no permitido', async () => {
      const c = await json(await arnes.pedir('/empresa/marca', await token(B, ADMIN_B)));
      expect(c.ajustadoPorContraste).toBe(true);
      expect(c.colorOriginal).toBe('#ffe066');
      expect(c.colorPrimario).not.toBe('#ffe066');
      expect(c.logoUrl).toBeNull();
      expect(erroresDeEsquema('Marca', c)).toEqual([]);
    });

    it('la empresa de la consulta no cambia lo que se devuelve', async () => {
      expect((await json(await arnes.pedir(`/empresa/marca?empresa=${B}`, await token(A, ADMIN_A)))).nombre).toBe('Empresa A (prueba)');
    });

    it('sin token → 401; empresa del token sin fila → 401', async () => {
      await problema(await arnes.pedir('/empresa/marca'), 401, 'no_autenticado');
      await problema(await arnes.pedir('/empresa/marca', await token(SIN_FILA, ADMIN_A)), 401, 'no_autenticado');
    });
  });

  describe('POST /sesion/inicio (H6.1)', () => {
    it('responde 204 sin cuerpo y deja UN hecho login.ok con quién y qué empresa, derivados del token', async () => {
      const r = await arnes.pedir('/sesion/inicio', await token(A, ADMIN_A, { sid: 'sesion-inicio-1' }), 'POST');
      expect(r.status).toBe(204);
      expect(await r.text()).toBe('');
      expect(r.headers.get('cache-control')).toBe('no-store');
      expect(estado.eventos).toEqual([
        { empresaId: A, actor: { tipo: 'usuario', usuarioId: ADMIN_A }, accion: 'login.ok', resultado: 'ok', origenId: 'login:sesion-inicio-1' },
      ]);
    });

    it('es idempotente por sesión: repetirlo da 204 sin escribir otro hecho; otra sesión escribe el suyo', async () => {
      const t = await token(A, ADMIN_A, { sid: 'sesion-repetida' });
      expect((await arnes.pedir('/sesion/inicio', t, 'POST')).status).toBe(204);
      expect((await arnes.pedir('/sesion/inicio', t, 'POST')).status).toBe(204);
      expect(estado.eventos).toHaveLength(1);
      expect((await arnes.pedir('/sesion/inicio', await token(A, ADMIN_A, { sid: 'sesion-otra' }), 'POST')).status).toBe(204);
      expect(estado.eventos).toHaveLength(2);
    });

    it('la empresa y la persona del hecho salen del token, no de lo que envíe el cliente', async () => {
      await arnes.pedir(`/sesion/inicio?empresa=${B}&usuario=${ADMIN_B}`, await token(A, ADMIN_A), 'POST');
      expect(estado.eventos.map((e) => [e.empresaId, e.actor.usuarioId])).toEqual([[A, ADMIN_A]]);
    });

    it('H6.8: si NO se puede escribir el hecho, responde 500 (no hay sesión sin rastro)', async () => {
      estado.falla = true;
      await problema(await arnes.pedir('/sesion/inicio', await token(A, ADMIN_A), 'POST'), 500, 'error_interno');
    });

    it('un token sin identificador de sesión (sid) → 401 y nada registrado', async () => {
      const sinSid = await arnes.firmar(A, ADMIN_A);
      await problema(await arnes.pedir('/sesion/inicio', sinSid, 'POST'), 401, 'no_autenticado');
      expect(estado.eventos).toEqual([]);
    });

    it('una cuenta desactivada o inexistente no inicia sesión: 401 y nada registrado', async () => {
      await problema(await arnes.pedir('/sesion/inicio', await token(A, DESACTIVADO_A), 'POST'), 401, 'no_autenticado');
      await problema(await arnes.pedir('/sesion/inicio', await token(A, FANTASMA), 'POST'), 401, 'no_autenticado');
      expect(estado.eventos).toEqual([]);
    });

    it('sin token → 401 y nada registrado', async () => {
      await problema(await arnes.pedir('/sesion/inicio', undefined, 'POST'), 401, 'no_autenticado');
      expect(estado.eventos).toEqual([]);
    });
  });

  describe('POST /sesion/cierre (H6.3)', () => {
    it('responde 204 sin cuerpo y deja UN hecho logout', async () => {
      const r = await arnes.pedir('/sesion/cierre', await token(A, COLAB_A, { sid: 'sesion-cierre-1' }), 'POST');
      expect(r.status).toBe(204);
      expect(await r.text()).toBe('');
      expect(estado.eventos).toEqual([
        { empresaId: A, actor: { tipo: 'usuario', usuarioId: COLAB_A }, accion: 'logout', resultado: 'ok', origenId: 'logout:sesion-cierre-1' },
      ]);
    });

    it('es idempotente por sesión', async () => {
      const t = await token(A, COLAB_A, { sid: 'sesion-cierre-2' });
      await arnes.pedir('/sesion/cierre', t, 'POST');
      expect((await arnes.pedir('/sesion/cierre', t, 'POST')).status).toBe(204);
      expect(estado.eventos).toHaveLength(1);
    });

    it('también cierra la sesión una cuenta ya desactivada (el cierre no depende de tener roles)', async () => {
      expect((await arnes.pedir('/sesion/cierre', await token(A, DESACTIVADO_A), 'POST')).status).toBe(204);
      expect(estado.eventos.map((e) => e.accion)).toEqual(['logout']);
    });

    it('H6.8: si NO se puede escribir el hecho, responde 500', async () => {
      estado.falla = true;
      await problema(await arnes.pedir('/sesion/cierre', await token(A, COLAB_A), 'POST'), 500, 'error_interno');
    });

    it('sin sid o sin token → 401 y nada registrado', async () => {
      await problema(await arnes.pedir('/sesion/cierre', await arnes.firmar(A, COLAB_A), 'POST'), 401, 'no_autenticado');
      await problema(await arnes.pedir('/sesion/cierre', undefined, 'POST'), 401, 'no_autenticado');
      expect(estado.eventos).toEqual([]);
    });
  });

  it('inicio y cierre de una misma sesión son hechos distintos (login:… y logout:…)', async () => {
    const t = await token(A, ADMIN_A, { sid: 'sesion-completa' });
    await arnes.pedir('/sesion/inicio', t, 'POST');
    await arnes.pedir('/sesion/cierre', t, 'POST');
    expect(estado.eventos.map((e) => [e.accion, e.origenId])).toEqual([['login.ok', 'login:sesion-completa'], ['logout', 'logout:sesion-completa']]);
  });

  it('ni /me ni /empresa/marca aceptan métodos que cambian algo', async () => {
    const t = await token(A, ADMIN_A);
    expect((await arnes.pedir('/me', t, 'POST')).status).toBe(404);
    expect((await arnes.pedir('/empresa/marca', t, 'DELETE')).status).toBe(404);
    expect((await arnes.pedir('/sesion/inicio', t, 'GET')).status).toBe(404);
  });
});
