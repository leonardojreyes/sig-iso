import { randomBytes, randomUUID } from 'node:crypto';
import { conTenant, GestorPools, leerUrls, ROLES_BD } from '@sig/db';
import { crearEmpresaId, EmpresaIdInvalidoError } from '@sig/tenancy';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EmpresaNoEncontradaError, ObtenerMarcaUseCase } from '../application/obtener-marca.use-case.js';
import { EmpresaKysely } from './empresa-kysely.adapter.js';

// AISLAMIENTO (integración, PostgreSQL real, dos empresas): A no obtiene la marca de B.
const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)('EmpresaKysely (PostgreSQL real)', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 4 });
  const owner = () => pools.db('owner');
  const repo = () => new EmpresaKysely(pools.db('app'));

  const A = crearEmpresaId(randomUUID());
  const B = crearEmpresaId(randomUUID());
  const SIN_FILA = crearEmpresaId(randomUUID());
  const sufijo = randomBytes(4).toString('hex');

  const sembrar = (id: typeof A, nombre: string, color: string, logo: string | null) =>
    conTenant(owner(), id, async (trx) => {
      await sql`insert into empresa (id, slug, nombre, color_primario, logo_url) values (${id}, ${`t-${sufijo}-${id.slice(0, 4)}`}, ${nombre}, ${color}, ${logo})`.execute(trx);
    });

  beforeAll(async () => {
    await sembrar(A, 'Alfa Aislamiento', '#0b5fff', 'https://cdn.alfa.ec/logo.png');
    await sembrar(B, 'Beta Aislamiento', '#ffe066', null);
  });

  afterAll(async () => {
    for (const id of [A, B]) await conTenant(owner(), id, (trx) => sql`delete from empresa where id = ${id}`.execute(trx));
    await pools.cerrar();
  });

  it('devuelve la fila de la propia empresa con los nombres del dominio', async () => {
    expect(await repo().obtenerPropia(A)).toEqual({ id: A, nombre: 'Alfa Aislamiento', colorPrimario: '#0b5fff', logoUrl: 'https://cdn.alfa.ec/logo.png' });
    expect(await repo().obtenerPropia(B)).toEqual({ id: B, nombre: 'Beta Aislamiento', colorPrimario: '#ffe066', logoUrl: null });
  });

  it('A no obtiene la marca de B: en contexto de A la fila de B no existe para la aplicación', async () => {
    const visibles = await conTenant(pools.db('app'), A, async (trx) => (await sql<{ id: string }>`select id from empresa`.execute(trx)).rows.map((f) => f.id));
    expect(visibles).toEqual([A]);
    const directo = await conTenant(pools.db('app'), A, async (trx) => (await sql`select id from empresa where id = ${B}`.execute(trx)).rows);
    expect(directo).toEqual([]);
  });

  it('una empresa sin fila da null en el repositorio y EmpresaNoEncontradaError en el caso de uso', async () => {
    expect(await repo().obtenerPropia(SIN_FILA)).toBeNull();
    await expect(new ObtenerMarcaUseCase(repo()).ejecutar(SIN_FILA)).rejects.toBeInstanceOf(EmpresaNoEncontradaError);
  });

  it('de extremo a extremo: la marca de A y la de B salen con sus reglas de dominio y sin datos de la otra', async () => {
    const caso = new ObtenerMarcaUseCase(repo());
    const deA = await caso.ejecutar(A);
    const deB = await caso.ejecutar(B);
    expect(deA).toMatchObject({ nombre: 'Alfa Aislamiento', ajustadoPorContraste: false, logoUrl: 'https://cdn.alfa.ec/logo.png' });
    expect(deB).toMatchObject({ nombre: 'Beta Aislamiento', ajustadoPorContraste: true, colorOriginal: '#ffe066', logoUrl: null });
    expect(JSON.stringify(deA)).not.toMatch(/Beta|ffe066/i);
    expect(JSON.stringify(deB)).not.toMatch(/Alfa|alfa\.ec|0b5fff/i);
  });

  it('un identificador inválido falla antes de tocar la base', async () => {
    await expect(repo().obtenerPropia('no-es-uuid' as never)).rejects.toBeInstanceOf(EmpresaIdInvalidoError);
  });

  it('la aplicación no puede modificar ni borrar empresas (la marca es de solo lectura)', async () => {
    await expect(conTenant(pools.db('app'), A, (trx) => sql`update empresa set nombre = 'x'`.execute(trx))).rejects.toThrow(/permission denied/i);
    await expect(conTenant(pools.db('app'), A, (trx) => sql`delete from empresa`.execute(trx))).rejects.toThrow(/permission denied/i);
  });

  it('el repositorio no sirve fuera de una transacción con empresa (sin contexto la consulta falla)', async () => {
    await expect(sql`select id from empresa`.execute(pools.db('app'))).rejects.toThrow(/app\.tenant_id/);
  });
});
