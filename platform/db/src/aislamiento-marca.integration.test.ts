import { randomUUID } from "node:crypto";
import { crearEmpresaId } from "@sig/tenancy";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conTenant } from "./con-tenant";
import { leerUrls, ROLES_BD } from "./configuracion";
import { GestorPools } from "./pools";

// AISLAMIENTO ENTRE EMPRESAS (regla 2) de la edición de la marca (MVP, M6b-2): con la sesión de A se intenta cambiar lo de B y no
// debe cambiar nada. La aplicación solo actualiza color y logo; no el nombre, el slug ni el identificador. PostgreSQL real.
const A = crearEmpresaId(randomUUID());
const B = crearEmpresaId(randomUUID());
const sufijo = randomUUID().slice(0, 6);

const hayBase =
  ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) &&
  !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)(
  "aislamiento entre empresas: edición de la marca (PostgreSQL real)",
  () => {
    const pools = new GestorPools(
      hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {},
      { max: 4 },
    );
    const app = () => pools.db("app");
    const owner = () => pools.db("owner");
    const marcaDe = (id: typeof A) =>
      conTenant(owner(), id, async (trx) =>
        (
          await sql<{
            color_primario: string;
            logo_url: string | null;
            nombre: string;
            slug: string;
          }>`select color_primario, logo_url, nombre, slug from empresa where id = ${id}`.execute(
            trx,
          )
        ).rows[0],
      );

    beforeAll(async () => {
      for (const [id, n] of [
        [A, "a"],
        [B, "b"],
      ] as const)
        await conTenant(owner(), id, (trx) =>
          sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${`mar-${n}-${sufijo}`}, ${`Empresa ${n}`}, '#0b5fff')`.execute(
            trx,
          ),
        );
    });
    afterAll(async () => {
      for (const id of [A, B])
        await conTenant(owner(), id, (trx) =>
          sql`delete from empresa where id = ${id}`.execute(trx),
        );
      await pools.cerrar();
    });

    it("A cambia el color y el logo de SU empresa", async () => {
      const r = await conTenant(app(), A, (trx) =>
        sql`update empresa set color_primario = '#112233', logo_url = 'https://cdn.example.test/a.png' where id = ${A}`.execute(
          trx,
        ),
      );
      expect(Number(r.numAffectedRows)).toBe(1);
      expect(await marcaDe(A)).toMatchObject({
        color_primario: "#112233",
        logo_url: "https://cdn.example.test/a.png",
      });
    });

    it("A no puede cambiar la marca de B (no afecta ninguna fila) y B queda intacta", async () => {
      const r = await conTenant(app(), A, (trx) =>
        sql`update empresa set color_primario = '#ff0000', logo_url = 'https://evil.example.test/x.png' where id = ${B}`.execute(
          trx,
        ),
      );
      expect(Number(r.numAffectedRows)).toBe(0);
      expect(await marcaDe(B)).toMatchObject({
        color_primario: "#0b5fff",
        logo_url: null,
      });
    });

    it("tampoco con una condición que abarque a todas las empresas", async () => {
      const r = await conTenant(app(), A, (trx) =>
        sql`update empresa set color_primario = '#00ff00'`.execute(trx),
      );
      expect(Number(r.numAffectedRows)).toBe(1); // solo la suya
      expect((await marcaDe(B))?.color_primario).toBe("#0b5fff");
    });

    it.each(["nombre", "slug", "id", "creada_en"])(
      "la aplicación no puede cambiar la columna %s",
      async (columna) => {
        const valor =
          columna === "id"
            ? sql`${randomUUID()}::uuid`
            : columna === "creada_en"
              ? sql`now()`
              : sql`'otro'`;
        await expect(
          conTenant(app(), A, (trx) =>
            sql`update empresa set ${sql.ref(columna)} = ${valor} where id = ${A}`.execute(
              trx,
            ),
          ),
        ).rejects.toThrow(/permission denied|permiso/i);
      },
    );

    it("no puede dejar a A en la marca de otra: trasladar la fila a otra empresa falla", async () => {
      await expect(
        conTenant(app(), A, (trx) =>
          sql`update empresa set id = ${B} where id = ${A}`.execute(trx),
        ),
      ).rejects.toThrow();
    });

    it.each([
      ["un color sin el formato #RRGGBB", "color_primario", "rojo"],
      ["un color de 3 dígitos", "color_primario", "#fff"],
      ["un logo con http", "logo_url", "http://inseguro.example.test/x.png"],
      ["un logo con otro esquema", "logo_url", "javascript:alert(1)"],
      ["un logo que no empieza por https ni por barra", "logo_url", "cdn.example.test/x.png"],
    ])("la base rechaza %s", async (_n, columna, valor) => {
      await expect(
        conTenant(app(), A, (trx) =>
          sql`update empresa set ${sql.ref(columna)} = ${valor} where id = ${A}`.execute(
            trx,
          ),
        ),
      ).rejects.toThrow(/check|violates/i);
    });

    it("sin empresa en el contexto no se actualiza nada (falla)", async () => {
      await expect(
        sql`update empresa set color_primario = '#000000'`.execute(app()),
      ).rejects.toThrow(/app\.tenant_id/);
    });

    it("el logo puede quitarse (nulo)", async () => {
      await conTenant(app(), A, (trx) =>
        sql`update empresa set logo_url = null where id = ${A}`.execute(trx),
      );
      expect((await marcaDe(A))?.logo_url).toBeNull();
    });
  },
);
