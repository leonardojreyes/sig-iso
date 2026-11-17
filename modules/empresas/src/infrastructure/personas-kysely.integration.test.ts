import { randomUUID } from 'node:crypto';
import { conTenant, GestorPools, leerUrls, ROLES_BD } from '@sig/db';
import { crearEmpresaId } from '@sig/tenancy';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AprobarSolicitudUseCase,
  CambiarRolUseCase,
  ConflictoDePersonasError,
  DarDeBajaUseCase,
  ListarPersonasUseCase,
  PersonaDeLaEmpresaNoEncontradaError,
  SolicitarAccesoUseCase,
  SolicitudNoEncontradaError,
} from '../application/personas.use-cases.js';
import { VIDA_SOLICITUD_MS } from '../domain/solicitud-acceso.js';
import { crearUnidadDeTrabajoPersonas } from './unidad-de-trabajo-personas.js';

// Personas y solicitudes de acceso con PostgreSQL real y varias empresas (ADR 036, M7): el cambio y el hecho van en la MISMA transacción,
// A no toca B, un choque deja todo como estaba y dos administradores no pueden dejar a la empresa sin ninguno. Cada ejecución usa
// empresas y personas propias (la bitácora no se puede borrar).
const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)('personas y solicitudes de acceso (PostgreSQL real)', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 8 });
  const owner = () => pools.db('owner');
  const sufijo = randomUUID().slice(0, 6);
  const A = crearEmpresaId(randomUUID());
  const B = crearEmpresaId(randomUUID());
  const C = crearEmpresaId(randomUUID()); // dos administradores, para la carrera del último administrador
  const ADMIN_A = randomUUID();
  const ADMIN_B = randomUUID();
  const ADM1 = randomUUID();
  const ADM2 = randomUUID();
  const CONSULTOR = randomUUID(); // la misma cuenta pide acceso en A y en B
  // El permiso depende de la persona Y de la empresa: cada administrador solo lo es en la suya.
  const administra = new Set([`${ADMIN_A}|${A}`, `${ADMIN_B}|${B}`, `${ADM1}|${C}`, `${ADM2}|${C}`]);
  const permisos = { puede: async (u: string, _p: string, e: string) => administra.has(`${u}|${e}`) };
  const unidad = () => crearUnidadDeTrabajoPersonas(pools.db('app'));
  const aleatorio = (n: number) => crypto.getRandomValues(new Uint8Array(n));
  const solicitar = (empresaId: typeof A, usuarioId: string, ahora = new Date()) =>
    new SolicitarAccesoUseCase(unidad(), aleatorio, randomUUID).ejecutar({ empresaId, usuarioId, ahora });
  const listar = (empresaId: typeof A, usuarioId: string) =>
    new ListarPersonasUseCase(unidad(), permisos).ejecutar({ empresaId, usuarioId, ahora: new Date() });
  const aprobar = (
    empresaId: typeof A,
    usuarioId: string,
    solicitudId: string,
    extra: Partial<{ nombre: string; correo: string; rol: string }> = {},
  ) =>
    new AprobarSolicitudUseCase(unidad(), permisos).ejecutar({
      empresaId,
      usuarioId,
      solicitudId,
      nombre: 'Persona Prueba',
      correo: `p-${randomUUID().slice(0, 8)}@example.test`,
      rol: 'colaborador',
      ahora: new Date(),
      ...extra,
    });
  const cambiarRol = (empresaId: typeof A, usuarioId: string, personaId: string, rol: string, versionEsperada: number) =>
    new CambiarRolUseCase(unidad(), permisos).ejecutar({ empresaId, usuarioId, personaId, rol, versionEsperada });
  const baja = (empresaId: typeof A, usuarioId: string, personaId: string, versionEsperada: number) =>
    new DarDeBajaUseCase(unidad(), permisos).ejecutar({ empresaId, usuarioId, personaId, versionEsperada, ahora: new Date() });

  const idDeSolicitud = (empresaId: typeof A, usuarioId: string) =>
    conTenant(
      owner(),
      empresaId,
      async (trx) =>
        (await sql<{ id: string }>`select id from solicitud_acceso where usuario_id = ${usuarioId} and estado = 'pendiente'`.execute(trx))
          .rows[0]?.id as string,
    );
  const usuarioDe = (empresaId: typeof A, id: string) =>
    conTenant(
      owner(),
      empresaId,
      async (trx) =>
        (
          await sql<{
            rol: string | null;
            baja_en: Date | null;
            version: number;
            nombre: string;
          }>`select rol, baja_en, version, nombre from usuario where id = ${id}`.execute(trx)
        ).rows,
    );
  const hechos = (empresaId: typeof A) =>
    conTenant(
      owner(),
      empresaId,
      async (trx) =>
        (
          await sql<{
            accion: string;
            objeto: string;
            antes: unknown;
            despues: unknown;
            usuario_id: string;
          }>`select accion, objeto, antes, despues, usuario_id from bitacora where empresa_id = ${empresaId} order by secuencia`.execute(trx)
        ).rows,
    );
  const estados = (empresaId: typeof A, usuarioId: string) =>
    conTenant(owner(), empresaId, async (trx) =>
      (
        await sql<{ estado: string }>`select estado from solicitud_acceso where usuario_id = ${usuarioId} order by creada_en`.execute(trx)
      ).rows.map((r) => r.estado),
    );

  beforeAll(async () => {
    for (const [id, n, admins] of [
      [A, 'a', [ADMIN_A]],
      [B, 'b', [ADMIN_B]],
      [C, 'c', [ADM1, ADM2]],
    ] as const)
      await conTenant(owner(), id, async (trx) => {
        await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${`pe-${n}-${sufijo}`}, ${`Empresa ${n}`}, '#0b5fff')`.execute(
          trx,
        );
        for (const u of admins)
          await sql`insert into usuario (id, empresa_id, nombre, correo, rol) values (${u}, ${id}, ${`Admin ${u.slice(0, 4)}`}, ${`${u.slice(0, 8)}@example.test`}, 'administrador_sig')`.execute(
            trx,
          );
      });
  });
  afterAll(async () => {
    for (const id of [A, B, C])
      await conTenant(owner(), id, async (trx) => {
        await sql`delete from solicitud_acceso where empresa_id = ${id}`.execute(trx);
        await sql`delete from usuario where empresa_id = ${id}`.execute(trx);
        await sql`delete from empresa where id = ${id}`.execute(trx);
      });
    await pools.cerrar();
  });

  it('flujo completo: pide acceso, el administrador la ve con su código, la aprueba y deja los hechos SIN datos personales ni código', async () => {
    const nueva = randomUUID();
    const s = await solicitar(A, nueva);
    expect(s).toMatchObject({ nueva: true });
    expect((await solicitar(A, nueva)).codigo).toBe(s.codigo); // idempotente

    const vista = await listar(A, ADMIN_A);
    expect(vista.solicitudes.map((x) => ({ usuarioId: x.usuarioId, codigo: x.codigo }))).toContainEqual({
      usuarioId: nueva,
      codigo: s.codigo,
    });
    expect(vista.personas.map((p) => p.id)).toContain(ADMIN_A);

    const p = await aprobar(A, ADMIN_A, await idDeSolicitud(A, nueva), {
      nombre: 'Laura Mena',
      correo: 'Laura.Mena@Example.test',
      rol: 'colaborador',
    });
    expect(p).toMatchObject({
      id: nueva,
      nombre: 'Laura Mena',
      correo: 'laura.mena@example.test',
      rol: 'colaborador',
      version: 1,
      bajaEn: null,
    });
    expect(await usuarioDe(A, nueva)).toEqual([{ rol: 'colaborador', baja_en: null, version: 1, nombre: 'Laura Mena' }]);
    expect(await estados(A, nueva)).toEqual(['aprobada']);

    const h = (await hechos(A)).filter((x) => x.objeto !== null && (x.objeto.includes(nueva) || x.objeto.startsWith('solicitud:')));
    expect(h.map((x) => x.accion)).toEqual(['acceso.solicitado', 'usuario.alta']);
    expect(h[0]).toMatchObject({ usuario_id: nueva });
    expect(h[1]).toMatchObject({ usuario_id: ADMIN_A, despues: { rol: 'colaborador' } });
    expect(JSON.stringify(await hechos(A))).not.toMatch(new RegExp(`Laura|Mena|example\\.test|${s.codigo}`));
  });

  it('AISLAMIENTO: A no ve las solicitudes ni las personas de B, ni puede aprobarlas ni cambiarlas', async () => {
    const enB = randomUUID();
    await solicitar(B, enB);
    const solicitudDeB = await idDeSolicitud(B, enB);
    const personaDeB = (await listar(B, ADMIN_B)).personas[0]!;

    const vistaA = await listar(A, ADMIN_A);
    expect(vistaA.solicitudes.map((x) => x.usuarioId)).not.toContain(enB);
    expect(vistaA.personas.map((x) => x.id)).not.toContain(personaDeB.id);

    await expect(aprobar(A, ADMIN_A, solicitudDeB)).rejects.toBeInstanceOf(SolicitudNoEncontradaError);
    await expect(cambiarRol(A, ADMIN_A, personaDeB.id, 'colaborador', personaDeB.version)).rejects.toBeInstanceOf(
      PersonaDeLaEmpresaNoEncontradaError,
    );
    await expect(baja(A, ADMIN_A, personaDeB.id, personaDeB.version)).rejects.toBeInstanceOf(PersonaDeLaEmpresaNoEncontradaError);
    // Y el administrador de A, sin permiso en B, no puede actuar sobre B.
    await expect(aprobar(B, ADMIN_A, solicitudDeB)).rejects.toThrow(/permiso/i);
    expect(await estados(B, enB)).toEqual(['pendiente']);
    expect(await usuarioDe(B, personaDeB.id)).toMatchObject([{ rol: 'administrador_sig', version: 1 }]);
  });

  it('la misma cuenta (un consultor) pide acceso en dos empresas y cada una la resuelve por separado', async () => {
    const a = await solicitar(A, CONSULTOR);
    const b = await solicitar(B, CONSULTOR);
    expect(a.nueva && b.nueva).toBe(true);
    await aprobar(A, ADMIN_A, await idDeSolicitud(A, CONSULTOR), { rol: 'administrador_sig' });
    expect(await usuarioDe(A, CONSULTOR)).toMatchObject([{ rol: 'administrador_sig' }]);
    expect(await usuarioDe(B, CONSULTOR)).toEqual([]);
    expect(await estados(B, CONSULTOR)).toEqual(['pendiente']);
  });

  it('un correo repetido deja todo como estaba: la solicitud sigue vigente, no hay persona nueva y no hay hecho de alta', async () => {
    const nueva = randomUUID();
    await solicitar(A, nueva);
    const antes = (await hechos(A)).filter((x) => x.accion === 'usuario.alta').length;
    await expect(
      aprobar(A, ADMIN_A, await idDeSolicitud(A, nueva), { correo: `${ADMIN_A.slice(0, 8)}@example.test` }),
    ).rejects.toMatchObject({ motivo: 'correo_repetido' });
    expect(await estados(A, nueva)).toEqual(['pendiente']);
    expect(await usuarioDe(A, nueva)).toEqual([]);
    expect((await hechos(A)).filter((x) => x.accion === 'usuario.alta')).toHaveLength(antes);
  });

  it('cambiar el rol, dar de baja, volver a pedir y reactivar usa la misma fila y deja cada hecho con el rol anterior', async () => {
    const id = randomUUID();
    await solicitar(A, id);
    const p = await aprobar(A, ADMIN_A, await idDeSolicitud(A, id), { rol: 'colaborador' });
    const c = await cambiarRol(A, ADMIN_A, id, 'auditor_interno', p.version);
    expect(c).toMatchObject({ rol: 'auditor_interno', version: 2 });
    const b = await baja(A, ADMIN_A, id, c.version);
    expect(b).toMatchObject({ rol: null, version: 3 });
    expect(b.bajaEn).toBeInstanceOf(Date);
    expect(await usuarioDe(A, id)).toHaveLength(1); // la fila se conserva

    // Dada de baja no puede cambiar de rol; tiene que pedir acceso otra vez y se le reactiva.
    await expect(cambiarRol(A, ADMIN_A, id, 'colaborador', b.version)).rejects.toBeInstanceOf(PersonaDeLaEmpresaNoEncontradaError);
    expect((await solicitar(A, id)).nueva).toBe(true);
    const r = await aprobar(A, ADMIN_A, await idDeSolicitud(A, id), { rol: 'alta_direccion' });
    expect(r).toMatchObject({ id, rol: 'alta_direccion', bajaEn: null, version: 4 });
    expect(await usuarioDe(A, id)).toHaveLength(1);

    const mios = (await hechos(A)).filter((x) => x.objeto === `usuario:${id}`);
    expect(mios.map((x) => x.accion)).toEqual(['usuario.alta', 'rol.cambiado', 'usuario.baja', 'usuario.alta']);
    expect(mios[1]).toMatchObject({ antes: { rol: 'colaborador' }, despues: { rol: 'auditor_interno' } });
    expect(mios[2]).toMatchObject({ antes: { rol: 'auditor_interno' } });
  });

  it('CONCURRENCIA: dos cambios con la misma versión → uno gana y el otro recibe «versión vieja»', async () => {
    const id = randomUUID();
    await solicitar(A, id);
    const p = await aprobar(A, ADMIN_A, await idDeSolicitud(A, id));
    const r = await Promise.allSettled([
      cambiarRol(A, ADMIN_A, id, 'auditor_interno', p.version),
      cambiarRol(A, ADMIN_A, id, 'alta_direccion', p.version),
    ]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    const perdedora = r.find((x) => x.status === 'rejected') as PromiseRejectedResult;
    expect(perdedora.reason).toBeInstanceOf(ConflictoDePersonasError);
    expect(perdedora.reason).toMatchObject({ motivo: 'version_vieja' });
    expect((await usuarioDe(A, id))[0]).toMatchObject({ version: 2 });
    expect((await hechos(A)).filter((x) => x.accion === 'rol.cambiado' && x.objeto === `usuario:${id}`)).toHaveLength(1);
  });

  it('CARRERA: dos administradores que se dan de baja a la vez no dejan a la empresa sin administrador', async () => {
    const vistos = (await listar(C, ADM1)).personas;
    const v = (id: string) => vistos.find((p) => p.id === id)!.version;
    const r = await Promise.allSettled([baja(C, ADM1, ADM2, v(ADM2)), baja(C, ADM2, ADM1, v(ADM1))]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    const perdedora = (r.find((x) => x.status === 'rejected') as PromiseRejectedResult).reason;
    expect(perdedora).toBeInstanceOf(ConflictoDePersonasError);
    expect(perdedora.motivo).toMatch(/ultimo_administrador|version_vieja/);
    const quedan = await conTenant(
      owner(),
      C,
      async (trx) =>
        (await sql<{ n: number }>`select count(*)::int as n from usuario where rol = 'administrador_sig'`.execute(trx)).rows[0]!.n,
    );
    expect(quedan).toBe(1);
  });

  it('una solicitud vencida libera a la persona: la nueva es otra y la vieja queda «vencida»', async () => {
    const id = randomUUID();
    const hace8Dias = new Date(Date.now() - VIDA_SOLICITUD_MS - 24 * 3600 * 1000);
    const vieja = await solicitar(A, id, hace8Dias);
    const nueva = await solicitar(A, id);
    expect(nueva.nueva).toBe(true);
    expect(nueva.codigo).not.toBe(vieja.codigo);
    expect(await estados(A, id)).toEqual(['vencida', 'pendiente']);
    expect((await listar(A, ADMIN_A)).solicitudes.filter((x) => x.usuarioId === id)).toHaveLength(1);
  });
});
