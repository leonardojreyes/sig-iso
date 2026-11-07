import { crearEmpresaId } from '@sig/tenancy';
import { randomBytes } from 'node:crypto';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { conTenant } from './con-tenant';
import { leerUrls, ROLES_BD } from './configuracion';
import { GestorPools } from './pools';

const A = crearEmpresaId('3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c');
const B = crearEmpresaId('0190a5b2-7c3e-7a1d-9f40-123456789abc');

const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)('conTenant (PostgreSQL real)', () => {
  const urls = hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {};
  // Un solo cliente en el pool: así se prueba que una conexión REUTILIZADA no arrastra la empresa anterior.
  const unico = new GestorPools(urls, { max: 1 });
  const variosClientes = new GestorPools(urls, { max: 10 });
  const owner = new GestorPools(urls, { max: 2 });
  // Nombre aleatorio y propio de esta prueba: la limpieza solo toca esa tabla.
  const tabla = `prueba_con_tenant_${randomBytes(4).toString('hex')}`;

  const leer = async (db: ReturnType<GestorPools['db']>) => {
    const r = await sql<{ v: string | null }>`select current_setting('app.tenant_id', true) as v`.execute(db);
    return r.rows[0]?.v ?? null;
  };

  beforeAll(async () => {
    // Tabla de apoyo SIN RLS, creada por el dueño, solo para probar la transacción.
    const db = owner.db('owner');
    await sql.raw(`create table public.${tabla} (id int primary key)`).execute(db);
    await sql.raw(`grant select, insert on public.${tabla} to sigiso_app`).execute(db);
  });

  afterAll(async () => {
    if (!tabla.startsWith('prueba_con_tenant_')) throw new Error('Limpieza rechazada: nombre inesperado');
    await sql.raw(`drop table if exists public.${tabla}`).execute(owner.db('owner'));
    await Promise.all([unico.cerrar(), variosClientes.cerrar(), owner.cerrar()]);
  });

  it('dentro de conTenant la empresa está fijada en la transacción', async () => {
    const visto = await conTenant(unico.db('app'), A, async (trx) => leer(trx));
    expect(visto).toBe(A);
  });

  it('devuelve el resultado de la función', async () => {
    expect(await conTenant(unico.db('app'), A, async () => 42)).toBe(42);
  });

  it('fuera de conTenant no hay empresa, ni siquiera en una conexión reutilizada', async () => {
    const db = unico.db('app');
    await conTenant(db, A, async () => 'usó A');
    // La misma conexión (pool de 1) ya definió el parámetro: debe quedar vacío, no en A.
    const despues = await leer(db);
    expect(despues === null || despues === '').toBe(true);
    expect(despues).not.toBe(A);
  });

  it('el tenant no se filtra entre usos consecutivos del mismo cliente del pool', async () => {
    const db = unico.db('app');
    expect(await conTenant(db, A, async (trx) => leer(trx))).toBe(A);
    expect(await conTenant(db, B, async (trx) => leer(trx))).toBe(B);
    const fuera = await leer(db);
    expect(fuera === null || fuera === '').toBe(true);
  });

  it('operaciones concurrentes de empresas distintas ven cada una la suya', async () => {
    const db = variosClientes.db('app');
    const tareas = Array.from({ length: 24 }, (_, i) => {
      const id = i % 2 === 0 ? A : B;
      return conTenant(db, id, async (trx) => {
        await sql`select pg_sleep(0.01)`.execute(trx);
        return { esperado: id, visto: await leer(trx) };
      });
    });
    for (const r of await Promise.all(tareas)) expect(r.visto).toBe(r.esperado);
  });

  it('si la función falla, se revierte todo y la empresa no queda fijada', async () => {
    const db = unico.db('app');
    await expect(
      conTenant(db, A, async (trx) => {
        await sql.raw(`insert into public.${tabla} (id) values (1)`).execute(trx);
        throw new Error('falla a propósito');
      }),
    ).rejects.toThrow('falla a propósito');

    const filas = await sql<{ n: number }>`select count(*)::int as n from ${sql.table(tabla)}`.execute(db);
    expect(filas.rows[0]?.n).toBe(0);
    const fuera = await leer(db);
    expect(fuera === null || fuera === '').toBe(true);
  });

  it('si la función termina bien, confirma los cambios', async () => {
    await conTenant(unico.db('app'), A, async (trx) => {
      await sql.raw(`insert into public.${tabla} (id) values (2)`).execute(trx);
    });
    const filas = await sql<{ n: number }>`select count(*)::int as n from ${sql.table(tabla)} where id = 2`.execute(unico.db('app'));
    expect(filas.rows[0]?.n).toBe(1);
  });

  it('no deja anidar un segundo conTenant con otra empresa', async () => {
    await expect(conTenant(unico.db('app'), A, async (trx) => conTenant(trx, B, async () => 1))).rejects.toThrow(/anidar/);
  });
});
