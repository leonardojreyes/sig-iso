import { crearEmpresaId } from "@sig/tenancy";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conTenant } from "./con-tenant";
import { leerUrls, ROLES_BD } from "./configuracion";
import { GestorPools } from "./pools";

// AISLAMIENTO ENTRE EMPRESAS (regla 2) del alcance y del diagnóstico (MVP, M2): con la sesión de A se intenta leer o tocar lo de B
// y debe fallar. Corre contra PostgreSQL real con el esquema migrado.
const A = crearEmpresaId("aaaaaaaa-0000-4000-8000-0000000000d1");
const B = crearEmpresaId("bbbbbbbb-0000-4000-8000-0000000000d2");
const UA = "a1a1a1a1-0000-4000-8000-0000000000d1";
const UB = "b1b1b1b1-0000-4000-8000-0000000000d2";
const LIB = "c0c0c0c0-0000-4000-8000-0000000000d3";

const hayBase =
  ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) &&
  !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)("aislamiento entre empresas: alcance y evaluaciones (PostgreSQL real)", () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 5 });
  const app = () => pools.db("app");
  const owner = () => pools.db("owner");

  const sembrar = async (id: typeof A, slug: string, usuario: string) => {
    await conTenant(owner(), id, async (trx) => {
      await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${slug}, ${"Empresa " + slug}, '#0E5C42') on conflict do nothing`.execute(trx);
      await sql`insert into usuario (id, empresa_id, nombre, correo) values (${usuario}, ${id}, ${"Persona " + slug}, ${slug + "@example.test"}) on conflict do nothing`.execute(trx);
      await sql`insert into alcance (empresa_id, norma, texto, actualizado_por) values (${id}, 'ISO/IEC 27001', ${"Alcance de " + slug}, ${usuario}) on conflict do nothing`.execute(trx);
      await sql`insert into evaluacion (empresa_id, libreria_codigo, id_estable, libreria_id, estado, comentario, actualizado_por)
                values (${id}, 'iso-prueba', 'a27-5-1', ${LIB}, 'parcial', ${"Comentario de " + slug}, ${usuario}) on conflict do nothing`.execute(trx);
    });
  };
  const limpiar = async (id: typeof A) => {
    await conTenant(owner(), id, async (trx) => {
      await sql`delete from evaluacion where empresa_id = ${id}`.execute(trx);
      await sql`delete from alcance where empresa_id = ${id}`.execute(trx);
      await sql`delete from usuario where empresa_id = ${id}`.execute(trx);
      await sql`delete from empresa where id = ${id}`.execute(trx);
    });
  };

  beforeAll(async () => {
    // La librería a la que apunta la evaluación (el catálogo es global; se inserta como dueño).
    await sql`delete from libreria where id = ${LIB}`.execute(owner()).catch(() => undefined);
    await limpiar(A);
    await limpiar(B);
    await conTenant(owner(), A, (trx) => sql`insert into libreria (id, codigo, nombre, version, hash, es_ejemplo, fuente) values (${LIB}, 'iso-prueba', 'Prueba', '1.0.0', ${"0".repeat(64)}, true, 'prueba') on conflict do nothing`.execute(trx));
    await sembrar(A, "dx-a", UA);
    await sembrar(B, "dx-b", UB);
  });
  afterAll(async () => {
    await limpiar(A);
    await limpiar(B);
    await conTenant(owner(), A, (trx) => sql`delete from libreria where id = ${LIB}`.execute(trx)).catch(() => undefined);
    await pools.cerrar();
  });

  for (const [tabla, columna] of [["alcance", "texto"], ["evaluacion", "comentario"]] as const) {
    describe(tabla, () => {
      it("A solo ve lo suyo", async () => {
        const r = await conTenant(app(), A, (trx) => sql<{ empresa_id: string }>`select empresa_id from ${sql.table(tabla)}`.execute(trx));
        expect(r.rows.map((f) => f.empresa_id)).toEqual([A]);
      });
      it("A no puede leer lo de B ni pidiéndolo por su empresa", async () => {
        const r = await conTenant(app(), A, (trx) => sql`select 1 from ${sql.table(tabla)} where empresa_id = ${B}`.execute(trx));
        expect(r.rows).toEqual([]);
      });
      it("A no puede escribir en nombre de B", async () => {
        await expect(
          conTenant(app(), A, (trx) => sql`update ${sql.table(tabla)} set ${sql.ref(columna)} = 'x' where empresa_id = ${B}`.execute(trx).then((r) => { if ((r.numAffectedRows ?? 0n) > 0n) throw new Error("modificó datos de otra empresa"); })),
        ).resolves.toBeUndefined();
        const visto = await conTenant(app(), B, (trx) => sql<{ v: string }>`select ${sql.ref(columna)} as v from ${sql.table(tabla)}`.execute(trx));
        expect(visto.rows[0]?.v).not.toBe("x");
      });
      it("sin empresa en el contexto no se lee nada (falla)", async () => {
        await expect(app().selectFrom(tabla as never).selectAll().execute()).rejects.toThrow();
      });
    });
  }

  it("una evaluación de A no puede apuntar a una persona de B (clave foránea compuesta)", async () => {
    await expect(
      conTenant(owner(), A, (trx) => sql`insert into evaluacion (empresa_id, libreria_codigo, id_estable, libreria_id, estado, actualizado_por)
        values (${A}, 'iso-prueba', 'a27-5-2', ${LIB}, 'cumple', ${UB})`.execute(trx)),
    ).rejects.toThrow();
  });

  it("la aplicación no puede borrar evaluaciones ni alcances (no hay desaparición silenciosa)", async () => {
    await expect(conTenant(app(), A, (trx) => sql`delete from evaluacion where empresa_id = ${A}`.execute(trx))).rejects.toThrow();
    await expect(conTenant(app(), A, (trx) => sql`delete from alcance where empresa_id = ${A}`.execute(trx))).rejects.toThrow();
  });

  it("el estado de una evaluación es de una lista cerrada", async () => {
    await expect(
      conTenant(owner(), A, (trx) => sql`insert into evaluacion (empresa_id, libreria_codigo, id_estable, libreria_id, estado, actualizado_por)
        values (${A}, 'iso-prueba', 'a27-5-3', ${LIB}, 'quizas', ${UA})`.execute(trx)),
    ).rejects.toThrow();
  });
});
