import { crearEmpresaId } from "@sig/tenancy";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conTenant } from "./con-tenant";
import { leerUrls, ROLES_BD } from "./configuracion";
import { GestorPools } from "./pools";

// AISLAMIENTO ENTRE EMPRESAS (regla 2) de los controles de la empresa y sus mapeos (MVP, M3): con la sesión de A se intenta leer
// o tocar lo de B y debe fallar. Corre contra PostgreSQL real con el esquema migrado.
const A = crearEmpresaId("aaaaaaaa-0000-4000-8000-0000000000e1");
const B = crearEmpresaId("bbbbbbbb-0000-4000-8000-0000000000e2");
const UA = "a1a1a1a1-0000-4000-8000-0000000000e1";
const UB = "b1b1b1b1-0000-4000-8000-0000000000e2";
const CA = "ca000000-0000-4000-8000-0000000000e1";
const CB = "cb000000-0000-4000-8000-0000000000e2";

const hayBase =
  ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) &&
  !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)(
  "aislamiento entre empresas: controles y mapeos (PostgreSQL real)",
  () => {
    const pools = new GestorPools(
      hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {},
      { max: 5 },
    );
    const app = () => pools.db("app");
    const owner = () => pools.db("owner");

    const sembrar = async (
      id: typeof A,
      slug: string,
      usuario: string,
      control: string,
    ) => {
      await conTenant(owner(), id, async (trx) => {
        await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${slug}, ${"Empresa " + slug}, '#0E5C42') on conflict do nothing`.execute(
          trx,
        );
        await sql`insert into usuario (id, empresa_id, nombre, correo) values (${usuario}, ${id}, ${"Persona " + slug}, ${slug + "@example.test"}) on conflict do nothing`.execute(
          trx,
        );
        await sql`insert into control (id, empresa_id, codigo, nombre, creado_por, actualizado_por)
                values (${control}, ${id}, 'C-001', ${"Control de " + slug}, ${usuario}, ${usuario}) on conflict do nothing`.execute(
          trx,
        );
        await sql`insert into control_mapeo (empresa_id, control_id, libreria_codigo, id_estable, creado_por)
                values (${id}, ${control}, 'iso-prueba', 'a27-5-1', ${usuario}) on conflict do nothing`.execute(
          trx,
        );
      });
    };
    const limpiar = async (id: typeof A) => {
      await conTenant(owner(), id, async (trx) => {
        await sql`delete from control_mapeo where empresa_id = ${id}`.execute(
          trx,
        );
        await sql`delete from control where empresa_id = ${id}`.execute(trx);
        await sql`delete from usuario where empresa_id = ${id}`.execute(trx);
        await sql`delete from empresa where id = ${id}`.execute(trx);
      });
    };

    beforeAll(async () => {
      await limpiar(A);
      await limpiar(B);
      await sembrar(A, "ctl-a", UA, CA);
      await sembrar(B, "ctl-b", UB, CB);
    });
    afterAll(async () => {
      await limpiar(A);
      await limpiar(B);
      await pools.cerrar();
    });

    for (const [tabla, columna, valor] of [
      ["control", "nombre", "x"],
      ["control_mapeo", "id_estable", "x-1"],
    ] as const) {
      describe(tabla, () => {
        it("A solo ve lo suyo", async () => {
          const r = await conTenant(app(), A, (trx) =>
            sql<{
              empresa_id: string;
            }>`select empresa_id from ${sql.table(tabla)}`.execute(trx),
          );
          expect(r.rows.map((f) => f.empresa_id)).toEqual([A]);
        });
        it("A no puede leer lo de B ni pidiéndolo por su empresa", async () => {
          const r = await conTenant(app(), A, (trx) =>
            sql`select 1 from ${sql.table(tabla)} where empresa_id = ${B}`.execute(
              trx,
            ),
          );
          expect(r.rows).toEqual([]);
        });
        it("A no puede modificar lo de B", async () => {
          const actualizar = (
            trx: Parameters<Parameters<typeof conTenant>[2]>[0],
          ) =>
            sql`update ${sql.table(tabla)} set ${sql.ref(columna)} = ${valor} where empresa_id = ${B}`.execute(
              trx,
            );
          if (tabla === "control_mapeo") {
            // La aplicación no tiene UPDATE sobre los mapeos: se rechaza (se quitan y se vuelven a crear).
            await expect(conTenant(app(), A, actualizar)).rejects.toThrow();
          } else {
            // La RLS no deja ver las filas de B: la sentencia no afecta ninguna.
            const r = await conTenant(app(), A, actualizar);
            expect(r.numAffectedRows ?? 0n).toBe(0n);
          }
          const visto = await conTenant(app(), B, (trx) =>
            sql<{
              v: string;
            }>`select ${sql.ref(columna)} as v from ${sql.table(tabla)}`.execute(
              trx,
            ),
          );
          expect(visto.rows[0]?.v).not.toBe(valor);
        });
        it("A no puede insertar en nombre de B", async () => {
          const dato =
            tabla === "control"
              ? sql`insert into control (empresa_id, codigo, nombre, creado_por, actualizado_por) values (${B}, 'C-999', 'intruso', ${UB}, ${UB})`
              : sql`insert into control_mapeo (empresa_id, control_id, libreria_codigo, id_estable, creado_por) values (${B}, ${CB}, 'iso-prueba', 'a27-9-9', ${UB})`;
          await expect(
            conTenant(app(), A, (trx) => dato.execute(trx)),
          ).rejects.toThrow();
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

    it("A no puede borrar un mapeo de B (la RLS no lo deja ver, no se borra ninguno)", async () => {
      const r = await conTenant(app(), A, (trx) =>
        sql`delete from control_mapeo where empresa_id = ${B}`.execute(trx),
      );
      expect(r.numAffectedRows ?? 0n).toBe(0n);
      const quedan = await conTenant(app(), B, (trx) =>
        sql`select 1 from control_mapeo`.execute(trx),
      );
      expect(quedan.rows).toHaveLength(1);
    });

    it("un mapeo de A no puede apuntar a un control de B (clave foránea compuesta)", async () => {
      await expect(
        conTenant(owner(), A, (trx) =>
          sql`insert into control_mapeo (empresa_id, control_id, libreria_codigo, id_estable, creado_por)
        values (${A}, ${CB}, 'iso-prueba', 'a27-5-2', ${UA})`.execute(trx),
        ),
      ).rejects.toThrow();
    });

    it("un control de A no puede tener de responsable ni de autora a una persona de B", async () => {
      await expect(
        conTenant(owner(), A, (trx) =>
          sql`insert into control (empresa_id, codigo, nombre, creado_por, actualizado_por)
        values (${A}, 'C-002', 'x', ${UB}, ${UB})`.execute(trx),
        ),
      ).rejects.toThrow();
      await expect(
        conTenant(owner(), A, (trx) =>
          sql`insert into control (empresa_id, codigo, nombre, responsable_id, creado_por, actualizado_por)
        values (${A}, 'C-003', 'x', ${UB}, ${UA}, ${UA})`.execute(trx),
        ),
      ).rejects.toThrow();
    });

    it("el código de un control es único por empresa, pero dos empresas pueden usar el mismo", async () => {
      await expect(
        conTenant(owner(), A, (trx) =>
          sql`insert into control (empresa_id, codigo, nombre, creado_por, actualizado_por)
        values (${A}, 'C-001', 'repetido', ${UA}, ${UA})`.execute(trx),
        ),
      ).rejects.toThrow();
      const ambos = await Promise.all(
        [A, B].map((e) =>
          conTenant(app(), e, (trx) =>
            sql<{ codigo: string }>`select codigo from control`.execute(trx),
          ),
        ),
      );
      expect(ambos.map((r) => r.rows[0]?.codigo)).toEqual(["C-001", "C-001"]);
    });

    it("un mismo mapeo no se puede repetir", async () => {
      await expect(
        conTenant(app(), A, (trx) =>
          sql`insert into control_mapeo (empresa_id, control_id, libreria_codigo, id_estable, creado_por)
        values (${A}, ${CA}, 'iso-prueba', 'a27-5-1', ${UA})`.execute(trx),
        ),
      ).rejects.toThrow();
    });

    it("la aplicación no puede borrar controles (se retiran), pero sí quitar mapeos propios", async () => {
      await expect(
        conTenant(app(), A, (trx) =>
          sql`delete from control where empresa_id = ${A}`.execute(trx),
        ),
      ).rejects.toThrow();
      const r = await conTenant(app(), A, (trx) =>
        sql`delete from control_mapeo where empresa_id = ${A}`.execute(trx),
      );
      expect(r.numAffectedRows ?? 0n).toBe(1n);
    });

    it("el estado de un control es de una lista cerrada y el código tiene forma válida", async () => {
      for (const [codigo, estado] of [
        ["C-010", "borrado"],
        ["con espacio", "vigente"],
        ["", "vigente"],
        ["x".repeat(21), "vigente"],
      ] as const) {
        await expect(
          conTenant(owner(), A, (trx) =>
            sql`insert into control (empresa_id, codigo, nombre, estado, creado_por, actualizado_por)
          values (${A}, ${codigo}, 'x', ${estado}, ${UA}, ${UA})`.execute(trx),
          ),
        ).rejects.toThrow();
      }
    });
  },
);
