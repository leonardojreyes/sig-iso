import { crearEmpresaId } from "@sig/tenancy";
import { sql } from "kysely";
import { afterAll, describe, expect, it } from "vitest";
import { conTenant } from "./con-tenant";
import { leerUrls, ROLES_BD, type RolBd } from "./configuracion";
import { GestorPools } from "./pools";

// PRIVILEGIOS DE LOS ROLES (ADR 024). Consolida en un solo lugar lo que cada rol puede y NO puede hacer.
// Si alguien añade una tabla, una función o un permiso sin declararlo aquí, estas pruebas fallan a propósito.
const hayBase =
  ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) &&
  !!process.env.DATABASE_URL_TEST;

const ROL: Record<RolBd | "openfga", string> = {
  owner: "sigiso_owner",
  app: "sigiso_app",
  catalogo: "sigiso_catalogo",
  plataforma: "sigiso_plataforma",
  openfga: "sigiso_openfga",
};
const SIN_DUENO: RolBd[] = ["app", "catalogo", "plataforma"];
const PRIVILEGIOS = [
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "TRUNCATE",
  "REFERENCES",
  "TRIGGER",
] as const;

// Matriz esperada de privilegios de TABLA (el dueño, `sigiso_owner`, es dueño de todo y no se lista).
const ESPERADO: Record<string, Partial<Record<RolBd, string[]>>> = {
  empresa: { app: ["SELECT"] },
  usuario: { app: ["SELECT", "INSERT"] }, // UPDATE solo en columnas (nombre, correo)
  libreria: { app: ["SELECT"], catalogo: ["SELECT", "INSERT"] },
  libreria_entrada: { app: ["SELECT"], catalogo: ["SELECT", "INSERT"] },
  libreria_entrada_norma: { app: ["SELECT"], catalogo: ["SELECT", "INSERT"] },
  empresa_libreria: { app: ["SELECT", "INSERT"] },
  bitacora: { app: ["SELECT"] }, // INSERT solo por columna (app y plataforma); ver la prueba de columnas de la bitácora
  kysely_migration: {},
  kysely_migration_lock: {},
};

const DENEGADO =
  /permission denied|must be owner|must be superuser|must have|only superusers|insufficient/i;

describe.skipIf(!hayBase)("privilegios de los roles (PostgreSQL real)", () => {
  const pools = new GestorPools(
    hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {},
    { max: 4 },
  );
  const owner = () => pools.db("owner");
  afterAll(async () => {
    await pools.cerrar();
  });

  /** Ejecuta una sentencia como el rol y la REVIERTE siempre: si por error se permitiera, no queda ningún efecto. */
  const intentar = async (rol: RolBd, sentencia: string): Promise<string> => {
    try {
      await pools
        .db(rol)
        .transaction()
        .execute(async (trx) => {
          await sql.raw(sentencia).execute(trx);
          throw new Error("EJECUTADA");
        });
      return "EJECUTADA";
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  };

  describe("atributos de los roles", () => {
    it.each(Object.entries(ROL))(
      "%s no es superusuario ni tiene BYPASSRLS, CREATEDB, CREATEROLE ni REPLICATION",
      async (_clave, rol) => {
        const r = await sql<
          Record<string, boolean>
        >`select rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication, rolcanlogin from pg_roles where rolname = ${rol}`.execute(
          owner(),
        );
        expect(r.rows[0]).toEqual({
          rolsuper: false,
          rolbypassrls: false,
          rolcreatedb: false,
          rolcreaterole: false,
          rolreplication: false,
          rolcanlogin: true,
        });
      },
    );

    it("ningún rol del proyecto es miembro de otro (no hereda privilegios)", async () => {
      const r = await sql<{ miembro: string; rol: string }>`
        select m.rolname as miembro, g.rolname as rol from pg_auth_members am
        join pg_roles m on m.oid = am.member join pg_roles g on g.oid = am.roleid
        where m.rolname like 'sigiso\\_%'`.execute(owner());
      expect(r.rows).toEqual([]);
    });

    it("los roles sin dueño de esquema no son dueños de ninguna tabla, función ni esquema", async () => {
      const nombres = SIN_DUENO.map((r) => ROL[r]);
      const tablas = await sql<{
        n: string;
      }>`select relname as n from pg_class c join pg_roles r on r.oid = c.relowner where r.rolname = any(${nombres}) and c.relkind in ('r', 'v', 'm', 'S', 'p', 'f')`.execute(
        owner(),
      );
      const funciones = await sql<{
        n: string;
      }>`select proname as n from pg_proc p join pg_roles r on r.oid = p.proowner where r.rolname = any(${nombres})`.execute(
        owner(),
      );
      const esquemas = await sql<{
        n: string;
      }>`select nspname as n from pg_namespace s join pg_roles r on r.oid = s.nspowner where r.rolname = any(${nombres})`.execute(
        owner(),
      );
      expect([tablas.rows, funciones.rows, esquemas.rows]).toEqual([
        [],
        [],
        [],
      ]);
    });

    it("la base y el esquema no dan a la aplicación más de lo necesario", async () => {
      const r = await sql<Record<string, boolean>>`select
        has_schema_privilege('sigiso_app', 'public', 'USAGE') as usa_esquema,
        has_schema_privilege('sigiso_app', 'public', 'CREATE') as crea_en_esquema,
        has_database_privilege('sigiso_app', current_database(), 'CONNECT') as conecta,
        has_database_privilege('sigiso_app', current_database(), 'CREATE') as crea_en_base,
        has_database_privilege('sigiso_app', current_database(), 'TEMP') as crea_temporales`.execute(
        owner(),
      );
      expect(r.rows[0]).toEqual({
        usa_esquema: true,
        crea_en_esquema: false,
        conecta: true,
        crea_en_base: false,
        crea_temporales: false,
      });
    });
  });

  describe("matriz de privilegios de tablas", () => {
    it("toda tabla del esquema público está declarada en la matriz (una tabla nueva obliga a declarar sus permisos)", async () => {
      const r = await sql<{
        n: string;
      }>`select tablename as n from pg_tables where schemaname = 'public' and tablename not like 'prueba\\_%' order by 1`.execute(
        owner(),
      );
      expect(r.rows.map((f) => f.n).sort()).toEqual(
        Object.keys(ESPERADO).sort(),
      );
    });

    it.each(Object.keys(ESPERADO))(
      "%s: cada rol tiene exactamente los privilegios esperados",
      async (tabla) => {
        for (const rol of SIN_DUENO) {
          const tiene: string[] = [];
          for (const p of PRIVILEGIOS) {
            const r = await sql<{
              ok: boolean;
            }>`select has_table_privilege(${ROL[rol]}, ${"public." + tabla}, ${p}) as ok`.execute(
              owner(),
            );
            if (r.rows[0]?.ok) tiene.push(p);
          }
          expect({ tabla, rol, tiene }).toEqual({
            tabla,
            rol,
            tiene: ESPERADO[tabla]?.[rol] ?? [],
          });
        }
      },
    );

    it("PUBLIC no tiene ningún privilegio sobre las tablas", async () => {
      for (const tabla of Object.keys(ESPERADO)) {
        for (const p of PRIVILEGIOS) {
          const r = await sql<{
            ok: boolean;
          }>`select has_table_privilege('public', ${"public." + tabla}, ${p}) as ok`.execute(
            owner(),
          );
          expect({ tabla, p, ok: r.rows[0]?.ok }).toEqual({
            tabla,
            p,
            ok: false,
          });
        }
      }
    });

    it("la bitácora: la aplicación y la plataforma solo insertan columnas permitidas; nadie modifica ni borra", async () => {
      const col = async (rol: string, columna: string, permiso: string) =>
        (await sql<{ ok: boolean }>`select has_column_privilege(${rol}, 'public.bitacora', ${columna}, ${permiso}) as ok`.execute(owner())).rows[0]?.ok;
      const permitidas = ["empresa_id", "actor_tipo", "usuario_id", "accion", "objeto", "objeto_version", "resultado", "motivo", "trace_id", "origen_id", "antes", "despues"];
      const prohibidas = ["id", "creada_en", "secuencia", "hash_previo", "hash"];
      for (const rol of ["sigiso_app", "sigiso_plataforma"]) {
        for (const c of permitidas) expect({ rol, c, ok: await col(rol, c, "INSERT") }).toEqual({ rol, c, ok: true });
        for (const c of prohibidas) expect({ rol, c, ok: await col(rol, c, "INSERT") }).toEqual({ rol, c, ok: false });
      }
      for (const rol of ["sigiso_app", "sigiso_plataforma", "sigiso_catalogo", "sigiso_owner"]) {
        for (const permiso of rol === "sigiso_owner" ? ["UPDATE"] : ["UPDATE", "REFERENCES"]) {
          const r = await sql<{ ok: boolean }>`select has_any_column_privilege(${rol}, 'public.bitacora', ${permiso}) as ok`.execute(owner());
          expect({ rol, permiso, ok: r.rows[0]?.ok }).toEqual({ rol, permiso, ok: false });
        }
      }
      const catalogo = await sql<{ ok: boolean }>`select has_any_column_privilege('sigiso_catalogo', 'public.bitacora', 'INSERT') as ok`.execute(owner());
      expect(catalogo.rows[0]?.ok).toBe(false);
    });

    it("la aplicación solo actualiza nombre y correo de usuario; ninguna otra columna ni tabla", async () => {
      const col = async (rol: string, tabla: string, columna: string) =>
        (
          await sql<{
            ok: boolean;
          }>`select has_column_privilege(${rol}, ${"public." + tabla}, ${columna}, 'UPDATE') as ok`.execute(
            owner(),
          )
        ).rows[0]?.ok;
      expect(await col("sigiso_app", "usuario", "nombre")).toBe(true);
      expect(await col("sigiso_app", "usuario", "correo")).toBe(true);
      for (const c of ["id", "empresa_id", "creada_en"])
        expect(await col("sigiso_app", "usuario", c)).toBe(false);
      for (const t of Object.keys(ESPERADO).filter((x) => x !== "usuario")) {
        const r = await sql<{
          ok: boolean;
        }>`select has_any_column_privilege('sigiso_app', ${"public." + t}, 'UPDATE') as ok`.execute(
          owner(),
        );
        expect({ t, ok: r.rows[0]?.ok }).toEqual({ t, ok: false });
      }
    });

    it("las tablas con datos por empresa tienen RLS activa y forzada", async () => {
      const r = await sql<{
        relname: string;
        relrowsecurity: boolean;
        relforcerowsecurity: boolean;
      }>`select relname, relrowsecurity, relforcerowsecurity from pg_class where relname in ('empresa', 'usuario', 'empresa_libreria', 'libreria_entrada', 'libreria_entrada_norma') order by 1`.execute(
        owner(),
      );
      expect(r.rows.map((f) => f.relname)).toEqual([
        "empresa",
        "empresa_libreria",
        "libreria_entrada",
        "libreria_entrada_norma",
        "usuario",
      ]);
      for (const f of r.rows)
        expect([f.relname, f.relrowsecurity, f.relforcerowsecurity]).toEqual([
          f.relname,
          true,
          true,
        ]);
    });
  });

  describe("funciones", () => {
    it("las únicas funciones del esquema público son app_tenant_id y bitacora_inmutable", async () => {
      const r = await sql<{
        n: string;
      }>`select p.proname as n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public'`.execute(
        owner(),
      );
      expect(r.rows.map((f) => f.n).sort()).toEqual(["app_tenant_id", "bitacora_inmutable"]);
    });

    it("app_tenant_id la ejecutan los roles del proyecto y no PUBLIC", async () => {
      for (const rol of ["owner", "app", "catalogo", "plataforma"] as const) {
        const r = await sql<{
          ok: boolean;
        }>`select has_function_privilege(${ROL[rol]}, 'app_tenant_id()', 'EXECUTE') as ok`.execute(
          owner(),
        );
        expect({ rol, ok: r.rows[0]?.ok }).toEqual({ rol, ok: true });
      }
      const publico = await sql<{
        ok: boolean;
      }>`select has_function_privilege('public', 'app_tenant_id()', 'EXECUTE') as ok`.execute(
        owner(),
      );
      expect(publico.rows[0]?.ok).toBe(false);
    });
  });

  describe("lo que la aplicación NO puede hacer (cada intento se revierte)", () => {
    it.each([
      [
        "desactivar RLS de una tabla",
        "alter table usuario disable row level security",
      ],
      [
        "quitar FORCE de una tabla",
        "alter table usuario no force row level security",
      ],
      ["alterar la estructura", "alter table usuario add column intruso int"],
      ["borrar una tabla", "drop table usuario"],
      ["borrar una política", "drop policy usuario_propios on usuario"],
      [
        "crear una política permisiva",
        "create policy intrusa on usuario for select using (true)",
      ],
      ["crear una tabla", "create table intrusa (id int)"],
      [
        "crear una función",
        "create function intrusa() returns int language sql as 'select 1'",
      ],
      [
        "reemplazar app_tenant_id",
        "create or replace function app_tenant_id() returns uuid language sql as $$ select '3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c'::uuid $$",
      ],
      ["borrar app_tenant_id", "drop function app_tenant_id()"],
      ["vaciar una tabla", "truncate usuario"],
      ["asumir el rol dueño", "set role sigiso_owner"],
      ["cambiar de sesión al dueño", "set session authorization sigiso_owner"],
      ["darse BYPASSRLS", "alter role sigiso_app bypassrls"],
      ["hacerse superusuario", "alter role sigiso_app superuser"],
      ["crear roles", "create role intruso"],
      [
        "ejecutar un programa del servidor",
        "copy (select 1) to program 'true'",
      ],
    ])("no puede %s", async (_nombre, sentencia) => {
      expect(await intentar("app", sentencia)).toMatch(DENEGADO);
    });

    it("no puede cambiar la configuración del servidor (ALTER SYSTEM no corre en transacción: se consulta el privilegio)", async () => {
      for (const rol of ["app", "catalogo", "plataforma"] as const) {
        const r = await sql<{ ok: boolean }>`select has_parameter_privilege(${ROL[rol]}, 'max_connections', 'ALTER SYSTEM') as ok`.execute(owner());
        expect({ rol, ok: r.rows[0]?.ok }).toEqual({ rol, ok: false });
      }
    });

    it.each(["catalogo", "plataforma"] as const)(
      "el rol %s tampoco puede desactivar RLS ni asumir el rol dueño",
      async (rol) => {
        expect(
          await intentar(rol, "alter table usuario disable row level security"),
        ).toMatch(DENEGADO);
        expect(await intentar(rol, "set role sigiso_owner")).toMatch(DENEGADO);
      },
    );

    it("no puede apagar la seguridad por fila con row_security = off", async () => {
      const A = crearEmpresaId("3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c");
      await expect(
        conTenant(pools.db("app"), A, async (trx) => {
          await sql`set local row_security = off`.execute(trx);
          return sql`select * from usuario`.execute(trx);
        }),
      ).rejects.toThrow(/row-level security/i);
    });
  });

  describe("límite conocido (documentado en el ADR 024)", () => {
    it("RLS no protege contra SQL arbitrario del propio rol de la aplicación: puede cambiar app.tenant_id dentro de su transacción", async () => {
      // No es un fallo a corregir aquí: por eso TODA consulta de la aplicación va parametrizada, sin SQL armado con datos de
      // usuario, y la capa de acceso solo se usa a través de conTenant. Si algún día se endurece (por ejemplo, un parámetro
      // protegido), esta prueba debe actualizarse.
      const A = crearEmpresaId("3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c");
      const B = crearEmpresaId("0190a5b2-7c3e-7a1d-9f40-123456789abc");
      const r = await conTenant(pools.db("app"), A, async (trx) => {
        await sql`select set_config('app.tenant_id', ${B}, true)`.execute(trx);
        return sql<{
          n: number;
        }>`select count(*)::int as n from empresa where id = ${B}`.execute(trx);
      });
      expect(r.rows[0]?.n).toBe(0); // la fila de B no existe en este momento, pero la consulta NO falló: el cambio de empresa fue posible
    });
  });
});
