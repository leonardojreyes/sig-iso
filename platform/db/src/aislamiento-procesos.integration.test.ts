import { crearEmpresaId } from '@sig/tenancy';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { conTenant } from './con-tenant';
import { leerUrls, ROLES_BD } from './configuracion';
import { GestorPools } from './pools';

// AISLAMIENTO ENTRE EMPRESAS (regla 2) de los procesos de la auditoría interna (ADR 040): con la sesión de A se intenta leer o tocar
// lo de B y debe fallar. Corre contra PostgreSQL real con el esquema migrado.
const A = crearEmpresaId('aaaaaaaa-0000-4000-8000-0000000000f1');
const B = crearEmpresaId('bbbbbbbb-0000-4000-8000-0000000000f2');
const UA = 'a1a1a1a1-0000-4000-8000-0000000000f1';
const UB = 'b1b1b1b1-0000-4000-8000-0000000000f2';
const PA = 'ca000000-0000-4000-8000-0000000000f1';
const PB = 'cb000000-0000-4000-8000-0000000000f2';

const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)('aislamiento entre empresas: procesos de auditoría (PostgreSQL real)', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 5 });
  const app = () => pools.db('app');
  const owner = () => pools.db('owner');

  const sembrar = async (id: typeof A, slug: string, usuario: string, proceso: string) => {
    await conTenant(owner(), id, async (trx) => {
      await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${slug}, ${'Empresa ' + slug}, '#0E5C42') on conflict do nothing`.execute(
        trx,
      );
      await sql`insert into usuario (id, empresa_id, nombre, correo) values (${usuario}, ${id}, ${'Persona ' + slug}, ${slug + '@example.test'}) on conflict do nothing`.execute(
        trx,
      );
      await sql`insert into proceso (id, empresa_id, numero, nombre, duena_id, creado_por, actualizado_por)
        values (${proceso}, ${id}, 1, ${'Proceso de ' + slug}, ${usuario}, ${usuario}, ${usuario}) on conflict do nothing`.execute(trx);
      await sql`insert into persona_proceso (empresa_id, proceso_id, usuario_id, relacion, creado_por)
        values (${id}, ${proceso}, ${usuario}, 'duena', ${usuario}) on conflict do nothing`.execute(trx);
    });
  };
  const limpiar = async (id: typeof A) => {
    await conTenant(owner(), id, async (trx) => {
      for (const t of ['persona_proceso', 'proceso', 'usuario']) await sql`delete from ${sql.table(t)} where empresa_id = ${id}`.execute(trx);
      await sql`delete from empresa where id = ${id}`.execute(trx);
    });
  };

  beforeAll(async () => {
    await limpiar(A);
    await limpiar(B);
    await sembrar(A, 'proc-a', UA, PA);
    await sembrar(B, 'proc-b', UB, PB);
  });
  afterAll(async () => {
    await limpiar(A);
    await limpiar(B);
    await pools.cerrar();
  });

  // [tabla, columna actualizable (o null si la aplicación no actualiza), valor, inserción en nombre de B]
  const CASOS = [
    [
      'proceso',
      'nombre',
      'x',
      sql`insert into proceso (empresa_id, numero, nombre, duena_id, creado_por, actualizado_por) values (${B}, 9, 'intruso', ${UB}, ${UB}, ${UB})`,
    ],
    ['persona_proceso', null, null, sql`insert into persona_proceso (empresa_id, proceso_id, usuario_id, relacion, creado_por) values (${B}, ${PB}, ${UB}, 'participa', ${UB})`],
  ] as const;

  for (const [tabla, columna, valor, insertar] of CASOS) {
    describe(tabla, () => {
      it('A solo ve lo suyo', async () => {
        const r = await conTenant(app(), A, (trx) => sql<{ empresa_id: string }>`select empresa_id from ${sql.table(tabla)}`.execute(trx));
        expect(r.rows.map((f) => f.empresa_id)).toEqual([A]);
      });
      it('A no puede leer lo de B ni pidiéndolo por su empresa', async () => {
        const r = await conTenant(app(), A, (trx) => sql`select 1 from ${sql.table(tabla)} where empresa_id = ${B}`.execute(trx));
        expect(r.rows).toEqual([]);
      });
      it('A no puede modificar lo de B', async () => {
        if (columna === null) {
          await expect(
            conTenant(app(), A, (trx) => sql`update ${sql.table(tabla)} set creado_por = ${UA} where empresa_id = ${B}`.execute(trx)),
          ).rejects.toThrow(); // sin UPDATE
          return;
        }
        const r = await conTenant(app(), A, (trx) =>
          sql`update ${sql.table(tabla)} set ${sql.ref(columna)} = ${valor} where empresa_id = ${B}`.execute(trx),
        );
        expect(r.numAffectedRows ?? 0n).toBe(0n); // la RLS no deja ver las filas de B
        const visto = await conTenant(app(), B, (trx) =>
          sql<{ v: string | null }>`select ${sql.ref(columna)}::text as v from ${sql.table(tabla)}`.execute(trx),
        );
        expect(visto.rows[0]?.v).not.toBe(valor);
      });
      it('A no puede insertar en nombre de B', async () => {
        await expect(conTenant(app(), A, (trx) => insertar.execute(trx))).rejects.toThrow();
      });
      it('sin empresa en el contexto no se lee nada (falla)', async () => {
        await expect(
          app()
            .selectFrom(tabla as never)
            .selectAll()
            .execute(),
        ).rejects.toThrow();
      });
    });
  }

  it('A no puede borrar las relaciones de B (la RLS no las deja ver) ni borrar un proceso (sin DELETE)', async () => {
    const r = await conTenant(app(), A, (trx) => sql`delete from persona_proceso where empresa_id = ${B}`.execute(trx));
    expect(r.numAffectedRows ?? 0n).toBe(0n);
    const quedan = await conTenant(app(), B, (trx) => sql`select 1 from persona_proceso`.execute(trx));
    expect(quedan.rows).toHaveLength(1);
    await expect(conTenant(app(), A, (trx) => sql`delete from proceso where empresa_id = ${A}`.execute(trx))).rejects.toThrow();
  });

  it('un proceso o una relación de A no puede apuntar a una persona ni a un proceso de B (clave foránea compuesta)', async () => {
    const malas = [
      sql`insert into proceso (empresa_id, numero, nombre, duena_id, creado_por, actualizado_por) values (${A}, 8, 'x', ${UB}, ${UA}, ${UA})`,
      sql`insert into persona_proceso (empresa_id, proceso_id, usuario_id, relacion, creado_por) values (${A}, ${PA}, ${UB}, 'participa', ${UA})`,
      sql`insert into persona_proceso (empresa_id, proceso_id, usuario_id, relacion, creado_por) values (${A}, ${PB}, ${UA}, 'participa', ${UA})`,
    ];
    for (const m of malas) await expect(conTenant(owner(), A, (trx) => m.execute(trx))).rejects.toThrow();
  });

  it('el código se deriva del número, y solo puede haber un proceso transversal vigente por empresa', async () => {
    const r = await conTenant(app(), A, (trx) => sql<{ codigo: string }>`select codigo from proceso where id = ${PA}`.execute(trx));
    expect(r.rows[0]?.codigo).toBe('PR-001');
    await conTenant(app(), A, (trx) =>
      sql`insert into proceso (empresa_id, numero, nombre, duena_id, transversal, creado_por, actualizado_por) values (${A}, 2, 'Gestión del SIG', ${UA}, true, ${UA}, ${UA})`.execute(trx),
    );
    await expect(
      conTenant(app(), A, (trx) =>
        sql`insert into proceso (empresa_id, numero, nombre, duena_id, transversal, creado_por, actualizado_por) values (${A}, 3, 'Otra', ${UA}, true, ${UA}, ${UA})`.execute(trx),
      ),
    ).rejects.toThrow();
  });
});
