import { randomBytes, randomUUID } from 'node:crypto';
import { crearEmpresaId, EmpresaIdInvalidoError } from '@sig/tenancy';
import { sql, type Transaction } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { conTenant } from './con-tenant';
import { leerUrls, ROLES_BD } from './configuracion';
import { GestorPools } from './pools';
import { UnidadDeTrabajoKysely } from './unidad-de-trabajo';

// Unidad de trabajo: una transacción con empresa fijada; todo se confirma junto o se revierte junto (H4.10, H6.8).
const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)('UnidadDeTrabajoKysely (PostgreSQL real)', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 6 });
  const owner = () => pools.db('owner');
  const app = () => pools.db('app');
  const sufijo = randomBytes(4).toString('hex');
  const A = crearEmpresaId(randomUUID());
  const B = crearEmpresaId(randomUUID());
  const usuarios: string[] = [];

  interface Ctx { readonly trx: Transaction<unknown>; readonly veces: number }
  let creados = 0;
  const uow = () => new UnidadDeTrabajoKysely<Ctx>(app(), (trx) => ({ trx, veces: ++creados }));

  const nuevoUsuario = (empresa: typeof A, trx: Transaction<unknown>) => {
    const id = randomUUID();
    usuarios.push(id);
    return sql`insert into usuario (id, empresa_id, nombre, correo) values (${id}, ${empresa}, 'Persona de prueba', ${`${id}@example.test`})`.execute(trx).then(() => id);
  };
  const registrar = (empresa: typeof A, trx: Transaction<unknown>, traza: string) =>
    sql`insert into bitacora (empresa_id, actor_tipo, accion, resultado, trace_id) values (${empresa}, 'sistema', 'login.ok', 'ok', ${traza})`.execute(trx);
  const usuarioExiste = async (empresa: typeof A, id: string) =>
    (await conTenant(owner(), empresa, async (trx) => (await sql`select 1 from usuario where id = ${id}`.execute(trx)).rows)).length === 1;
  const trazas = async (traza: string) =>
    (await sql<{ n: string }>`select count(*)::text as n from bitacora where trace_id = ${traza}`.execute(owner())).rows[0]!.n;
  const traza = () => `uow-${randomBytes(6).toString('hex')}`;

  beforeAll(async () => {
    for (const [id, n] of [[A, 'a'], [B, 'b']] as const) {
      await conTenant(owner(), id, (trx) => sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${`uow-${sufijo}-${n}`}, ${`Empresa ${n}`}, '#0b5fff')`.execute(trx));
    }
  });

  afterAll(async () => {
    for (const id of usuarios) for (const e of [A, B]) await conTenant(owner(), e, (trx) => sql`delete from usuario where id = ${id}`.execute(trx));
    for (const e of [A, B]) await conTenant(owner(), e, (trx) => sql`delete from empresa where id = ${e}`.execute(trx));
    await pools.cerrar();
  });

  it('si todo sale bien confirma la acción y su registro de bitácora juntos', async () => {
    const t = traza();
    const id = await uow().ejecutar(A, async ({ trx }) => {
      const nuevo = await nuevoUsuario(A, trx);
      await registrar(A, trx, t);
      return nuevo;
    });
    expect(await usuarioExiste(A, id)).toBe(true);
    expect(await trazas(t)).toBe('1');
  });

  it('si la función falla DESPUÉS de escribir, se revierte todo y el error llega intacto', async () => {
    const t = traza();
    let id = '';
    const error = new Error('fallo a mitad de camino');
    const r = await uow().ejecutar(A, async ({ trx }) => {
      id = await nuevoUsuario(A, trx);
      await registrar(A, trx, t);
      throw error;
    }).catch((e: unknown) => e);
    expect(r).toBe(error);
    expect(await usuarioExiste(A, id)).toBe(false);
    expect(await trazas(t)).toBe('0');
  });

  it('si la bitácora no se puede escribir (RLS la rechaza), la acción no se completa', async () => {
    const t = traza();
    let id = '';
    await expect(
      uow().ejecutar(A, async ({ trx }) => {
        id = await nuevoUsuario(A, trx);
        await registrar(B, trx, t); // registro de OTRA empresa: la política lo rechaza
      }),
    ).rejects.toThrow(/row-level security|violates/i);
    expect(await usuarioExiste(A, id)).toBe(false);
    expect(await trazas(t)).toBe('0');
  });

  it('un error de la base a mitad de camino también revierte lo ya escrito', async () => {
    let id = '';
    await expect(
      uow().ejecutar(A, async ({ trx }) => {
        id = await nuevoUsuario(A, trx);
        await sql`insert into usuario (id, empresa_id, nombre, correo) values (${randomUUID()}, ${A}, '', 'x')`.execute(trx); // viola un check
      }),
    ).rejects.toThrow();
    expect(await usuarioExiste(A, id)).toBe(false);
  });

  it('fija la empresa en la transacción, y al terminar el pool no conserva ninguna', async () => {
    const dentro = await uow().ejecutar(A, async ({ trx }) => (await sql<{ t: string }>`select app_tenant_id()::text as t`.execute(trx)).rows[0]!.t);
    expect(dentro).toBe(A);
    await expect(sql`select app_tenant_id()`.execute(app())).rejects.toThrow(/app\.tenant_id/);
  });

  it('dos unidades concurrentes de empresas distintas no mezclan su contexto', async () => {
    const leer = (e: typeof A) => uow().ejecutar(e, async ({ trx }) => {
      await sql`select pg_sleep(0.05)`.execute(trx);
      return (await sql<{ t: string }>`select app_tenant_id()::text as t`.execute(trx)).rows[0]!.t;
    });
    const resultados = await Promise.all([leer(A), leer(B), leer(A), leer(B), leer(A), leer(B)]);
    expect(resultados).toEqual([A, B, A, B, A, B]);
  });

  it('entrega al constructor del contexto la transacción y la empresa fijada', async () => {
    const vistas: string[] = [];
    const u = new UnidadDeTrabajoKysely<Ctx>(app(), (trx, empresa) => { vistas.push(empresa); return { trx, veces: 0 }; });
    await u.ejecutar(A, async () => 1);
    await u.ejecutar(B, async () => 1);
    expect(vistas).toEqual([A, B]);
  });

  it('crea un contexto nuevo por ejecución, ligado a su transacción', async () => {
    const antes = creados;
    const a = await uow().ejecutar(A, async (c) => c.veces);
    const b = await uow().ejecutar(A, async (c) => c.veces);
    expect(creados).toBe(antes + 2);
    expect(b).toBe(a + 1);
  });

  it('rechaza un identificador de empresa inválido sin abrir transacción ni crear contexto', async () => {
    const antes = creados;
    await expect(uow().ejecutar('no-es-uuid' as never, async () => 1)).rejects.toBeInstanceOf(EmpresaIdInvalidoError);
    expect(creados).toBe(antes);
  });

  it('el contexto de una unidad terminada ya no sirve para escribir', async () => {
    const guardado = await uow().ejecutar(A, async (c) => c);
    await expect(nuevoUsuario(A, guardado.trx)).rejects.toThrow();
  });

  it('no admite unidades anidadas: la empresa no cambia dentro de una transacción', async () => {
    const dentro = new UnidadDeTrabajoKysely<Ctx>(app(), (trx) => ({ trx, veces: 0 }));
    await expect(
      dentro.ejecutar(A, async ({ trx }) => new UnidadDeTrabajoKysely<Ctx>(trx, (t) => ({ trx: t, veces: 0 })).ejecutar(B, async () => 1)),
    ).rejects.toThrow(/no se puede anidar/);
  });
});
