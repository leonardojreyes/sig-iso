import { A, ADMIN, B, COLAB, EstadoFalso } from '@sig/certificacion/prueba';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearArnes, hechosEnMemoria, type Arnes } from '../autenticacion/prueba/arnes.js';
import { erroresDeEsquema } from '../autenticacion/prueba/contrato.js';
import { CertificacionApiModule } from './certificacion-api.module.js';
import { opcionesDePrueba } from './prueba/opciones.js';
import { AlmacenArchivosLocal } from '@sig/certificacion';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Auditoría interna (ADR 040), procesos y relaciones, sobre una aplicación Nest REAL con los casos de uso reales y fakes que separan los
// datos por empresa. Cada respuesta se valida contra los esquemas de openapi.yaml. Orden: 401 → 403 → 400 → 404 → 409.
const ADMIN2 = '33333333-3333-4333-8333-3333333333e3';
const ADMIN_B = '66666666-6666-4666-8666-666666666666';
const SIN_PERMISOS = '99999999-9999-4999-8999-999999999999';
const ID_FALSO = 'dddddddd-0000-4000-8000-000000000000';
const TODOS = ['auditoria.ver', 'auditoria.planificar', 'auditoria.ejecutar', 'auditoria.aprobar', 'auditoria.gestionar'] as const;

const RUTAS: [string, string, unknown][] = [
  ['GET', '/procesos', undefined],
  ['POST', '/procesos', { nombre: 'x', duenaId: ADMIN }],
  ['POST', '/procesos/gestion-sig', undefined],
  ['PUT', `/procesos/${ID_FALSO}`, { versionEsperada: 1, nombre: 'x' }],
  ['POST', `/procesos/${ID_FALSO}/retiro`, undefined],
  ['GET', `/procesos/${ID_FALSO}/relaciones`, undefined],
  ['POST', `/procesos/${ID_FALSO}/relaciones`, { personaId: ADMIN, relacion: 'participa' }],
  ['POST', `/procesos/${ID_FALSO}/relaciones/eliminacion`, { personaId: ADMIN, relacion: 'participa' }],
];

describe('controladores de procesos de la auditoría interna (ADR 040)', () => {
  let arnes: Arnes;
  let estado: EstadoFalso;
  let raiz: string;
  const bitacora = hechosEnMemoria();
  let sesion = 0;
  const token = (empresa: string, usuario: string) => arnes.firmar(empresa, usuario, { sid: `s-${++sesion}` });
  const tAdmin = () => token(A, ADMIN);
  const tColab = () => token(A, COLAB);
  const tSin = () => token(A, SIN_PERMISOS);
  const tAdminB = () => token(B, ADMIN_B);

  beforeAll(async () => {
    raiz = await mkdtemp(join(tmpdir(), 'sigiso-api-aud-'));
    estado = new EstadoFalso();
    arnes = await crearArnes({
      hechos: bitacora.hechos,
      modulos: [
        CertificacionApiModule.register(
          opcionesDePrueba({ estado, almacen: new AlmacenArchivosLocal(raiz), reloj: () => new Date('2026-11-19T15:00:00Z') }),
        ),
      ],
    });
  });
  afterAll(async () => {
    await arnes.cerrar();
    await rm(raiz, { recursive: true, force: true });
  });
  beforeEach(() => {
    estado.auditoriaEstado.procesos.clear();
    estado.auditoriaEstado.relaciones.clear();
    estado.eventos = [];
    estado.permisos.clear();
    estado.fallarBitacora = false;
    for (const u of [ADMIN, ADMIN2]) estado.conceder(u, A, ...TODOS);
    estado.conceder(COLAB, A, 'auditoria.ver');
    estado.conceder(ADMIN_B, B, ...TODOS);
    estado.documentosEstado.personas.set(A, [
      { id: ADMIN, nombre: 'Ana Admin', rol: 'administrador_sig', activa: true },
      { id: ADMIN2, nombre: 'Beto Admin', rol: 'administrador_sig', activa: true },
      { id: COLAB, nombre: 'Carla Colaboradora', rol: 'colaborador', activa: true },
    ]);
    estado.documentosEstado.personas.set(B, [{ id: ADMIN_B, nombre: 'Admin B', rol: 'administrador_sig', activa: true }]);
    bitacora.estado.eventos = [];
    bitacora.estado.falla = false;
  });

  type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const json = async (r: Response) => (await r.json()) as J;
  const pedir = (ruta: string, t: string | undefined, metodo = 'GET', cuerpo?: unknown) => arnes.pedir(ruta, t, metodo, cuerpo);
  const problema = async (r: Response, status: number, codigo: string) => {
    expect(r.status).toBe(status);
    expect(r.headers.get('content-type')).toMatch(/^application\/problem\+json/);
    const c = await json(r);
    expect(c).toMatchObject({ status, codigo });
    expect(erroresDeEsquema('Problema', c)).toEqual([]);
  };
  const valida = (nombre: string, c: unknown) => expect(erroresDeEsquema(nombre, c), nombre).toEqual([]);
  const crear = async (extra: Record<string, unknown> = {}, t?: string) => {
    const r = await pedir('/procesos', t ?? (await tAdmin()), 'POST', { nombre: 'NOMBRE-PRIVADO Compras', duenaId: ADMIN, ...extra });
    expect(r.status).toBe(201);
    return json(r);
  };

  it('sin token todas las rutas responden 401, y sin permiso 403 antes de mirar el cuerpo', async () => {
    for (const [m, ruta, cuerpo] of RUTAS) {
      await problema(await pedir(ruta, undefined, m, cuerpo), 401, 'no_autenticado');
      await problema(await pedir(ruta, await tSin(), m, m === 'GET' ? undefined : {}), 403, 'sin_permiso');
    }
    for (const [m, ruta] of RUTAS.filter(([m]) => m !== 'GET'))
      await problema(await pedir(ruta, await tColab(), m, {}), 403, 'sin_permiso');
    expect(estado.auditoriaEstado.procesos.size).toBe(0);
  });

  it('crea, lista, cambia y retira; cada respuesta cumple el contrato y la bitácora no lleva textos', async () => {
    const p = await crear({ descripcion: 'DESCRIPCION-PRIVADA', importancia: 'alta' });
    valida('Proceso', p);
    expect(p).toMatchObject({ codigo: 'PR-001', importancia: 'alta', frecuencia: 'anual', estado: 'vigente', personasRelacionadas: 1 });

    const lista = await json(await pedir('/procesos', await tColab()));
    valida('ListaProcesos', lista);
    expect(lista.procesos).toHaveLength(1);
    expect(lista.gestionSigVigente).toBe(false);

    const rc = await pedir(`/procesos/${p.id}`, await tAdmin(), 'PUT', {
      versionEsperada: 1,
      nombre: 'Compras y logística',
      cambioRelevante: 'cambio',
    });
    expect(rc.status).toBe(200);
    const cambiado = await json(rc);
    valida('Proceso', cambiado);
    expect(cambiado).toMatchObject({ version: 2, cambioRelevante: 'cambio' });
    await problema(await pedir(`/procesos/${p.id}`, await tAdmin(), 'PUT', { versionEsperada: 1, nombre: 'otra' }), 409, 'conflicto');

    expect((await pedir(`/procesos/${p.id}/retiro`, await tAdmin(), 'POST')).status).toBe(204);
    await problema(await pedir(`/procesos/${p.id}/retiro`, await tAdmin(), 'POST'), 409, 'conflicto');
    expect(estado.eventos.map((e) => e.accion)).toEqual(['proceso.creado', 'relacion.creada', 'proceso.cambiado', 'proceso.retirado']);
    const todo = JSON.stringify(estado.eventos);
    for (const secreto of ['NOMBRE-PRIVADO', 'DESCRIPCION-PRIVADA', 'logística', 'Ana Admin']) expect(todo).not.toContain(secreto);
  });

  it('«Gestión del SIG»: 201 y un segundo intento es 409', async () => {
    const r = await pedir('/procesos/gestion-sig', await tAdmin(), 'POST');
    expect(r.status).toBe(201);
    const p = await json(r);
    valida('Proceso', p);
    expect(p).toMatchObject({ nombre: 'Gestión del SIG', transversal: true, duenaId: ADMIN });
    await problema(await pedir('/procesos/gestion-sig', await token(A, ADMIN2), 'POST'), 409, 'conflicto');
    expect((await json(await pedir('/procesos', await tAdmin()))).gestionSigVigente).toBe(true);
  });

  it('datos mal formados son 400 y no dejan nada; los campos de más se ignoran (la empresa no se envía)', async () => {
    for (const cuerpo of [
      {},
      { nombre: '', duenaId: ADMIN },
      { nombre: 'x', duenaId: 'no-uuid' },
      { nombre: 'x', duenaId: ADMIN, importancia: 'enorme' },
    ])
      await problema(await pedir('/procesos', await tAdmin(), 'POST', cuerpo), 400, 'parametro_invalido');
    const r = await pedir('/procesos', await tAdmin(), 'POST', {
      nombre: 'ok',
      duenaId: ADMIN,
      empresaId: B,
      codigo: 'PR-999',
      transversal: true,
    });
    expect(r.status).toBe(201);
    expect(await json(r)).toMatchObject({ codigo: 'PR-001', transversal: false });
    expect(estado.auditoriaEstado.procesos.size).toBe(1);
  });

  it('relaciones: 201 la primera vez, 200 si ya existía, 204 al quitar y la dueña vigente no se quita', async () => {
    const p = await crear();
    const url = `/procesos/${p.id}/relaciones`;
    const r1 = await pedir(url, await tAdmin(), 'POST', { personaId: COLAB, relacion: 'participa' });
    expect(r1.status).toBe(201);
    valida('RelacionProceso', await json(r1));
    expect((await pedir(url, await tAdmin(), 'POST', { personaId: COLAB, relacion: 'participa' })).status).toBe(200);
    const lista = await json(await pedir(url, await tColab()));
    valida('ListaRelaciones', lista);
    expect(lista.relaciones).toHaveLength(2);
    await problema(await pedir(`${url}/eliminacion`, await tAdmin(), 'POST', { personaId: ADMIN, relacion: 'duena' }), 409, 'conflicto');
    expect((await pedir(`${url}/eliminacion`, await tAdmin(), 'POST', { personaId: COLAB, relacion: 'participa' })).status).toBe(204);
    await problema(
      await pedir(`${url}/eliminacion`, await tAdmin(), 'POST', { personaId: COLAB, relacion: 'participa' }),
      404,
      'no_encontrado',
    );
    await problema(await pedir(url, await tAdmin(), 'POST', { personaId: 'no-uuid', relacion: 'participa' }), 400, 'parametro_invalido');
    await problema(await pedir(url, await tAdmin(), 'POST', { personaId: COLAB, relacion: 'jefa' }), 400, 'parametro_invalido');
  });

  it('un proceso de otra empresa es un 404 indistinguible del inexistente, y la empresa del token manda', async () => {
    const p = await crear();
    for (const [m, ruta, cuerpo] of RUTAS.filter(([, r]) => r.includes('/procesos/dddd'))) {
      const propio = ruta.replace(ID_FALSO, p.id);
      const cruzada = await pedir(propio, await tAdminB(), m, cuerpo);
      const inexistente = await pedir(ruta, await tAdminB(), m, cuerpo);
      expect([cruzada.status, inexistente.status]).toEqual([404, 404]);
      expect(await json(cruzada)).toEqual(await json(inexistente));
    }
    expect((await json(await pedir('/procesos', await tAdminB()))).procesos).toEqual([]);
    expect(estado.auditoriaEstado.procesos.get(p.id)).toMatchObject({ nombre: 'NOMBRE-PRIVADO Compras', version: 1 });
  });

  it('si la bitácora falla, la acción falla (500) y no queda nada', async () => {
    estado.fallarBitacora = true;
    const r = await pedir('/procesos', await tAdmin(), 'POST', { nombre: 'x', duenaId: ADMIN });
    expect(r.status).toBe(500);
    estado.fallarBitacora = false;
    expect(estado.auditoriaEstado.procesos.size).toBe(0);
  });
});
