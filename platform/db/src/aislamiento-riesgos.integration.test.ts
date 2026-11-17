import { crearEmpresaId } from "@sig/tenancy";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conTenant } from "./con-tenant";
import { leerUrls, ROLES_BD } from "./configuracion";
import { GestorPools } from "./pools";

// AISLAMIENTO ENTRE EMPRESAS (regla 2) de los riesgos y sus vínculos (Declaración justificada, ADR 037): con la sesión de A se
// intenta leer o tocar lo de B y debe fallar. Corre contra PostgreSQL real con el esquema migrado.
const A = crearEmpresaId("aaaaaaaa-0000-4000-8000-0000000000f1");
const B = crearEmpresaId("bbbbbbbb-0000-4000-8000-0000000000f2");
const UA = "a1a1a1a1-0000-4000-8000-0000000000f1";
const UB = "b1b1b1b1-0000-4000-8000-0000000000f2";
const CA = "ca000000-0000-4000-8000-0000000000f1";
const CB = "cb000000-0000-4000-8000-0000000000f2";
const RA = "ea000000-0000-4000-8000-0000000000f1";
const RB = "eb000000-0000-4000-8000-0000000000f2";

const hayBase =
  ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) &&
  !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)("aislamiento entre empresas: riesgos y vínculos (PostgreSQL real)", () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 5 });
  const app = () => pools.db("app");
  const owner = () => pools.db("owner");

  const sembrar = async (id: typeof A, slug: string, usuario: string, control: string, riesgo: string) => {
    await conTenant(owner(), id, async (trx) => {
      await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${slug}, ${"Empresa " + slug}, '#0E5C42') on conflict do nothing`.execute(trx);
      await sql`insert into usuario (id, empresa_id, nombre, correo) values (${usuario}, ${id}, ${"Persona " + slug}, ${slug + "@example.test"}) on conflict do nothing`.execute(trx);
      await sql`insert into control (id, empresa_id, codigo, nombre, creado_por, actualizado_por)
        values (${control}, ${id}, 'C-001', ${"Control de " + slug}, ${usuario}, ${usuario}) on conflict do nothing`.execute(trx);
      await sql`insert into riesgo (id, empresa_id, numero, titulo, probabilidad, impacto, decision, creado_por, actualizado_por)
        values (${riesgo}, ${id}, 1, ${"Riesgo de " + slug}, 3, 4, 'mitigar', ${usuario}, ${usuario}) on conflict do nothing`.execute(trx);
      await sql`insert into riesgo_control (empresa_id, riesgo_id, control_id, creado_por) values (${id}, ${riesgo}, ${control}, ${usuario}) on conflict do nothing`.execute(trx);
      await sql`insert into riesgo_entrada (empresa_id, riesgo_id, libreria_codigo, id_estable, creado_por)
        values (${id}, ${riesgo}, 'iso-prueba', 'a27-5-1', ${usuario}) on conflict do nothing`.execute(trx);
    });
  };
  const limpiar = async (id: typeof A) => {
    await conTenant(owner(), id, async (trx) => {
      for (const t of ["riesgo_entrada", "riesgo_control", "riesgo", "control", "usuario"])
        await sql`delete from ${sql.table(t)} where empresa_id = ${id}`.execute(trx);
      await sql`delete from empresa where id = ${id}`.execute(trx);
    });
  };

  beforeAll(async () => {
    await limpiar(A);
    await limpiar(B);
    await sembrar(A, "rsg-a", UA, CA, RA);
    await sembrar(B, "rsg-b", UB, CB, RB);
  });
  afterAll(async () => {
    await limpiar(A);
    await limpiar(B);
    await pools.cerrar();
  });

  for (const [tabla, columna, valor, insertar] of [
    ["riesgo", "titulo", "x", sql`insert into riesgo (empresa_id, numero, titulo, probabilidad, impacto, decision, creado_por, actualizado_por) values (${B}, 99, 'intruso', 1, 1, 'evitar', ${UB}, ${UB})`],
    ["riesgo_control", "control_id", CA, sql`insert into riesgo_control (empresa_id, riesgo_id, control_id, creado_por) values (${B}, ${RB}, ${CB}, ${UB})`],
    ["riesgo_entrada", "id_estable", "x-1", sql`insert into riesgo_entrada (empresa_id, riesgo_id, libreria_codigo, id_estable, creado_por) values (${B}, ${RB}, 'iso-prueba', 'a27-9-9', ${UB})`],
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
      it("A no puede modificar lo de B", async () => {
        const actualizar = (trx: Parameters<Parameters<typeof conTenant>[2]>[0]) =>
          sql`update ${sql.table(tabla)} set ${sql.ref(columna)} = ${valor} where empresa_id = ${B}`.execute(trx);
        if (tabla === "riesgo") {
          const r = await conTenant(app(), A, actualizar);
          expect(r.numAffectedRows ?? 0n).toBe(0n); // la RLS no deja ver las filas de B
        } else {
          await expect(conTenant(app(), A, actualizar)).rejects.toThrow(); // sin UPDATE para la aplicación
        }
        const visto = await conTenant(app(), B, (trx) => sql<{ v: string }>`select ${sql.ref(columna)}::text as v from ${sql.table(tabla)}`.execute(trx));
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

  it("A no puede borrar vínculos de B (la RLS no los deja ver)", async () => {
    for (const t of ["riesgo_control", "riesgo_entrada"]) {
      const r = await conTenant(app(), A, (trx) => sql`delete from ${sql.table(t)} where empresa_id = ${B}`.execute(trx));
      expect(r.numAffectedRows ?? 0n).toBe(0n);
      const quedan = await conTenant(app(), B, (trx) => sql`select 1 from ${sql.table(t)}`.execute(trx));
      expect(quedan.rows).toHaveLength(1);
    }
  });

  it("un vínculo de A no puede apuntar a un riesgo ni a un control de B (clave foránea compuesta)", async () => {
    await expect(
      conTenant(owner(), A, (trx) => sql`insert into riesgo_control (empresa_id, riesgo_id, control_id, creado_por) values (${A}, ${RB}, ${CA}, ${UA})`.execute(trx)),
    ).rejects.toThrow();
    await expect(
      conTenant(owner(), A, (trx) => sql`insert into riesgo_control (empresa_id, riesgo_id, control_id, creado_por) values (${A}, ${RA}, ${CB}, ${UA})`.execute(trx)),
    ).rejects.toThrow();
    await expect(
      conTenant(owner(), A, (trx) => sql`insert into riesgo_entrada (empresa_id, riesgo_id, libreria_codigo, id_estable, creado_por) values (${A}, ${RB}, 'iso-prueba', 'a27-5-2', ${UA})`.execute(trx)),
    ).rejects.toThrow();
  });

  it("un riesgo de A no puede tener de responsable ni de autora a una persona de B", async () => {
    for (const [resp, aut] of [[null, UB], [UB, UA]] as const)
      await expect(
        conTenant(owner(), A, (trx) =>
          sql`insert into riesgo (empresa_id, numero, titulo, probabilidad, impacto, decision, responsable_id, creado_por, actualizado_por)
            values (${A}, 50, 'x', 1, 1, 'mitigar', ${resp}, ${aut}, ${aut})`.execute(trx),
        ),
      ).rejects.toThrow();
  });

  it("el número es único por empresa, el código se deriva y dos empresas pueden usar el mismo", async () => {
    await expect(
      conTenant(owner(), A, (trx) =>
        sql`insert into riesgo (empresa_id, numero, titulo, probabilidad, impacto, decision, creado_por, actualizado_por) values (${A}, 1, 'repetido', 1, 1, 'evitar', ${UA}, ${UA})`.execute(trx),
      ),
    ).rejects.toThrow();
    const ambos = await Promise.all([A, B].map((e) => conTenant(app(), e, (trx) => sql<{ codigo: string }>`select codigo from riesgo`.execute(trx))));
    expect(ambos.map((r) => r.rows[0]?.codigo)).toEqual(["R-001", "R-001"]);
  });

  it("la aplicación no puede borrar riesgos (se retiran), pero sí quitar vínculos propios", async () => {
    await expect(conTenant(app(), A, (trx) => sql`delete from riesgo where empresa_id = ${A}`.execute(trx))).rejects.toThrow();
    const r = await conTenant(app(), A, (trx) => sql`delete from riesgo_control where empresa_id = ${A}`.execute(trx));
    expect(r.numAffectedRows ?? 0n).toBe(1n);
  });

  it("la escala, la decisión y el estado son de listas cerradas; aceptar exige responsable", async () => {
    const malos: Array<[number, number, string, string, string | null]> = [
      [0, 3, "mitigar", "vigente", null],
      [3, 6, "mitigar", "vigente", null],
      [3, 3, "ignorar", "vigente", null],
      [3, 3, "mitigar", "borrado", null],
      [3, 3, "aceptar", "vigente", null],
    ];
    for (const [p, i, d, e, resp] of malos)
      await expect(
        conTenant(owner(), A, (trx) =>
          sql`insert into riesgo (empresa_id, numero, titulo, probabilidad, impacto, decision, estado, responsable_id, creado_por, actualizado_por)
            values (${A}, 60, 'x', ${p}, ${i}, ${d}, ${e}, ${resp}, ${UA}, ${UA})`.execute(trx),
        ),
      ).rejects.toThrow();
    // Aceptar con responsable sí se guarda.
    await conTenant(owner(), A, async (trx) => {
      await sql`insert into riesgo (empresa_id, numero, titulo, probabilidad, impacto, decision, responsable_id, creado_por, actualizado_por)
        values (${A}, 61, 'aceptado', 2, 2, 'aceptar', ${UA}, ${UA}, ${UA})`.execute(trx);
      await sql`delete from riesgo where empresa_id = ${A} and numero = 61`.execute(trx);
    });
  });
});
