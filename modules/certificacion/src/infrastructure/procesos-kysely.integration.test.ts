import { conTenant, GestorPools, leerUrls, ROLES_BD } from '@sig/db';
import { crearEmpresaId } from '@sig/tenancy';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AutorizacionPort } from '../application/autorizacion.port.js';
import { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError } from '../application/errores.js';
import {
  ActualizarProcesoUseCase,
  AgregarRelacionUseCase,
  CrearGestionSigUseCase,
  CrearProcesoUseCase,
  ListarProcesosUseCase,
  ListarRelacionesUseCase,
  QuitarRelacionUseCase,
  RetirarProcesoUseCase,
} from '../application/procesos.use-cases.js';
import { crearUnidadDeTrabajoCertificacion } from './unidad-de-trabajo-certificacion.js';

// Con PostgreSQL real: procesos y relaciones (ADR 040), correlativo, un solo transversal vigente, concurrencia, transacción única y
// aislamiento entre empresas (regla 2).
const A = crearEmpresaId('aaaaaaaa-0000-4000-8000-0000000000e1');
const B = crearEmpresaId('bbbbbbbb-0000-4000-8000-0000000000e2');
const ADMIN1 = 'a1a1a1a1-0000-4000-8000-0000000000e1';
const ADMIN2 = 'a2a2a2a2-0000-4000-8000-0000000000e1';
const COLAB = 'a3a3a3a3-0000-4000-8000-0000000000e1';
const BAJA = 'a4a4a4a4-0000-4000-8000-0000000000e1';
const UB = 'b1b1b1b1-0000-4000-8000-0000000000e2';

const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)('procesos de la auditoría interna sobre PostgreSQL real', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 8 });
  const owner = () => pools.db('owner');
  const permitir: AutorizacionPort = { puede: async () => true };
  let t = 0;
  const reloj = () => new Date(Date.UTC(2026, 10, 19, 15, 0, t++));
  const nuevoId = () => crypto.randomUUID();
  const u = () => crearUnidadDeTrabajoCertificacion(pools.db('app'));
  const casos = () => ({
    listar: new ListarProcesosUseCase(u(), permitir),
    crear: new CrearProcesoUseCase(u(), permitir, reloj, nuevoId),
    gestionSig: new CrearGestionSigUseCase(u(), permitir, reloj, nuevoId),
    actualizar: new ActualizarProcesoUseCase(u(), permitir, reloj),
    retirar: new RetirarProcesoUseCase(u(), permitir, reloj),
    relaciones: new ListarRelacionesUseCase(u(), permitir),
    agregar: new AgregarRelacionUseCase(u(), permitir, reloj),
    quitar: new QuitarRelacionUseCase(u(), permitir),
  });
  let c: ReturnType<typeof casos>;
  const admin = { empresaId: A, usuarioId: ADMIN1 };

  const limpiar = async (id: typeof A) => {
    await conTenant(owner(), id, async (trx) => {
      for (const tabla of ['persona_proceso', 'proceso']) await sql`delete from ${sql.table(tabla)} where empresa_id = ${id}`.execute(trx);
    });
  };
  const sembrar = async (id: typeof A, slug: string, personas: Array<[string, string | null, boolean]>) => {
    await conTenant(owner(), id, async (trx) => {
      await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${slug}, ${'Empresa ' + slug}, '#0E5C42') on conflict do nothing`.execute(
        trx,
      );
      for (const [uid, rol, baja] of personas)
        await sql`insert into usuario (id, empresa_id, nombre, correo, rol, baja_en) values (${uid}, ${id}, ${'Persona ' + uid.slice(0, 2)}, ${uid + '@example.test'}, ${rol}, ${baja ? new Date() : null}) on conflict do nothing`.execute(
          trx,
        );
    });
  };

  beforeAll(async () => {
    c = casos();
    await limpiar(A);
    await limpiar(B);
    await sembrar(A, 'procint-a', [
      [ADMIN1, 'administrador_sig', false],
      [ADMIN2, 'administrador_sig', false],
      [COLAB, 'colaborador', false],
      [BAJA, null, true],
    ]);
    await sembrar(B, 'procint-b', [[UB, 'administrador_sig', false]]);
  });
  afterAll(async () => {
    for (const id of [A, B]) {
      await limpiar(id);
      await conTenant(owner(), id, async (trx) => void (await sql`delete from usuario where empresa_id = ${id}`.execute(trx)));
      await conTenant(owner(), id, async (trx) => void (await sql`delete from empresa where id = ${id}`.execute(trx)));
    }
    await pools.cerrar();
  });

  it('crea con correlativo, deja la relación «dueña» y la lista cuenta personas y avisa de la dueña dada de baja', async () => {
    const p1 = await c.crear.ejecutar({ ...admin, nombre: 'Compras', duenaId: COLAB });
    const p2 = await c.crear.ejecutar({ ...admin, nombre: 'Ventas', duenaId: ADMIN1, importancia: 'alta', frecuencia: 'semestral' });
    expect([p1.codigo, p2.codigo]).toEqual(['PR-001', 'PR-002']);
    expect(p2).toMatchObject({ importancia: 'alta', frecuencia: 'semestral', personasRelacionadas: 1, version: 1 });
    // una dueña dada de baja después de la alta
    await conTenant(
      owner(),
      A,
      async (trx) =>
        void (await sql`update usuario set rol = null, baja_en = now() where id = ${COLAB} and empresa_id = ${A}`.execute(trx)),
    );
    const lista = await c.listar.ejecutar(admin);
    expect(lista.procesos.find((p) => p.id === p1.id)?.avisos).toEqual(['duena_inactiva']);
    await conTenant(
      owner(),
      A,
      async (trx) =>
        void (await sql`update usuario set rol = 'colaborador', baja_en = null where id = ${COLAB} and empresa_id = ${A}`.execute(trx)),
    );
  });

  it('una dueña dada de baja o de otra empresa se rechaza con 400', async () => {
    await expect(c.crear.ejecutar({ ...admin, nombre: 'X', duenaId: BAJA })).rejects.toThrow();
    await expect(c.crear.ejecutar({ ...admin, nombre: 'X', duenaId: UB })).rejects.toThrow();
  });

  it('un solo «Gestión del SIG» vigente: lo garantiza la base y, retirado, se puede crear otro', async () => {
    const g = await c.gestionSig.ejecutar(admin);
    expect(g).toMatchObject({ transversal: true, nombre: 'Gestión del SIG' });
    await expect(c.gestionSig.ejecutar({ ...admin, usuarioId: ADMIN2 })).rejects.toBeInstanceOf(ConflictoError);
    // aunque se saltara la aplicación, el índice único parcial lo impide
    await expect(
      conTenant(owner(), A, (trx) =>
        sql`insert into proceso (empresa_id, numero, nombre, duena_id, transversal, creado_por, actualizado_por) values (${A}, 90, 'otro', ${ADMIN1}, true, ${ADMIN1}, ${ADMIN1})`.execute(
          trx,
        ),
      ),
    ).rejects.toThrow();
    await c.retirar.ejecutar({ ...admin, id: g.id });
    expect((await c.gestionSig.ejecutar({ ...admin, usuarioId: ADMIN2 })).transversal).toBe(true);
  });

  it('dos cambios a la vez con la misma versión: uno gana y el otro es conflicto', async () => {
    const p = await c.crear.ejecutar({ ...admin, nombre: 'Carrera', duenaId: ADMIN1 });
    const r = await Promise.allSettled([
      c.actualizar.ejecutar({ ...admin, id: p.id, versionEsperada: 1, nombre: 'Uno' }),
      c.actualizar.ejecutar({ ...admin, id: p.id, versionEsperada: 1, nombre: 'Dos' }),
    ]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    const perdedor = r.find((x) => x.status === 'rejected') as PromiseRejectedResult;
    expect(perdedor.reason).toBeInstanceOf(ConflictoDeVersionError);
  });

  it('relaciones: idempotentes, con tope por proceso y sin quitar a la dueña vigente', async () => {
    const p = await c.crear.ejecutar({ ...admin, nombre: 'Relaciones', duenaId: ADMIN1 });
    expect((await c.agregar.ejecutar({ ...admin, id: p.id, personaId: COLAB, relacion: 'participa' })).creada).toBe(true);
    expect((await c.agregar.ejecutar({ ...admin, id: p.id, personaId: COLAB, relacion: 'participa' })).creada).toBe(false);
    expect(await c.relaciones.ejecutar({ ...admin, id: p.id })).toHaveLength(2);
    await expect(c.quitar.ejecutar({ ...admin, id: p.id, personaId: ADMIN1, relacion: 'duena' })).rejects.toBeInstanceOf(ConflictoError);
    await c.quitar.ejecutar({ ...admin, id: p.id, personaId: COLAB, relacion: 'participa' });
    expect(await c.relaciones.ejecutar({ ...admin, id: p.id })).toHaveLength(1);
  });

  it('cada hecho queda en la bitácora de la empresa, con el objeto exacto y sin textos', async () => {
    const r = await conTenant(owner(), A, (trx) =>
      sql<{
        accion: string;
        objeto: string | null;
      }>`select accion, objeto from bitacora where empresa_id = ${A} and accion in ('proceso.creado', 'relacion.creada', 'proceso.cambiado', 'proceso.retirado', 'relacion.eliminada')`.execute(
        trx,
      ),
    );
    expect(r.rows.length).toBeGreaterThan(5);
    for (const f of r.rows) expect(f.objeto).toMatch(/^(proceso|relacion):PR-[0-9]{3,6}$/);
    expect(JSON.stringify(r.rows)).not.toMatch(/Compras|Ventas|Carrera/);
  });

  it('aislamiento: lo de la empresa A no se ve, no se cambia y no se relaciona desde la B', async () => {
    const lista = await c.listar.ejecutar({ empresaId: B, usuarioId: UB });
    expect(lista.procesos).toEqual([]);
    const propia = (await c.listar.ejecutar(admin)).procesos[0]!;
    await expect(c.retirar.ejecutar({ empresaId: B, usuarioId: UB, id: propia.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(
      c.actualizar.ejecutar({ empresaId: B, usuarioId: UB, id: propia.id, versionEsperada: 1, nombre: 'x' }),
    ).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(
      c.agregar.ejecutar({ empresaId: B, usuarioId: UB, id: propia.id, personaId: UB, relacion: 'participa' }),
    ).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    // una persona de B no puede ser dueña de un proceso de A
    await expect(c.crear.ejecutar({ ...admin, nombre: 'Cruce', duenaId: UB })).rejects.toThrow();
  });

  it('si el registro en la bitácora falla, no queda ni el proceso ni la relación (una sola transacción)', async () => {
    const antes = (await c.listar.ejecutar(admin)).procesos.length;
    // un actor que no existe en la empresa hace fallar la clave foránea de la bitácora o del proceso: todo se revierte
    await expect(
      c.crear.ejecutar({ empresaId: A, usuarioId: '00000000-0000-4000-8000-0000000000ff', nombre: 'Huérfano', duenaId: ADMIN1 }),
    ).rejects.toThrow();
    expect((await c.listar.ejecutar(admin)).procesos).toHaveLength(antes);
  });
});
