import { crearEmpresaId } from "@sig/tenancy";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conTenant } from "./con-tenant";
import { leerUrls, ROLES_BD } from "./configuracion";
import { GestorPools } from "./pools";

// PRUEBA DE AISLAMIENTO ENTRE EMPRESAS (regla 2). Con la sesión de A se intenta leer o tocar datos de B: debe fallar.
// Corre contra PostgreSQL real con el esquema migrado (lo deja listo test/migrar-global.ts).
const A = crearEmpresaId("aaaaaaaa-0000-4000-8000-00000000000a");
const B = crearEmpresaId("bbbbbbbb-0000-4000-8000-00000000000b");
const USUARIO_A = "a1a1a1a1-0000-4000-8000-0000000000a1";
const USUARIO_B = "b1b1b1b1-0000-4000-8000-0000000000b1";

const hayBase =
  ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) &&
  !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)(
  "aislamiento entre empresas: empresa y usuario (PostgreSQL real)",
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
      nombre: string,
      usuario: string,
    ) => {
      await conTenant(owner(), id, async (trx) => {
        await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${slug}, ${nombre}, '#0E5C42') on conflict do nothing`.execute(
          trx,
        );
        await sql`insert into usuario (id, empresa_id, nombre, correo) values (${usuario}, ${id}, ${"Persona " + slug}, ${slug + "@example.test"}) on conflict do nothing`.execute(
          trx,
        );
      });
    };

    const limpiar = async (id: typeof A) => {
      await conTenant(owner(), id, async (trx) => {
        await sql`delete from usuario where empresa_id = ${id}`.execute(trx);
        await sql`delete from empresa where id = ${id}`.execute(trx);
      });
    };

    beforeAll(async () => {
      await limpiar(A);
      await limpiar(B);
      await sembrar(A, "prueba-a", "Empresa A de prueba", USUARIO_A);
      await sembrar(B, "prueba-b", "Empresa B de prueba", USUARIO_B);
    });

    afterAll(async () => {
      await limpiar(A);
      await limpiar(B);
      await pools.cerrar();
    });

    describe("lectura", () => {
      it("A, al listar empresas, solo ve la suya", async () => {
        const r = await conTenant(app(), A, (trx) =>
          sql<{ id: string }>`select id from empresa`.execute(trx),
        );
        expect(r.rows.map((f) => f.id)).toEqual([A]);
      });

      it("A no puede leer la empresa de B ni siquiera pidiéndola por su id", async () => {
        const r = await conTenant(app(), A, (trx) =>
          sql`select id from empresa where id = ${B}`.execute(trx),
        );
        expect(r.rows).toEqual([]);
      });

      it("A, al listar usuarios, solo ve los suyos", async () => {
        const r = await conTenant(app(), A, (trx) =>
          sql<{ id: string }>`select id from usuario`.execute(trx),
        );
        expect(r.rows.map((f) => f.id)).toEqual([USUARIO_A]);
      });

      it("A no puede leer un usuario de B por su id", async () => {
        const r = await conTenant(app(), A, (trx) =>
          sql`select id from usuario where id = ${USUARIO_B}`.execute(trx),
        );
        expect(r.rows).toEqual([]);
      });

      it("A no puede leer usuarios de B filtrando por la empresa de B", async () => {
        const r = await conTenant(app(), A, (trx) =>
          sql`select id from usuario where empresa_id = ${B}`.execute(trx),
        );
        expect(r.rows).toEqual([]);
      });

      it("B ve lo suyo y nada de A (simétrico)", async () => {
        const u = await conTenant(app(), B, (trx) =>
          sql<{ id: string }>`select id from usuario`.execute(trx),
        );
        expect(u.rows.map((f) => f.id)).toEqual([USUARIO_B]);
        const e = await conTenant(app(), B, (trx) =>
          sql`select id from empresa where id = ${A}`.execute(trx),
        );
        expect(e.rows).toEqual([]);
      });
    });

    describe("escritura", () => {
      it("A no puede crear un usuario dentro de la empresa B", async () => {
        await expect(
          conTenant(app(), A, (trx) =>
            sql`insert into usuario (id, empresa_id, nombre, correo) values (gen_random_uuid(), ${B}, 'Intruso', 'intruso@example.test')`.execute(
              trx,
            ),
          ),
        ).rejects.toThrow(/row-level security/i);
      });

      it("A no puede cambiar un usuario de B (la fila no es visible, no se modifica nada)", async () => {
        const r = await conTenant(app(), A, (trx) =>
          sql`update usuario set nombre = 'Hackeado' where id = ${USUARIO_B}`.execute(
            trx,
          ),
        );
        expect(Number(r.numAffectedRows ?? 0)).toBe(0);
        const vista = await conTenant(app(), B, (trx) =>
          sql<{
            nombre: string;
          }>`select nombre from usuario where id = ${USUARIO_B}`.execute(trx),
        );
        expect(vista.rows[0]?.nombre).not.toBe("Hackeado");
      });

      it("A no puede mover un usuario propio a la empresa B (la aplicación no puede cambiar empresa_id)", async () => {
        await expect(
          conTenant(app(), A, (trx) =>
            sql`update usuario set empresa_id = ${B} where id = ${USUARIO_A}`.execute(
              trx,
            ),
          ),
        ).rejects.toThrow(/permission denied/i);
      });

      it("aun con permiso de columna, la política de filas impide mover un usuario a otra empresa", async () => {
        // El dueño sí puede actualizar cualquier columna: aquí actúa la política WITH CHECK, no el permiso.
        await expect(
          conTenant(owner(), A, (trx) =>
            sql`update usuario set empresa_id = ${B} where id = ${USUARIO_A}`.execute(
              trx,
            ),
          ),
        ).rejects.toThrow(/row-level security/i);
      });

      it("la aplicación no puede borrar usuarios ni modificar empresas", async () => {
        await expect(
          conTenant(app(), A, (trx) =>
            sql`delete from usuario where id = ${USUARIO_A}`.execute(trx),
          ),
        ).rejects.toThrow(/permission denied/i);
        await expect(
          conTenant(app(), A, (trx) =>
            sql`update empresa set nombre = 'x' where id = ${A}`.execute(trx),
          ),
        ).rejects.toThrow(/permission denied/i);
        await expect(
          conTenant(app(), A, (trx) =>
            sql`insert into empresa (id, slug, nombre, color_primario) values (gen_random_uuid(), 'nueva', 'Nueva', '#000000')`.execute(
              trx,
            ),
          ),
        ).rejects.toThrow(/permission denied/i);
      });
    });

    describe("sin empresa o con empresa inválida: la consulta falla", () => {
      it("una consulta fuera de conTenant falla en lugar de devolver todo", async () => {
        await expect(sql`select * from usuario`.execute(app())).rejects.toThrow(
          /app\.tenant_id/,
        );
        await expect(sql`select * from empresa`.execute(app())).rejects.toThrow(
          /app\.tenant_id/,
        );
      });

      it("la restricción también aplica al dueño de las tablas (FORCE ROW LEVEL SECURITY)", async () => {
        await expect(
          sql`select * from usuario`.execute(owner()),
        ).rejects.toThrow(/app\.tenant_id/);
      });

      it.each([
        ["texto que no es UUID", "no-es-uuid"],
        ["cadena vacía", ""],
        ["UUID nulo", "00000000-0000-0000-0000-000000000000"],
        ["UUID con espacios", ` ${A} `],
        ["UUID en mayúsculas", A.toUpperCase()],
      ])(
        "un app.tenant_id inválido (%s) hace fallar la consulta",
        async (_nombre, valor) => {
          await expect(
            app()
              .transaction()
              .execute(async (trx) => {
                await sql`select set_config('app.tenant_id', ${valor}, true)`.execute(
                  trx,
                );
                return sql`select * from usuario`.execute(trx);
              }),
          ).rejects.toThrow(/app\.tenant_id/);
        },
      );

      it("la función que lee la empresa no es ejecutable por PUBLIC", async () => {
        const r = await sql<{
          publico: boolean;
        }>`select has_function_privilege('public', 'app_tenant_id()', 'EXECUTE') as publico`.execute(
          owner(),
        );
        expect(r.rows[0]?.publico).toBe(false);
      });
    });

    describe("otros roles no tocan estas tablas", () => {
      it.each(["catalogo", "plataforma"] as const)(
        "el rol %s no puede leer empresa ni usuario",
        async (rol) => {
          await expect(
            conTenant(pools.db(rol), A, (trx) =>
              sql`select * from usuario`.execute(trx),
            ),
          ).rejects.toThrow(/permission denied/i);
          await expect(
            conTenant(pools.db(rol), A, (trx) =>
              sql`select * from empresa`.execute(trx),
            ),
          ).rejects.toThrow(/permission denied/i);
        },
      );
    });
  },
);
