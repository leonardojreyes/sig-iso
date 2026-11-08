import { ErrorAutorizacion } from "@sig/autorizacion";
import { crearEmpresaId } from "@sig/tenancy";
import { Kysely, PostgresDialect, sql } from "kysely";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AutorizacionPostgres } from "./autorizacion-postgres";
import { conTenant } from "./con-tenant";
import { leerUrls, ROLES_BD } from "./configuracion";
import { GestorPools } from "./pools";

// Autorización por rol desde la base (ADR 029), contra PostgreSQL real con el esquema migrado y dos empresas.
const A = crearEmpresaId("a9a9a9a9-0000-4000-8000-00000000000a");
const B = crearEmpresaId("b9b9b9b9-0000-4000-8000-00000000000b");
const ADMIN_A = "a9000001-0000-4000-8000-0000000000a1";
const COLAB_A = "a9000002-0000-4000-8000-0000000000a2";
const SIN_ROL_A = "a9000003-0000-4000-8000-0000000000a3";
const ADMIN_B = "b9000001-0000-4000-8000-0000000000b1";
const NO_EXISTE = "c9000001-0000-4000-8000-0000000000c1";

const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)("AutorizacionPostgres (PostgreSQL real)", () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 5 });
  const owner = () => pools.db("owner");
  const app = () => pools.db("app");
  const autorizacion = () => new AutorizacionPostgres(app());

  const sembrarEmpresa = async (id: typeof A, slug: string, personas: Array<[string, string | null]>) => {
    await conTenant(owner(), id, async (trx) => {
      await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${slug}, ${"Empresa " + slug}, '#0E5C42') on conflict do nothing`.execute(trx);
      for (const [uid, rol] of personas) {
        await sql`insert into usuario (id, empresa_id, nombre, correo, rol) values (${uid}, ${id}, ${"Persona " + uid.slice(0, 8)}, ${uid.slice(0, 8) + "@example.test"}, ${rol}) on conflict (id) do update set rol = excluded.rol`.execute(trx);
      }
    });
  };
  const limpiar = async (id: typeof A) => {
    await conTenant(owner(), id, async (trx) => {
      await sql`delete from usuario where empresa_id = ${id}`.execute(trx);
      await sql`delete from empresa where id = ${id}`.execute(trx);
    });
  };

  beforeAll(async () => {
    await sembrarEmpresa(A, "autz-a", [[ADMIN_A, "administrador_sig"], [COLAB_A, "colaborador"], [SIN_ROL_A, null]]);
    await sembrarEmpresa(B, "autz-b", [[ADMIN_B, "administrador_sig"]]);
  });
  afterAll(async () => {
    await limpiar(A);
    await limpiar(B);
    await pools.cerrar();
  });

  it("el administrador SIG tiene su rol y todos los permisos", async () => {
    expect(await autorizacion().rolesDe(ADMIN_A, A)).toEqual(["administrador_sig"]);
    for (const p of ["librerias.adoptar", "librerias.ver", "requisitos.ver", "marca.ver"] as const) {
      expect(await autorizacion().puede(ADMIN_A, p, A), p).toBe(true);
    }
  });

  it("el colaborador consulta pero NO adopta", async () => {
    expect(await autorizacion().rolesDe(COLAB_A, A)).toEqual(["colaborador"]);
    expect(await autorizacion().puede(COLAB_A, "librerias.ver", A)).toBe(true);
    expect(await autorizacion().puede(COLAB_A, "librerias.adoptar", A)).toBe(false);
  });

  it("cerrado por defecto: sin rol, usuario inexistente o permiso desconocido no hay permiso", async () => {
    expect(await autorizacion().rolesDe(SIN_ROL_A, A)).toEqual([]);
    expect(await autorizacion().puede(SIN_ROL_A, "marca.ver", A)).toBe(false);
    expect(await autorizacion().rolesDe(NO_EXISTE, A)).toEqual([]);
    expect(await autorizacion().puede(NO_EXISTE, "marca.ver", A)).toBe(false);
    expect(await autorizacion().puede(ADMIN_A, "todo.permitido" as never, A)).toBe(false);
  });

  it("AISLAMIENTO: el rol de A no vale en B y viceversa", async () => {
    expect(await autorizacion().rolesDe(ADMIN_A, B)).toEqual([]);
    expect(await autorizacion().puede(ADMIN_A, "librerias.adoptar", B)).toBe(false);
    expect(await autorizacion().rolesDe(ADMIN_B, A)).toEqual([]);
    expect(await autorizacion().puede(ADMIN_B, "librerias.adoptar", A)).toBe(false);
  });

  it("un cambio de rol surte efecto de inmediato (sin caché)", async () => {
    expect(await autorizacion().puede(COLAB_A, "librerias.adoptar", A)).toBe(false);
    await conTenant(owner(), A, async (trx) => sql`update usuario set rol = 'administrador_sig' where id = ${COLAB_A}`.execute(trx));
    expect(await autorizacion().puede(COLAB_A, "librerias.adoptar", A)).toBe(true);
    await conTenant(owner(), A, async (trx) => sql`update usuario set rol = 'colaborador' where id = ${COLAB_A}`.execute(trx));
    expect(await autorizacion().puede(COLAB_A, "librerias.adoptar", A)).toBe(false);
  });

  it("roles sin permisos en la matriz (p. ej. auditor externo) no pueden nada", async () => {
    await conTenant(owner(), A, async (trx) => sql`update usuario set rol = 'auditor_externo' where id = ${SIN_ROL_A}`.execute(trx));
    expect(await autorizacion().rolesDe(SIN_ROL_A, A)).toEqual(["auditor_externo"]);
    expect(await autorizacion().puede(SIN_ROL_A, "marca.ver", A)).toBe(false);
    await conTenant(owner(), A, async (trx) => sql`update usuario set rol = null where id = ${SIN_ROL_A}`.execute(trx));
  });

  it("consultas inválidas fallan (no devuelven «no» en silencio)", async () => {
    await expect(autorizacion().rolesDe("no-es-uuid", A)).rejects.toBeInstanceOf(ErrorAutorizacion);
    await expect(autorizacion().puede("", "marca.ver", A)).rejects.toBeInstanceOf(ErrorAutorizacion);
    await expect(autorizacion().rolesDe(ADMIN_A, "no-es-empresa" as never)).rejects.toThrow();
  });

  it("si la base no responde, FALLA: nunca «sí» por omisión", async () => {
    // Puerto sin servicio: la consulta no puede responder.
    const db = new Kysely<never>({ dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: "postgresql://x:y@127.0.0.1:1/z", connectionTimeoutMillis: 1500 }) }) });
    await expect(new AutorizacionPostgres(db as never).puede(ADMIN_A, "marca.ver", A)).rejects.toThrow();
    await expect(new AutorizacionPostgres(db as never).rolesDe(ADMIN_A, A)).rejects.toThrow();
    await db.destroy();
  });

  it("la base rechaza un rol que no sea del catálogo", async () => {
    await expect(conTenant(owner(), A, async (trx) => sql`update usuario set rol = 'superadmin' where id = ${COLAB_A}`.execute(trx))).rejects.toThrow(/check|rol/i);
  });

  it("la aplicación NO puede asignarse ni cambiar roles: ni UPDATE ni INSERT de la columna rol", async () => {
    await expect(conTenant(app(), A, async (trx) => sql`update usuario set rol = 'administrador_sig' where id = ${COLAB_A}`.execute(trx))).rejects.toThrow(/permission denied|permiso denegado/i);
    await expect(
      conTenant(app(), A, async (trx) =>
        sql`insert into usuario (id, empresa_id, nombre, correo, rol) values ('a9000099-0000-4000-8000-000000000099', ${A}, 'Intruso', 'intruso@example.test', 'administrador_sig')`.execute(trx),
      ),
    ).rejects.toThrow(/permission denied|permiso denegado/i);
    // Insertar sin rol sigue permitido (alta de datos de identificación) y queda sin ningún permiso.
    await conTenant(app(), A, async (trx) =>
      sql`insert into usuario (id, empresa_id, nombre, correo) values ('a9000098-0000-4000-8000-000000000098', ${A}, 'Nueva', 'nueva@example.test')`.execute(trx),
    );
    expect(await autorizacion().rolesDe("a9000098-0000-4000-8000-000000000098", A)).toEqual([]);
  });
});
