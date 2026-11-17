import { AutorizacionFake } from '@sig/autorizacion';
import { crearEmpresaId } from '@sig/tenancy';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearArnes, hechosEnMemoria, type Arnes } from '../autenticacion/prueba/arnes.js';
import { erroresDeEsquema } from '../autenticacion/prueba/contrato.js';
import { PersonasApiModule } from './personas-api.module.js';
import { personasDePrueba } from './prueba/personas.js';

// Personas y solicitudes de acceso (M7, ADR 036) sobre una aplicación Nest REAL con los casos de uso reales y un almacén en memoria que
// respeta el aislamiento. Cada respuesta se valida contra los esquemas de openapi.yaml.
const A = crearEmpresaId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
const B = crearEmpresaId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
const ADMIN_A = '44444444-4444-4444-8444-444444444444';
const COLAB_A = '55555555-5555-4555-8555-555555555555';
const ADMIN_B = '66666666-6666-4666-8666-666666666666';
const NUEVA = '77777777-7777-4777-8777-777777777777'; // una cuenta de Keycloak que aún no tiene fila ni rol
const OTRA = '88888888-8888-4888-8888-888888888888';

describe('personas y solicitudes de acceso (M7)', () => {
  let arnes: Arnes;
  const { estado: hechosEstado, hechos } = hechosEnMemoria();
  const autorizacion = new AutorizacionFake();
  const mundo = personasDePrueba(autorizacion);
  let sesion = 0;
  const token = (empresa: string, usuario: string) => arnes.firmar(empresa, usuario, { sid: `s-${++sesion}` });
  const json = async (r: Response) => (await r.json()) as Record<string, unknown>;
  const pedir = (ruta: string, t: string | undefined, metodo = 'GET', cuerpo?: unknown) => arnes.pedir(ruta, t, metodo, metodo === 'GET' ? undefined : cuerpo);
  const solicitudDe = (empresa: string, usuario: string) => [...mundo.de(empresa).solicitudes.values()].find((s) => s.usuarioId === usuario)!;
  const aprobacion = { nombre: 'Laura Mena', correo: 'laura.mena@example.test', rol: 'colaborador' };

  beforeAll(async () => {
    autorizacion.asignar(A, ADMIN_A, 'administrador_sig');
    autorizacion.asignar(A, COLAB_A, 'colaborador');
    autorizacion.asignar(B, ADMIN_B, 'administrador_sig');
    arnes = await crearArnes({ hechos, modulos: [PersonasApiModule.register(mundo.opciones)] });
  });
  afterAll(async () => {
    await arnes.cerrar();
  });
  beforeEach(() => {
    mundo.estado.empresas.clear();
    mundo.estado.eventos = [];
    mundo.estado.fallaBitacora = false;
    hechosEstado.eventos = [];
    hechosEstado.falla = false;
    mundo.sembrar(A, { id: ADMIN_A, rol: 'administrador_sig' });
    mundo.sembrar(A, { id: COLAB_A, rol: 'colaborador' });
    mundo.sembrar(B, { id: ADMIN_B, rol: 'administrador_sig' });
  });

  it('sin token, las seis operaciones responden 401', async () => {
    const id = '99999999-9999-4999-8999-999999999999';
    for (const [metodo, ruta] of [['POST', '/acceso/solicitud'], ['GET', '/personas'], ['POST', `/personas/solicitudes/${id}/aprobacion`], ['POST', `/personas/solicitudes/${id}/descarte`], ['PUT', `/personas/${id}/rol`], ['POST', `/personas/${id}/baja`]] as const)
      expect((await pedir(ruta, undefined, metodo, {})).status, `${metodo} ${ruta}`).toBe(401);
  });

  describe('POST /acceso/solicitud', () => {
    it('una cuenta SIN fila ni rol pide acceso: 201 con código y plazo, sin caché; pedir de nuevo es 200 con el mismo código', async () => {
      const r = await pedir('/acceso/solicitud', await token(A, NUEVA), 'POST');
      expect(r.status).toBe(201);
      expect(r.headers.get('cache-control')).toBe('no-store');
      const s = await json(r);
      expect(erroresDeEsquema('SolicitudAcceso', s)).toEqual([]);
      expect(s['codigo']).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
      expect(new Date(s['venceEn'] as string).getTime()).toBe(mundo.estado.ahora.getTime() + 7 * 24 * 3600 * 1000);

      const otra = await pedir('/acceso/solicitud', await token(A, NUEVA), 'POST');
      expect(otra.status).toBe(200);
      expect(await json(otra)).toEqual(s);
      expect(mundo.estado.eventos).toMatchObject([{ empresaId: A, accion: 'acceso.solicitado', resultado: 'ok', actor: { tipo: 'usuario', usuarioId: NUEVA } }]);
      expect(JSON.stringify(mundo.estado.eventos)).not.toContain(s['codigo'] as string);
    });

    it('quien ya tiene un rol recibe 409 (conflicto) y no se crea nada', async () => {
      const r = await pedir('/acceso/solicitud', await token(A, COLAB_A), 'POST');
      expect(r.status).toBe(409);
      expect(r.headers.get('content-type')).toMatch(/application\/problem\+json/);
      expect(await json(r)).toMatchObject({ status: 409, codigo: 'conflicto' });
      expect(mundo.de(A).solicitudes.size).toBe(0);
    });

    it('la empresa de la solicitud es la del TOKEN, aunque el cliente mande otra', async () => {
      const r = await pedir('/acceso/solicitud', await token(A, NUEVA), 'POST', { empresaId: B, empresa: B });
      expect(r.status).toBe(201);
      expect(mundo.de(A).solicitudes.size).toBe(1);
      expect(mundo.de(B).solicitudes.size).toBe(0);
    });
  });

  describe('GET /personas', () => {
    it('el administrador ve las personas y las solicitudes vigentes con su código', async () => {
      await pedir('/acceso/solicitud', await token(A, NUEVA), 'POST');
      const r = await pedir('/personas', await token(A, ADMIN_A));
      expect(r.status).toBe(200);
      expect(r.headers.get('cache-control')).toBe('no-store');
      const c = await json(r);
      expect(erroresDeEsquema('Personas', c)).toEqual([]);
      expect((c['personas'] as { id: string }[]).map((p) => p.id).sort()).toEqual([ADMIN_A, COLAB_A].sort());
      expect(c['solicitudes']).toMatchObject([{ usuarioId: NUEVA, codigo: solicitudDe(A, NUEVA).codigo }]);
    });

    it('un colaborador y una cuenta sin rol reciben 403 y queda UN acceso.denegado con el permiso que faltó', async () => {
      for (const quien of [COLAB_A, NUEVA]) {
        hechosEstado.eventos = [];
        const r = await pedir('/personas', await token(A, quien));
        expect(r.status, quien).toBe(403);
        expect(hechosEstado.eventos).toMatchObject([{ empresaId: A, accion: 'acceso.denegado', resultado: 'rechazado', motivo: 'sin_permiso', objeto: 'accion:personas.ver' }]);
      }
    });

    it('no muestra las personas ni las solicitudes de otra empresa', async () => {
      await pedir('/acceso/solicitud', await token(B, OTRA), 'POST');
      const c = await json(await pedir('/personas', await token(A, ADMIN_A)));
      expect(JSON.stringify(c)).not.toContain(ADMIN_B);
      expect(JSON.stringify(c)).not.toContain(OTRA);
    });
  });

  describe('POST /personas/solicitudes/{id}/aprobacion', () => {
    const aprobar = async (empresa: string, quien: string, id: string, cuerpo: unknown = aprobacion) => pedir(`/personas/solicitudes/${id}/aprobacion`, await token(empresa, quien), 'POST', cuerpo);

    it('el administrador aprueba: 201 con la persona y su rol, queda el hecho SIN nombre ni correo, y la empresa del cuerpo se ignora', async () => {
      await pedir('/acceso/solicitud', await token(A, NUEVA), 'POST');
      const r = await aprobar(A, ADMIN_A, solicitudDe(A, NUEVA).id, { ...aprobacion, empresaId: B });
      expect(r.status).toBe(201);
      const p = await json(r);
      expect(erroresDeEsquema('Persona', p)).toEqual([]);
      expect(p).toMatchObject({ id: NUEVA, nombre: 'Laura Mena', correo: 'laura.mena@example.test', rol: 'colaborador', bajaEn: null, version: 1 });
      expect(mundo.de(B).personas.has(NUEVA)).toBe(false);
      const alta = mundo.estado.eventos.find((e) => e.accion === 'usuario.alta');
      expect(alta).toMatchObject({ empresaId: A, objeto: `usuario:${NUEVA}`, actor: { tipo: 'usuario', usuarioId: ADMIN_A }, despues: { rol: 'colaborador' } });
      expect(JSON.stringify(mundo.estado.eventos)).not.toMatch(/Laura|Mena|example\.test/);
    });

    it('un colaborador recibe 403 aunque mande basura (el permiso va antes que la forma) y nada cambia', async () => {
      await pedir('/acceso/solicitud', await token(A, NUEVA), 'POST');
      const r = await aprobar(A, COLAB_A, solicitudDe(A, NUEVA).id, { rol: 'superadministrador' });
      expect(r.status).toBe(403);
      expect(solicitudDe(A, NUEVA).estado).toBe('pendiente');
    });

    it.each([
      ['rol inexistente', { ...aprobacion, rol: 'jefe' }],
      ['correo mal formado', { ...aprobacion, correo: 'no-es-correo' }],
      ['nombre vacío', { ...aprobacion, nombre: '' }],
      ['cuerpo vacío', {}],
    ])('%s → 400 sin repetir lo enviado', async (_c, cuerpo) => {
      await pedir('/acceso/solicitud', await token(A, NUEVA), 'POST');
      const r = await aprobar(A, ADMIN_A, solicitudDe(A, NUEVA).id, cuerpo);
      expect(r.status).toBe(400);
      expect(JSON.stringify(await json(r))).not.toMatch(/no-es-correo|jefe/);
      expect(solicitudDe(A, NUEVA).estado).toBe('pendiente');
    });

    it('un identificador que no es UUID → 400; una solicitud que no existe → 404', async () => {
      expect((await aprobar(A, ADMIN_A, 'no-es-uuid')).status).toBe(400);
      expect((await aprobar(A, ADMIN_A, '99999999-9999-4999-8999-999999999999')).status).toBe(404);
    });

    it('AISLAMIENTO: el administrador de B no puede aprobar la solicitud de A (404 indistinguible) y A sigue pendiente', async () => {
      await pedir('/acceso/solicitud', await token(A, NUEVA), 'POST');
      const r = await aprobar(B, ADMIN_B, solicitudDe(A, NUEVA).id);
      expect(r.status).toBe(404);
      expect(await json(r)).toMatchObject({ status: 404, codigo: 'no_encontrado' });
      expect(solicitudDe(A, NUEVA).estado).toBe('pendiente');
      expect(mundo.de(B).personas.has(NUEVA)).toBe(false);
    });

    it('un correo que ya usa otra persona de la empresa → 409 y la solicitud sigue vigente', async () => {
      await pedir('/acceso/solicitud', await token(A, NUEVA), 'POST');
      const existente = mundo.de(A).personas.get(COLAB_A)!;
      const r = await aprobar(A, ADMIN_A, solicitudDe(A, NUEVA).id, { ...aprobacion, correo: existente.correo });
      expect(r.status).toBe(409);
      expect(solicitudDe(A, NUEVA).estado).toBe('pendiente');
    });

    it('si la bitácora falla, 500 y TODO se revierte (la persona no queda creada ni la solicitud aprobada)', async () => {
      await pedir('/acceso/solicitud', await token(A, NUEVA), 'POST');
      mundo.estado.fallaBitacora = true;
      const r = await aprobar(A, ADMIN_A, solicitudDe(A, NUEVA).id);
      expect(r.status).toBe(500);
      expect(mundo.de(A).personas.has(NUEVA)).toBe(false);
      expect(solicitudDe(A, NUEVA).estado).toBe('pendiente');
    });
  });

  describe('POST /personas/solicitudes/{id}/descarte', () => {
    it('204 y la solicitud queda descartada con su hecho; una segunda vez es 404', async () => {
      await pedir('/acceso/solicitud', await token(A, NUEVA), 'POST');
      const id = solicitudDe(A, NUEVA).id;
      const r = await pedir(`/personas/solicitudes/${id}/descarte`, await token(A, ADMIN_A), 'POST');
      expect(r.status).toBe(204);
      expect(solicitudDe(A, NUEVA).estado).toBe('descartada');
      expect(mundo.estado.eventos.at(-1)).toMatchObject({ accion: 'acceso.rechazado', objeto: `solicitud:${id}`, actor: { tipo: 'usuario', usuarioId: ADMIN_A } });
      expect((await pedir(`/personas/solicitudes/${id}/descarte`, await token(A, ADMIN_A), 'POST')).status).toBe(404);
    });

    it('un colaborador recibe 403 y el de otra empresa, 404', async () => {
      await pedir('/acceso/solicitud', await token(A, NUEVA), 'POST');
      const id = solicitudDe(A, NUEVA).id;
      expect((await pedir(`/personas/solicitudes/${id}/descarte`, await token(A, COLAB_A), 'POST')).status).toBe(403);
      expect((await pedir(`/personas/solicitudes/${id}/descarte`, await token(B, ADMIN_B), 'POST')).status).toBe(404);
      expect(solicitudDe(A, NUEVA).estado).toBe('pendiente');
    });
  });

  describe('PUT /personas/{id}/rol', () => {
    const cambiar = async (empresa: string, quien: string, id: string, cuerpo: unknown) => pedir(`/personas/${id}/rol`, await token(empresa, quien), 'PUT', cuerpo);

    it('cambia el rol: 200 con la persona y la versión nueva, y deja el rol anterior y el nuevo en la bitácora', async () => {
      const r = await cambiar(A, ADMIN_A, COLAB_A, { rol: 'auditor_interno', versionEsperada: 1 });
      expect(r.status).toBe(200);
      const p = await json(r);
      expect(erroresDeEsquema('Persona', p)).toEqual([]);
      expect(p).toMatchObject({ id: COLAB_A, rol: 'auditor_interno', version: 2 });
      expect(mundo.estado.eventos).toMatchObject([{ accion: 'rol.cambiado', objeto: `usuario:${COLAB_A}`, antes: { rol: 'colaborador' }, despues: { rol: 'auditor_interno' } }]);
    });

    it('versión vieja → 409; último administrador → 409; rol inválido → 400; colaborador → 403', async () => {
      await cambiar(A, ADMIN_A, COLAB_A, { rol: 'auditor_interno', versionEsperada: 1 });
      expect((await cambiar(A, ADMIN_A, COLAB_A, { rol: 'alta_direccion', versionEsperada: 1 })).status).toBe(409);
      expect((await cambiar(A, ADMIN_A, ADMIN_A, { rol: 'colaborador', versionEsperada: 1 })).status).toBe(409);
      expect((await cambiar(A, ADMIN_A, COLAB_A, { rol: 'jefe', versionEsperada: 2 })).status).toBe(400);
      expect((await cambiar(A, ADMIN_A, COLAB_A, { rol: 'colaborador', versionEsperada: 'x' })).status).toBe(400);
      expect((await cambiar(A, COLAB_A, COLAB_A, { rol: 'administrador_sig', versionEsperada: 2 })).status).toBe(403);
      expect(mundo.de(A).personas.get(ADMIN_A)!.rol).toBe('administrador_sig');
    });

    it('AISLAMIENTO: A no puede cambiar el rol de una persona de B (404)', async () => {
      const r = await cambiar(A, ADMIN_A, ADMIN_B, { rol: 'colaborador', versionEsperada: 1 });
      expect(r.status).toBe(404);
      expect(mundo.de(B).personas.get(ADMIN_B)).toMatchObject({ rol: 'administrador_sig', version: 1 });
    });
  });

  describe('POST /personas/{id}/baja', () => {
    const baja = async (empresa: string, quien: string, id: string, cuerpo: unknown) => pedir(`/personas/${id}/baja`, await token(empresa, quien), 'POST', cuerpo);

    it('deja el rol en nulo con la fecha de baja y conserva a la persona; una segunda baja es 404', async () => {
      const r = await baja(A, ADMIN_A, COLAB_A, { versionEsperada: 1 });
      expect(r.status).toBe(200);
      const p = await json(r);
      expect(erroresDeEsquema('Persona', p)).toEqual([]);
      expect(p).toMatchObject({ id: COLAB_A, rol: null, version: 2 });
      expect(p['bajaEn']).toBe(mundo.estado.ahora.toISOString());
      expect(mundo.estado.eventos).toMatchObject([{ accion: 'usuario.baja', objeto: `usuario:${COLAB_A}`, antes: { rol: 'colaborador' } }]);
      expect((await baja(A, ADMIN_A, COLAB_A, { versionEsperada: 2 })).status).toBe(404);
    });

    it('no da de baja al último administrador (409), valida la versión (400) y respeta permisos (403) y empresas (404)', async () => {
      expect((await baja(A, ADMIN_A, ADMIN_A, { versionEsperada: 1 })).status).toBe(409);
      expect((await baja(A, ADMIN_A, COLAB_A, {})).status).toBe(400);
      expect((await baja(A, COLAB_A, ADMIN_A, { versionEsperada: 1 })).status).toBe(403);
      expect((await baja(A, ADMIN_A, ADMIN_B, { versionEsperada: 1 })).status).toBe(404);
      expect(mundo.de(B).personas.get(ADMIN_B)!.rol).toBe('administrador_sig');
    });

    it('si la bitácora falla, 500 y la persona sigue con su rol', async () => {
      mundo.estado.fallaBitacora = true;
      expect((await baja(A, ADMIN_A, COLAB_A, { versionEsperada: 1 })).status).toBe(500);
      expect(mundo.de(A).personas.get(COLAB_A)).toMatchObject({ rol: 'colaborador', bajaEn: null, version: 1 });
    });
  });
});
