import { crearEmpresaId } from "@sig/tenancy";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conTenant } from "./con-tenant";
import { leerUrls, ROLES_BD } from "./configuracion";
import { GestorPools } from "./pools";

// AISLAMIENTO ENTRE EMPRESAS (regla 2) de las librerías propias (MVP, M6a): con la sesión de A se intenta ver, usar o escribir
// lo de B y debe fallar. El catálogo global sigue siendo de solo lectura para las empresas. PostgreSQL real.
const A = crearEmpresaId("aaaaaaaa-0000-4000-8000-0000000000f1");
const B = crearEmpresaId("bbbbbbbb-0000-4000-8000-0000000000f2");
const UA = "a1a1a1a1-0000-4000-8000-0000000000f1";
const UB = "b1b1b1b1-0000-4000-8000-0000000000f2";
const LA = "1a000000-0000-4000-8000-0000000000f1";
const LB = "1b000000-0000-4000-8000-0000000000f2";
const LG = "16000000-0000-4000-8000-0000000000f3";
const HASH = "a".repeat(64);

const hayBase =
  ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) &&
  !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)(
  "aislamiento entre empresas: librerías propias (PostgreSQL real)",
  () => {
    const pools = new GestorPools(
      hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {},
      { max: 5 },
    );
    const app = () => pools.db("app");
    const owner = () => pools.db("owner");
    const catalogo = () => pools.db("catalogo");

    const libreria = (
      db: ReturnType<typeof owner>,
      tenant: typeof A,
      c: Partial<{
        id: string;
        empresa: string | null;
        codigo: string;
        version: string;
        ejemplo: boolean;
      }> = {},
    ) => {
      const v = {
        id: crypto.randomUUID(),
        empresa: tenant as string | null,
        codigo: "propia-prueba",
        version: "1.0.0",
        ejemplo: false,
        ...c,
      };
      return conTenant(db, tenant, (trx) =>
        sql`insert into libreria (id, empresa_id, codigo, nombre, version, hash, es_ejemplo, fuente)
          values (${v.id}, ${v.empresa}, ${v.codigo}, 'Librería de prueba', ${v.version}, ${HASH}, ${v.ejemplo}, 'subida')`.execute(
          trx,
        ),
      );
    };
    const entrada = (
      db: ReturnType<typeof owner>,
      tenant: typeof A,
      lib: string,
      idEstable = "c.1",
    ) =>
      conTenant(db, tenant, (trx) =>
        sql`insert into libreria_entrada (libreria_id, id_estable, capitulo, nivel, titulo, guia, alcance_comun, orden)
          values (${lib}, ${idEstable}, 4, 1, 'Contexto', 'Guía propia de la empresa', 'comun', 1)`.execute(
          trx,
        ),
      );

    const limpiar = async (id: typeof A, usuario: string) => {
      await conTenant(owner(), id, async (trx) => {
        await sql`delete from empresa_libreria where empresa_id = ${id}`.execute(trx);
        await sql`delete from libreria_entrada_norma where libreria_id in (select id from libreria where empresa_id = ${id})`.execute(trx);
        await sql`delete from libreria_entrada where libreria_id in (select id from libreria where empresa_id = ${id})`.execute(trx);
        await sql`delete from libreria where empresa_id = ${id}`.execute(trx);
        await sql`delete from usuario where id = ${usuario}`.execute(trx);
        await sql`delete from empresa where id = ${id}`.execute(trx);
      });
    };
    const limpiarGlobal = async () => {
      await conTenant(owner(), A, async (trx) => {
        await sql`delete from libreria where id = ${LG}`.execute(trx);
      });
    };
    const sembrar = async (id: typeof A, slug: string, usuario: string, lib: string) => {
      await conTenant(owner(), id, async (trx) => {
        await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${slug}, ${"Empresa " + slug}, '#0E5C42') on conflict do nothing`.execute(trx);
        await sql`insert into usuario (id, empresa_id, nombre, correo) values (${usuario}, ${id}, ${"Persona " + slug}, ${slug + "@example.test"}) on conflict do nothing`.execute(trx);
      });
      await libreria(owner(), id, { id: lib });
      await entrada(owner(), id, lib);
    };

    beforeAll(async () => {
      await limpiarGlobal();
      await limpiar(A, UA);
      await limpiar(B, UB);
      await sembrar(A, "lib-a", UA, LA);
      await sembrar(B, "lib-b", UB, LB);
      await libreria(catalogo(), A, { id: LG, empresa: null, codigo: "prueba-global-f3" });
    });
    afterAll(async () => {
      await limpiar(A, UA);
      await limpiar(B, UB);
      await limpiarGlobal();
      await pools.cerrar();
    });

    it("A ve el catálogo global y lo suyo, no lo de B", async () => {
      const r = await conTenant(app(), A, (trx) =>
        sql<{ id: string }>`select id from libreria where id in (${LA}, ${LB}, ${LG})`.execute(trx),
      );
      expect(r.rows.map((f) => f.id).sort()).toEqual([LA, LG].sort());
    });
    it("A no ve la librería de B ni pidiéndola por su empresa", async () => {
      const r = await conTenant(app(), A, (trx) =>
        sql`select 1 from libreria where empresa_id = ${B}`.execute(trx),
      );
      expect(r.rows).toEqual([]);
    });
    it("A no ve las entradas de B (aunque las adoptara por error no podría)", async () => {
      const r = await conTenant(app(), A, (trx) =>
        sql`select 1 from libreria_entrada where libreria_id = ${LB}`.execute(trx),
      );
      expect(r.rows).toEqual([]);
    });
    it("A no puede adoptar la librería de B", async () => {
      await expect(
        conTenant(app(), A, (trx) =>
          sql`insert into empresa_libreria (empresa_id, libreria_id, adoptada_por) values (${A}, ${LB}, ${UA})`.execute(trx),
        ),
      ).rejects.toThrow();
    });
    it("A puede adoptar una librería suya y ve sus entradas", async () => {
      await conTenant(app(), A, (trx) =>
        sql`insert into empresa_libreria (empresa_id, libreria_id, adoptada_por) values (${A}, ${LA}, ${UA})`.execute(trx),
      );
      const r = await conTenant(app(), A, (trx) =>
        sql`select 1 from libreria_entrada where libreria_id = ${LA}`.execute(trx),
      );
      expect(r.rows.length).toBe(1);
    });
    it("A sube una librería suya con la sesión de la aplicación", async () => {
      await expect(
        libreria(app(), A, { codigo: "propia-nueva", version: "2.0.0" }),
      ).resolves.toBeDefined();
    });

    describe("lo que A no puede escribir", () => {
      it("una librería en nombre de B", async () => {
        await expect(
          conTenant(app(), A, (trx) =>
            sql`insert into libreria (empresa_id, codigo, nombre, version, hash, es_ejemplo, fuente) values (${B}, 'propia-intruso', 'x', '1.0.0', ${HASH}, false, 'subida')`.execute(trx),
          ),
        ).rejects.toThrow();
      });
      it("una librería global (sin empresa)", async () => {
        await expect(
          libreria(app(), A, { empresa: null, codigo: "global-intruso" }),
        ).rejects.toThrow();
      });
      it("una entrada en la librería de B", async () => {
        await expect(entrada(app(), A, LB, "c.9")).rejects.toThrow();
      });
      it("una entrada en una librería global", async () => {
        await expect(entrada(app(), A, LG, "c.9")).rejects.toThrow();
      });
      it("una norma de entrada en la librería de B", async () => {
        await expect(
          conTenant(app(), A, (trx) =>
            sql`insert into libreria_entrada_norma (entrada_id, libreria_id, norma, edicion, clausula)
              select id, libreria_id, 'ISO X', '2022', '4.1' from libreria_entrada where libreria_id = ${LB}`.execute(trx),
          ).then((r) => {
            if (!r.numAffectedRows) throw new Error("no hay filas visibles");
          }),
        ).rejects.toThrow();
      });
      it.each([
        ["actualizar", sql`update libreria set nombre = 'otro' where id = ${LA}`],
        ["borrar", sql`delete from libreria where id = ${LA}`],
      ])("%s una librería (ni la propia)", async (_n, consulta) => {
        await expect(
          conTenant(app(), A, (trx) => consulta.execute(trx)),
        ).rejects.toThrow();
      });
    });

    describe("el catálogo global", () => {
      it("el rol del catálogo no ve lo de las empresas", async () => {
        const r = await conTenant(catalogo(), A, (trx) =>
          sql`select 1 from libreria where empresa_id is not null`.execute(trx),
        );
        expect(r.rows).toEqual([]);
      });
      it("el rol del catálogo no puede cargar una librería de empresa", async () => {
        await expect(
          libreria(catalogo(), A, { codigo: "propia-desde-catalogo" }),
        ).rejects.toThrow();
      });
    });

    describe("reglas de la tabla", () => {
      it("una librería global no puede usar el prefijo reservado", async () => {
        await expect(
          libreria(owner(), A, { empresa: null, codigo: "propia-global" }),
        ).rejects.toThrow();
      });
      it.each([
        ["sin el prefijo propia-", { codigo: "sin-prefijo" }],
        ["con mayúsculas", { codigo: "propia-Mayus" }],
        ["de ejemplo", { codigo: "propia-ejemplo", ejemplo: true }],
      ])("una librería propia %s se rechaza", async (_n, cambio) => {
        await expect(libreria(owner(), A, cambio)).rejects.toThrow();
      });
      it("el código y la versión no se repiten dentro de la empresa, pero sí entre empresas", async () => {
        await expect(libreria(owner(), A)).rejects.toThrow(); // propia-prueba 1.0.0 ya existe en A
        await expect(libreria(owner(), B)).rejects.toThrow(); // ídem en B
        await expect(
          libreria(owner(), A, { codigo: "propia-prueba", version: "1.0.1" }),
        ).resolves.toBeDefined();
        await expect(
          libreria(owner(), B, { codigo: "propia-solo-b" }),
        ).resolves.toBeDefined();
        await expect(
          libreria(owner(), A, { codigo: "propia-solo-b" }),
        ).resolves.toBeDefined(); // el mismo código en otra empresa es otra librería
      });
    });
  },
);
