import { AutorizacionFake } from '@sig/autorizacion';
import { ObtenerIdentidadUseCase, ObtenerMarcaUseCase, type DatosEmpresa, type DatosPersona, type EmpresaRepositoryPort } from '@sig/empresas';
import { crearEmpresaId } from '@sig/tenancy';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearArnes, hechosEnMemoria, type Arnes } from '../autenticacion/prueba/arnes.js';
import { erroresDeEsquema } from '../autenticacion/prueba/contrato.js';
import { EmpresaSesionModule } from './empresa-sesion.module.js';
import { empresaActivaDePrueba } from './prueba/empresa-activa.js';
import { marcaDePrueba } from './prueba/marca.js';

// Una persona en varias empresas (ADR 035) sobre una aplicación Nest REAL: la guardia decide la empresa de cada petición con la
// empresa activa de la sesión. Cada respuesta se valida contra los esquemas de openapi.yaml.
const A = crearEmpresaId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
const B = crearEmpresaId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
const CONSULTOR = '99999999-9999-4999-8999-999999999999';
const SOLO_A = '44444444-4444-4444-8444-444444444444';
const SOLO_B = '66666666-6666-4666-8666-666666666666';

const empresas: Record<string, DatosEmpresa> = {
  [A]: { id: A, slug: 'empresa-a', nombre: 'Empresa A (prueba)', colorPrimario: '#0b5fff', logoUrl: null },
  [B]: { id: B, slug: 'empresa-b', nombre: 'Empresa B (prueba)', colorPrimario: '#ffe066', logoUrl: null },
};
const personas: Record<string, Record<string, DatosPersona>> = {
  [A]: { [CONSULTOR]: { id: CONSULTOR, nombre: 'Consultor (en A)' }, [SOLO_A]: { id: SOLO_A, nombre: 'Persona de A' } },
  [B]: { [CONSULTOR]: { id: CONSULTOR, nombre: 'Consultor (en B)' }, [SOLO_B]: { id: SOLO_B, nombre: 'Persona de B' } },
};

describe('cambio de empresa de una persona en varias empresas (ADR 035)', () => {
  let arnes: Arnes;
  const { estado, hechos } = hechosEnMemoria();
  const activa = empresaActivaDePrueba(hechos);
  let sesion = 0;
  /** Un token NUEVO con su propia sesión; `sid` fijo para repetir la misma sesión. */
  const token = (empresa: string, usuario: string, sid = `sesion-${++sesion}`) => arnes.firmar(empresa, usuario, { sid });
  const json = async (r: Response) => (await r.json()) as unknown;
  const cambiar = (t: string | undefined, cuerpo: unknown) => arnes.pedir('/sesion/empresa', t, 'POST', cuerpo);

  beforeAll(async () => {
    const autorizacion = new AutorizacionFake();
    autorizacion.asignar(A, CONSULTOR, 'administrador_sig'); // administra en A…
    autorizacion.asignar(B, CONSULTOR, 'colaborador'); // …y solo colabora en B: el rol no se hereda
    autorizacion.asignar(A, SOLO_A, 'colaborador');
    autorizacion.asignar(B, SOLO_B, 'administrador_sig');
    const repo: EmpresaRepositoryPort = { obtenerPropia: async (e) => empresas[e] ?? null, obtenerPersona: async (e, u) => personas[e]?.[u] ?? null };
    arnes = await crearArnes({
      hechos,
      empresaActiva: activa.resolver,
      modulos: [EmpresaSesionModule.register({ identidades: new ObtenerIdentidadUseCase(repo, autorizacion), marcas: new ObtenerMarcaUseCase(repo), hechos, actualizarMarca: marcaDePrueba(empresas, autorizacion).caso, listarEmpresas: activa.listarEmpresas, cambiarEmpresa: activa.cambiarEmpresa, olvidarEmpresa: activa.olvidarEmpresa })],
    });
  });
  afterAll(async () => {
    await arnes.cerrar();
  });
  beforeEach(() => {
    estado.eventos = [];
    estado.falla = false;
    estado.origenes.clear();
    activa.puerto.activas.clear();
    activa.puerto.falla = false;
    activa.puerto.pertenencias.clear();
    activa.puerto.pertenencias.set(CONSULTOR, [{ empresaId: A, slug: 'empresa-a', nombre: 'Empresa A (prueba)' }, { empresaId: B, slug: 'empresa-b', nombre: 'Empresa B (prueba)' }]);
    activa.puerto.pertenencias.set(SOLO_A, [{ empresaId: A, slug: 'empresa-a', nombre: 'Empresa A (prueba)' }]);
    activa.puerto.pertenencias.set(SOLO_B, [{ empresaId: B, slug: 'empresa-b', nombre: 'Empresa B (prueba)' }]);
  });

  describe('GET /sesion/empresas', () => {
    it('el consultor ve sus dos empresas con la de su sesión marcada, conforme al contrato', async () => {
      const r = await arnes.pedir('/sesion/empresas', await token(A, CONSULTOR));
      expect(r.status).toBe(200);
      expect(r.headers.get('cache-control')).toBe('no-store');
      const c = (await json(r)) as Record<string, unknown>[];
      expect(c).toEqual([{ slug: 'empresa-a', nombre: 'Empresa A (prueba)', activa: true }, { slug: 'empresa-b', nombre: 'Empresa B (prueba)', activa: false }]);
      for (const e of c) expect(erroresDeEsquema('EmpresaDePersona', e)).toEqual([]);
    });
    it('una persona de una sola empresa ve solo esa, y nunca la de otra', async () => {
      const c = (await json(await arnes.pedir('/sesion/empresas', await token(A, SOLO_A)))) as { slug: string }[];
      expect(c.map((e) => e.slug)).toEqual(['empresa-a']);
    });
    it('exige token (401)', async () => expect((await arnes.pedir('/sesion/empresas')).status).toBe(401));
  });

  describe('POST /sesion/empresa', () => {
    it('cambia: 200 con la empresa, el hecho queda en la empresa DESTINO y desde ya todo se evalúa con esa empresa y SU rol', async () => {
      const t = await token(A, CONSULTOR, 'sid-fijo');
      const antes = (await json(await arnes.pedir('/me', t))) as { roles: string[]; empresa: { slug: string } };
      expect([antes.empresa.slug, antes.roles]).toEqual(['empresa-a', ['administrador_sig']]);

      const r = await cambiar(t, { slug: 'empresa-b' });
      expect(r.status).toBe(200);
      expect(r.headers.get('cache-control')).toBe('no-store');
      const c = (await json(r)) as Record<string, unknown>;
      expect(c).toEqual({ slug: 'empresa-b', nombre: 'Empresa B (prueba)' });
      expect(erroresDeEsquema('EmpresaActual', c)).toEqual([]);
      expect(estado.eventos).toMatchObject([{ empresaId: B, actor: { tipo: 'usuario', usuarioId: CONSULTOR }, accion: 'empresa.cambiada', resultado: 'ok', objeto: 'empresa:empresa-b' }]);

      // El MISMO token (que sigue diciendo «empresa A») ahora es atendido como persona de B, con el rol que tiene en B.
      const despues = (await json(await arnes.pedir('/me', t))) as { nombre: string; roles: string[]; empresa: { slug: string } };
      expect([despues.empresa.slug, despues.roles, despues.nombre]).toEqual(['empresa-b', ['colaborador'], 'Consultor (en B)']);
      expect(((await json(await arnes.pedir('/empresa/marca', t))) as { nombre: string }).nombre).toBe('Empresa B (prueba)');
      const lista = (await json(await arnes.pedir('/sesion/empresas', t))) as { slug: string; activa: boolean }[];
      expect(lista.map((e) => [e.slug, e.activa])).toEqual([['empresa-a', false], ['empresa-b', true]]);
    });

    it('el cambio vale solo para ESA sesión: otra sesión del mismo consultor sigue en su empresa', async () => {
      await cambiar(await token(A, CONSULTOR, 'sid-uno'), { slug: 'empresa-b' });
      const otra = (await json(await arnes.pedir('/me', await token(A, CONSULTOR, 'sid-dos')))) as { empresa: { slug: string } };
      expect(otra.empresa.slug).toBe('empresa-a');
    });

    it('se puede volver a la empresa de origen', async () => {
      const t = await token(A, CONSULTOR, 'sid-vuelta');
      await cambiar(t, { slug: 'empresa-b' });
      expect((await cambiar(t, { slug: 'empresa-a' })).status).toBe(200);
      expect(((await json(await arnes.pedir('/me', t))) as { empresa: { slug: string } }).empresa.slug).toBe('empresa-a');
    });

    it('una empresa a la que NO pertenece es 404 (igual que una inexistente), nada cambia y queda un acceso.cruzado', async () => {
      const t = await token(A, SOLO_A, 'sid-ajeno');
      for (const slug of ['empresa-b', 'no-existe']) {
        estado.eventos = [];
        const r = await cambiar(t, { slug });
        expect(r.status).toBe(404);
        expect(r.headers.get('content-type')).toMatch(/^application\/problem\+json/);
        expect(await json(r)).toMatchObject({ status: 404, codigo: 'no_encontrado' });
        expect(estado.eventos).toMatchObject([{ empresaId: A, accion: 'acceso.cruzado', resultado: 'rechazado', motivo: 'empresa_distinta', objeto: `empresa:${slug}` }]);
      }
      expect(activa.puerto.activas.size).toBe(0);
      expect(((await json(await arnes.pedir('/me', t))) as { empresa: { slug: string } }).empresa.slug).toBe('empresa-a');
    });

    it('el 404 de «no pertenece» y el de «no existe» son idénticos', async () => {
      const t = await token(A, SOLO_A, 'sid-ident');
      const norm = async (r: Response) => JSON.stringify({ status: r.status, cuerpo: ((await json(r)) as Record<string, unknown>) });
      expect(await norm(await cambiar(t, { slug: 'empresa-b' }))).toBe(await norm(await cambiar(t, { slug: 'zzz' })));
    });

    it.each([
      ['sin cuerpo', undefined],
      ['un cuerpo vacío', {}],
      ['un número', 5],
      ['una lista', ['empresa-b']],
      ['el slug de otro tipo', { slug: 7 }],
      ['el slug con mayúsculas', { slug: 'EMPRESA-B' }],
      ['el slug con caracteres raros', { slug: '../b' }],
      ['el slug demasiado largo', { slug: 'a'.repeat(33) }],
      ['un campo de más (la empresa por identificador)', { slug: 'empresa-b', empresaId: B }],
      ['solo el identificador de la empresa', { empresaId: B }],
    ])('un cuerpo mal formado (%s) es 400 y no cambia nada', async (_n, cuerpo) => {
      const r = await cambiar(await token(A, CONSULTOR, 'sid-400'), cuerpo);
      expect(r.status).toBe(400);
      expect(activa.puerto.activas.size).toBe(0);
      expect(estado.eventos).toEqual([]);
    });

    it('exige token (401) y no registra nada', async () => {
      expect((await cambiar(undefined, { slug: 'empresa-b' })).status).toBe(401);
      expect(activa.puerto.activas.size).toBe(0);
    });

    it('un token sin identificador de sesión no puede cambiar de empresa', async () => {
      const t = await arnes.firmar(A, CONSULTOR, {});
      expect((await cambiar(t, { slug: 'empresa-b' })).status).toBe(401);
      expect(activa.puerto.activas.size).toBe(0);
    });

    it('si no se puede registrar el hecho, responde 500 y NO se cambia', async () => {
      estado.falla = true;
      const r = await cambiar(await token(A, CONSULTOR, 'sid-bitacora'), { slug: 'empresa-b' });
      expect(r.status).toBe(500);
      expect(activa.puerto.activas.size).toBe(0);
    });
  });

  describe('la guardia', () => {
    it('lo que diga la empresa del token no basta: la persona de B con un token que dice «A» y SIN elección sigue siendo de A solo si existe en A', async () => {
      // Sin empresa activa manda el token (comportamiento de siempre).
      const r = await arnes.pedir('/me', await token(A, SOLO_A));
      expect(((await json(r)) as { empresa: { slug: string } }).empresa.slug).toBe('empresa-a');
    });

    it('una elección guardada para otra persona o para otra sesión no se aplica', async () => {
      activa.puerto.activas.set('sid-ajeno-1', { usuario: SOLO_B, empresa: B, expira: new Date(Date.now() + 3600_000) });
      const r = await arnes.pedir('/me', await token(A, SOLO_A, 'sid-ajeno-1'));
      expect(((await json(r)) as { empresa: { slug: string } }).empresa.slug).toBe('empresa-a');
    });

    it('si a la persona se le quita su rol en la empresa elegida, la petición FALLA con 401 (no la atiende en silencio otra empresa) y la elección se olvida', async () => {
      const t = await token(A, CONSULTOR, 'sid-quitada');
      await cambiar(t, { slug: 'empresa-b' });
      expect(((await json(await arnes.pedir('/me', t))) as { empresa: { slug: string } }).empresa.slug).toBe('empresa-b');
      activa.puerto.pertenencias.set(CONSULTOR, [{ empresaId: A, slug: 'empresa-a', nombre: 'Empresa A (prueba)' }]);
      // La persona cree estar en B (su pantalla lo dice): se le avisa en vez de mostrarle los datos de A.
      const r = await arnes.pedir('/me', t);
      expect(r.status).toBe(401);
      expect(await json(r)).toMatchObject({ status: 401, codigo: 'no_autenticado' });
      expect(activa.puerto.activas.has('sid-quitada')).toBe(false);
      // Al volver a entrar, empieza en la empresa de su token.
      expect(((await json(await arnes.pedir('/me', t))) as { empresa: { slug: string } }).empresa.slug).toBe('empresa-a');
    });

    it('una elección vencida también falla con 401 y se olvida', async () => {
      const t = await token(A, CONSULTOR, 'sid-vencida');
      activa.puerto.activas.set('sid-vencida', { usuario: CONSULTOR, empresa: B, expira: new Date(Date.now() - 1000) });
      expect((await arnes.pedir('/me', t)).status).toBe(401);
      expect(activa.puerto.activas.has('sid-vencida')).toBe(false);
    });

    it('si no se puede consultar la empresa activa, TODA petición autenticada responde 500 (no cae a otra empresa en silencio)', async () => {
      activa.puerto.falla = true;
      const r = await arnes.pedir('/me', await token(A, CONSULTOR, 'sid-caida'));
      expect(r.status).toBe(500);
    });
  });

  describe('cierre de sesión', () => {
    it('al cerrar la sesión se olvida la empresa elegida: quien vuelve a entrar empieza en la de su token', async () => {
      const t = await token(A, CONSULTOR, 'sid-cierre');
      await cambiar(t, { slug: 'empresa-b' });
      expect(activa.puerto.activas.has('sid-cierre')).toBe(true);
      // El cierre se registra en la empresa de la sesión (la activa): el hecho existe en ella.
      expect((await arnes.pedir('/sesion/cierre', t, 'POST')).status).toBe(204);
      expect(activa.puerto.activas.has('sid-cierre')).toBe(false);
      const otraVez = (await json(await arnes.pedir('/me', await token(A, CONSULTOR, 'sid-cierre')))) as { empresa: { slug: string } };
      expect(otraVez.empresa.slug).toBe('empresa-a');
    });
  });

  describe('orden del límite de frecuencia y la consulta de la empresa activa', () => {
    it('agotado el límite de la persona, la base NO se consulta: el tope protege también a la base', async () => {
      const hechos2 = hechosEnMemoria();
      const activa2 = empresaActivaDePrueba(hechos2.hechos);
      let consultas = 0;
      const original = activa2.puerto.activaDe.bind(activa2.puerto);
      activa2.puerto.activaDe = async (...a) => {
        consultas += 1;
        return original(...a);
      };
      const autorizacion = new AutorizacionFake();
      autorizacion.asignar(A, CONSULTOR, 'administrador_sig');
      const repo: EmpresaRepositoryPort = { obtenerPropia: async (e) => empresas[e] ?? null, obtenerPersona: async (e, u) => personas[e]?.[u] ?? null };
      const arnes2 = await crearArnes({
        hechos: hechos2.hechos,
        empresaActiva: activa2.resolver,
        limites: { persona: 2, empresa: 1000 },
        modulos: [EmpresaSesionModule.register({ identidades: new ObtenerIdentidadUseCase(repo, autorizacion), marcas: new ObtenerMarcaUseCase(repo), hechos: hechos2.hechos, actualizarMarca: marcaDePrueba(empresas, autorizacion).caso, listarEmpresas: activa2.listarEmpresas, cambiarEmpresa: activa2.cambiarEmpresa, olvidarEmpresa: activa2.olvidarEmpresa })],
      });
      try {
        const t = await arnes2.firmar(A, CONSULTOR, { sid: 'sid-tope' });
        const estados: number[] = [];
        for (let i = 0; i < 6; i++) estados.push((await arnes2.pedir('/me', t)).status);
        expect(estados).toEqual([200, 200, 429, 429, 429, 429]);
        expect(consultas).toBe(2); // solo las dos admitidas consultaron la base
      } finally {
        await arnes2.cerrar();
      }
    });
  });
});
