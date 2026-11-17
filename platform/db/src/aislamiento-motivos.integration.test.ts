import { crearEmpresaId } from "@sig/tenancy";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conTenant } from "./con-tenant";
import { leerUrls, ROLES_BD } from "./configuracion";
import { GestorPools } from "./pools";

// AISLAMIENTO ENTRE EMPRESAS (regla 2) de los motivos de inclusión y las referencias al tratamiento (ADR 037): con la sesión de A se
// intenta leer o tocar lo de B y debe fallar. Corre contra PostgreSQL real con el esquema migrado.
const A = crearEmpresaId("aaaaaaaa-0000-4000-8000-0000000000f3");
const B = crearEmpresaId("bbbbbbbb-0000-4000-8000-0000000000f4");
const UA = "a1a1a1a1-0000-4000-8000-0000000000f3";
const UB = "b1b1b1b1-0000-4000-8000-0000000000f4";

const hayBase =
  ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) &&
  !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)("aislamiento entre empresas: motivos y referencias (PostgreSQL real)", () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 5 });
  const app = () => pools.db("app");
  const owner = () => pools.db("owner");

  const sembrar = async (id: typeof A, slug: string, usuario: string) => {
    await conTenant(owner(), id, async (trx) => {
      await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${slug}, ${"Empresa " + slug}, '#0E5C42') on conflict do nothing`.execute(trx);
      await sql`insert into usuario (id, empresa_id, nombre, correo) values (${usuario}, ${id}, ${"Persona " + slug}, ${slug + "@example.test"}) on conflict do nothing`.execute(trx);
      await sql`insert into motivo_inclusion (empresa_id, libreria_codigo, id_estable, tipo, nota, creado_por, actualizado_por)
        values (${id}, 'iso-prueba', 'a27-5-1', 'legal', ${"Nota de " + slug}, ${usuario}, ${usuario}) on conflict do nothing`.execute(trx);
      await sql`insert into referencia_tratamiento (empresa_id, norma, tipo, titulo, version_doc, fecha, ubicacion, actualizado_por)
        values (${id}, 'iso-27001', 'plan', ${"Plan de " + slug}, '1.0', '2026-11-01', 'Carpeta SIG', ${usuario}) on conflict do nothing`.execute(trx);
    });
  };
  const limpiar = async (id: typeof A) => {
    await conTenant(owner(), id, async (trx) => {
      for (const t of ["motivo_inclusion", "referencia_tratamiento", "usuario"]) await sql`delete from ${sql.table(t)} where empresa_id = ${id}`.execute(trx);
      await sql`delete from empresa where id = ${id}`.execute(trx);
    });
  };

  beforeAll(async () => {
    await limpiar(A);
    await limpiar(B);
    await sembrar(A, "mot-a", UA);
    await sembrar(B, "mot-b", UB);
  });
  afterAll(async () => {
    await limpiar(A);
    await limpiar(B);
    await pools.cerrar();
  });

  for (const [tabla, columna, valor, insertar] of [
    ["motivo_inclusion", "nota", "x", sql`insert into motivo_inclusion (empresa_id, libreria_codigo, id_estable, tipo, nota, creado_por, actualizado_por) values (${B}, 'iso-prueba', 'a27-9-9', 'otro', 'intruso', ${UB}, ${UB})`],
    ["referencia_tratamiento", "titulo", "x", sql`insert into referencia_tratamiento (empresa_id, norma, tipo, titulo, version_doc, fecha, ubicacion, actualizado_por) values (${B}, 'iso-27001', 'analisis', 'intruso', '1', '2026-11-01', 'x', ${UB})`],
  ] as const) {
    describe(tabla, () => {
      it("A solo ve lo suyo", async () => {
        const r = await conTenant(app(), A, (trx) => sql<{ empresa_id: string }>`select empresa_id from ${sql.table(tabla)}`.execute(trx));
        expect(r.rows.map((f) => f.empresa_id)).toEqual([A]);
      });
      it("A no puede leer lo de B ni pidiéndolo por su empresa", async () => {
        const r = await conTenant(app(), A, (trx) => sql`select 1 from ${sql.table(tabla)} where empresa_id = ${B}`.execute(trx));
        expect(r.rows).toEqual([]);
      });
      it("A no puede modificar ni borrar lo de B (la RLS no lo deja ver)", async () => {
        const m = await conTenant(app(), A, (trx) => sql`update ${sql.table(tabla)} set ${sql.ref(columna)} = ${valor} where empresa_id = ${B}`.execute(trx));
        expect(m.numAffectedRows ?? 0n).toBe(0n);
        const d = await conTenant(app(), A, (trx) => sql`delete from ${sql.table(tabla)} where empresa_id = ${B}`.execute(trx));
        expect(d.numAffectedRows ?? 0n).toBe(0n);
        const visto = await conTenant(app(), B, (trx) => sql<{ v: string }>`select ${sql.ref(columna)} as v from ${sql.table(tabla)}`.execute(trx));
        expect(visto.rows).toHaveLength(1);
        expect(visto.rows[0]?.v).not.toBe(valor);
      });
      it("A no puede insertar en nombre de B", async () => {
        await expect(conTenant(app(), A, (trx) => insertar.execute(trx))).rejects.toThrow();
      });
      it("sin empresa en el contexto no se lee nada (falla)", async () => {
        await expect(
          app()
            .selectFrom(tabla as never)
            .selectAll()
            .execute(),
        ).rejects.toThrow();
      });
    });
  }

  it("una fila de A no puede tener de autora a una persona de B", async () => {
    await expect(
      conTenant(owner(), A, (trx) =>
        sql`insert into motivo_inclusion (empresa_id, libreria_codigo, id_estable, tipo, nota, creado_por, actualizado_por) values (${A}, 'iso-prueba', 'a27-5-2', 'otro', 'x', ${UB}, ${UB})`.execute(trx),
      ),
    ).rejects.toThrow();
    await expect(
      conTenant(owner(), A, (trx) =>
        sql`insert into referencia_tratamiento (empresa_id, norma, tipo, titulo, version_doc, fecha, ubicacion, actualizado_por) values (${A}, 'iso-27001', 'analisis', 'x', '1', '2026-11-01', 'x', ${UB})`.execute(trx),
      ),
    ).rejects.toThrow();
  });

  it("no se repite el mismo tipo de motivo ni de referencia, pero dos empresas pueden tener el mismo", async () => {
    await expect(
      conTenant(owner(), A, (trx) =>
        sql`insert into motivo_inclusion (empresa_id, libreria_codigo, id_estable, tipo, nota, creado_por, actualizado_por) values (${A}, 'iso-prueba', 'a27-5-1', 'legal', 'otra', ${UA}, ${UA})`.execute(trx),
      ),
    ).rejects.toThrow();
    await expect(
      conTenant(owner(), A, (trx) =>
        sql`insert into referencia_tratamiento (empresa_id, norma, tipo, titulo, version_doc, fecha, ubicacion, actualizado_por) values (${A}, 'iso-27001', 'plan', 'otro', '2', '2026-11-02', 'y', ${UA})`.execute(trx),
      ),
    ).rejects.toThrow();
    const ambos = await Promise.all([A, B].map((e) => conTenant(app(), e, (trx) => sql`select 1 from motivo_inclusion`.execute(trx))));
    expect(ambos.map((r) => r.rows.length)).toEqual([1, 1]);
  });

  it("la lista de tipos es cerrada y la nota es obligatoria (no vale en blanco)", async () => {
    for (const [tipo, nota] of [["riesgo", "x"], ["legal", ""], ["legal", "   "], ["legal", "x".repeat(501)]] as const)
      await expect(
        conTenant(owner(), A, (trx) =>
          sql`insert into motivo_inclusion (empresa_id, libreria_codigo, id_estable, tipo, nota, creado_por, actualizado_por) values (${A}, 'iso-prueba', 'a27-7-7', ${tipo}, ${nota}, ${UA}, ${UA})`.execute(trx),
        ),
      ).rejects.toThrow();
    for (const [tipo, titulo, ubic] of [["otro", "x", "x"], ["plan", "", "x"], ["plan", "x", "  "]] as const)
      await expect(
        conTenant(owner(), A, (trx) =>
          sql`insert into referencia_tratamiento (empresa_id, norma, tipo, titulo, version_doc, fecha, ubicacion, actualizado_por) values (${A}, 'iso-27001', ${tipo}, ${titulo}, '1', '2026-11-01', ${ubic}, ${UA})`.execute(trx),
        ),
      ).rejects.toThrow();
  });

  it("la aplicación sí puede cambiar y quitar lo propio", async () => {
    const m = await conTenant(app(), A, (trx) => sql`update motivo_inclusion set nota = 'ajustada', version = version + 1 where empresa_id = ${A}`.execute(trx));
    expect(m.numAffectedRows ?? 0n).toBe(1n);
    const d = await conTenant(app(), A, (trx) => sql`delete from referencia_tratamiento where empresa_id = ${A}`.execute(trx));
    expect(d.numAffectedRows ?? 0n).toBe(1n);
  });
});
