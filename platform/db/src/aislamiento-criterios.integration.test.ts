import { crearEmpresaId } from '@sig/tenancy';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { conTenant } from './con-tenant';
import { leerUrls, ROLES_BD } from './configuracion';
import { GestorPools } from './pools';

// AISLAMIENTO ENTRE EMPRESAS (regla 2) de los criterios de evaluación versionados (ADR 038): con la sesión de A se intenta leer o tocar lo de
// B y debe fallar; además la tabla es inmutable para la aplicación. Corre contra PostgreSQL real con el esquema migrado.
const A = crearEmpresaId('aaaaaaaa-0000-4000-8000-000000000014');
const B = crearEmpresaId('bbbbbbbb-0000-4000-8000-000000000015');
const UA = 'a1a1a1a1-0000-4000-8000-000000000014';
const UB = 'b1b1b1b1-0000-4000-8000-000000000015';

const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)('aislamiento entre empresas: criterios de evaluación (PostgreSQL real)', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 5 });
  const app = () => pools.db('app');
  const owner = () => pools.db('owner');

  const insertar = (empresa: typeof A, usuario: string, version: number, extra = '', nivel = 'medio') =>
    sql`insert into criterios_version (empresa_id, version, probabilidad_1, probabilidad_2, probabilidad_3, probabilidad_4, probabilidad_5,
        impacto_1, impacto_2, impacto_3, impacto_4, impacto_5, nivel_aceptacion, creado_por)
      values (${empresa}, ${version}, ${'Casi nunca' + extra}, 'Rara vez', 'A veces', 'Frecuente', 'Casi siempre', 'Sin efecto', 'Menor', 'Moderado', 'Grave', 'Crítico', ${nivel}, ${usuario})`;

  const sembrar = async (id: typeof A, slug: string, usuario: string) => {
    await conTenant(owner(), id, async (trx) => {
      await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${slug}, ${'Empresa ' + slug}, '#0E5C42') on conflict do nothing`.execute(trx);
      await sql`insert into usuario (id, empresa_id, nombre, correo) values (${usuario}, ${id}, ${'Persona ' + slug}, ${slug + '@example.test'}) on conflict do nothing`.execute(trx);
      await insertar(id, usuario, 1).execute(trx);
    });
  };
  const limpiar = async (id: typeof A) => {
    await conTenant(owner(), id, async (trx) => {
      for (const t of ['criterios_version', 'usuario']) await sql`delete from ${sql.table(t)} where empresa_id = ${id}`.execute(trx);
      await sql`delete from empresa where id = ${id}`.execute(trx);
    });
  };

  beforeAll(async () => {
    await limpiar(A);
    await limpiar(B);
    await sembrar(A, 'cri-a', UA);
    await sembrar(B, 'cri-b', UB);
  });
  afterAll(async () => {
    await limpiar(A);
    await limpiar(B);
    await pools.cerrar();
  });

  it('A solo ve lo suyo y no puede leer lo de B ni pidiéndolo por su empresa', async () => {
    const r = await conTenant(app(), A, (trx) => sql<{ empresa_id: string }>`select empresa_id from criterios_version`.execute(trx));
    expect(r.rows.map((f) => f.empresa_id)).toEqual([A]);
    expect((await conTenant(app(), A, (trx) => sql`select 1 from criterios_version where empresa_id = ${B}`.execute(trx))).rows).toEqual([]);
  });

  it('A no puede insertar en nombre de B ni apuntar a una persona de B', async () => {
    await expect(conTenant(app(), A, (trx) => insertar(B, UB, 2).execute(trx))).rejects.toThrow();
    await expect(conTenant(app(), A, (trx) => insertar(A, UB, 2).execute(trx))).rejects.toThrow(); // clave foránea compuesta
  });

  it('sin empresa en el contexto no se lee nada (falla)', async () => {
    await expect(app().selectFrom('criterios_version' as never).selectAll().execute()).rejects.toThrow();
  });

  it('es inmutable para la aplicación: ni UPDATE ni DELETE, ni de lo propio ni de lo ajeno', async () => {
    for (const e of [A, B]) {
      await expect(conTenant(app(), A, (trx) => sql`update criterios_version set nivel_aceptacion = 'critico' where empresa_id = ${e}`.execute(trx))).rejects.toThrow();
      await expect(conTenant(app(), A, (trx) => sql`delete from criterios_version where empresa_id = ${e}`.execute(trx))).rejects.toThrow();
    }
    const visto = await conTenant(owner(), B, (trx) => sql<{ n: string }>`select nivel_aceptacion as n from criterios_version`.execute(trx));
    expect(visto.rows[0]?.n).toBe('medio');
  });

  it('la versión es única por empresa, y dos empresas pueden tener la misma', async () => {
    await expect(conTenant(app(), A, (trx) => insertar(A, UA, 1).execute(trx))).rejects.toThrow();
    const nueva = await conTenant(app(), A, (trx) => insertar(A, UA, 2, ' v2', 'alto').execute(trx));
    expect(nueva.numAffectedRows ?? 0n).toBe(1n);
    const ambos = await Promise.all([A, B].map((e) => conTenant(app(), e, (trx) => sql<{ version: number }>`select version from criterios_version order by version`.execute(trx))));
    expect(ambos.map((r) => r.rows.map((f) => f.version))).toEqual([[1, 2], [1]]);
  });

  it('las listas cerradas y los largos se comprueban en la base', async () => {
    await expect(conTenant(owner(), A, (trx) => insertar(A, UA, 9, '', 'enorme').execute(trx))).rejects.toThrow();
    await expect(conTenant(owner(), A, (trx) => insertar(A, UA, 0).execute(trx))).rejects.toThrow();
    await expect(conTenant(owner(), A, (trx) => insertar(A, UA, 9, 'x'.repeat(201)).execute(trx))).rejects.toThrow();
    await expect(conTenant(owner(), A, (trx) => sql`insert into criterios_version (empresa_id, version, probabilidad_1, probabilidad_2, probabilidad_3, probabilidad_4, probabilidad_5, impacto_1, impacto_2, impacto_3, impacto_4, impacto_5, nivel_aceptacion, creado_por)
        values (${A}, 9, '   ', 'b', 'c', 'd', 'e', 'a', 'b', 'c', 'd', 'e', 'medio', ${UA})`.execute(trx))).rejects.toThrow(); // solo espacios
  });
});
