import { randomBytes } from "node:crypto";
import { userInfo } from "node:os";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  actualizarEnv,
  claveDeUrl,
  configuracion,
  construirUrl,
  generarClave,
  inicializar,
  parsearEnv,
} from "./db-init.mjs";

describe("configuracion", () => {
  it("deriva los nombres de roles y bases del prefijo", () => {
    const c = configuracion("sigiso");
    expect(c.roles).toEqual({
      owner: "sigiso_owner",
      app: "sigiso_app",
      catalogo: "sigiso_catalogo",
      plataforma: "sigiso_plataforma",
      openfga: "sigiso_openfga",
    });
    expect(c.bases).toEqual({
      principal: "sigiso",
      prueba: "sigiso_test",
      openfga: "openfga",
    });
  });

  it('usa "sigiso" por defecto', () => {
    expect(configuracion().roles.app).toBe("sigiso_app");
  });

  it("rechaza prefijos que podrían inyectar SQL o chocar con otros proyectos", () => {
    for (const malo of [
      "",
      "Sigiso",
      "a-b",
      "x; drop database postgres",
      "o'brien",
      "orbyta app",
      "1abc",
    ]) {
      expect(() => configuracion(malo), malo).toThrow();
    }
  });
});

describe("generarClave", () => {
  it("genera claves largas, distintas y seguras para una URL", () => {
    const a = generarClave();
    const b = generarClave();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("urls", () => {
  it("construye y recupera la clave de una URL", () => {
    const url = construirUrl({
      usuario: "sigiso_app",
      clave: "abc_DEF-123",
      host: "127.0.0.1",
      puerto: 5432,
      base: "sigiso",
    });
    // Se comprueban las partes con el analizador estándar: así no hay una URL con credenciales escrita completa en el código.
    const u = new URL(url);
    expect([u.protocol, u.username, u.password, u.hostname, u.port, u.pathname]).toEqual(["postgresql:", "sigiso_app", "abc_DEF-123", "127.0.0.1", "5432", "/sigiso"]);
    expect(claveDeUrl(url)).toBe("abc_DEF-123");
  });

  it("devuelve undefined si no hay URL o no tiene clave", () => {
    expect(claveDeUrl(undefined)).toBeUndefined();
    expect(claveDeUrl("")).toBeUndefined();
    expect(claveDeUrl("postgresql://u@h:5432/db")).toBeUndefined();
  });
});

describe("archivo de entorno", () => {
  it("lee pares CLAVE=valor ignorando comentarios y líneas vacías", () => {
    const m = parsearEnv("# c\nA=1\n\nB=dos=tres\n");
    expect(m.get("A")).toBe("1");
    expect(m.get("B")).toBe("dos=tres");
    expect(m.size).toBe(2);
  });

  it("actualiza claves existentes, agrega las que faltan y conserva el resto", () => {
    const antes = "# mi archivo\nAPI_PORT=3001\nX=viejo\n";
    const despues = actualizarEnv(antes, { X: "nuevo", Y: "otro" });
    expect(despues).toContain("# mi archivo");
    expect(despues).toContain("API_PORT=3001");
    expect(despues).toContain("X=nuevo");
    expect(despues).not.toContain("X=viejo");
    expect(despues).toContain("Y=otro");
    expect(despues.endsWith("\n")).toBe(true);
  });

  it("es idempotente: aplicar dos veces da lo mismo", () => {
    const una = actualizarEnv("A=1\n", { B: "2" });
    expect(actualizarEnv(una, { B: "2" })).toBe(una);
  });
});

// --- Integración: PostgreSQL local real. Se omite si no hay un servidor accesible con superusuario. ---
const adminConfig = {
  host: process.env.PGHOST ?? "127.0.0.1",
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER ?? userInfo().username,
  database: "postgres",
};

const hayPostgres = await (async () => {
  const c = new pg.Client(adminConfig);
  try {
    await c.connect();
    const { rows } = await c.query(
      "select rolsuper from pg_roles where rolname = current_user",
    );
    return rows[0]?.rolsuper === true;
  } catch {
    return false;
  } finally {
    await c.end().catch(() => {});
  }
})();

describe.skipIf(!hayPostgres)("inicializar (PostgreSQL real)", () => {
  // Prefijo único y aleatorio: la prueba nunca toca los roles ni las bases reales de sigiso ni de otros proyectos.
  const prefijo = `sigisotest_${randomBytes(4).toString("hex")}`;
  const config = configuracion(prefijo);
  const opciones = { host: adminConfig.host, puerto: adminConfig.port };
  let admin;

  const conectar = async (url) => {
    const c = new pg.Client({ connectionString: url });
    await c.connect();
    return c;
  };

  beforeAll(async () => {
    admin = new pg.Client(adminConfig);
    await admin.connect();
  });

  afterAll(async () => {
    if (!admin) return;
    // Limpieza SOLO de los objetos creados por esta prueba (prefijo aleatorio `sigisotest_`).
    if (!prefijo.startsWith("sigisotest_"))
      throw new Error("Limpieza rechazada: prefijo inesperado");
    for (const base of Object.values(config.bases)) {
      await admin.query(
        `drop database if exists ${admin.escapeIdentifier(base)} with (force)`,
      );
    }
    for (const rol of Object.values(config.roles)) {
      await admin.query(`drop role if exists ${admin.escapeIdentifier(rol)}`);
    }
    await admin.end();
  });

  it("crea roles y bases sin privilegios de superusuario ni BYPASSRLS", async () => {
    const r = await inicializar({ admin, config, textoEnv: "", ...opciones });
    expect(r.creados.roles.sort()).toEqual(Object.values(config.roles).sort());
    expect(r.creados.bases.sort()).toEqual(Object.values(config.bases).sort());

    const { rows } = await admin.query(
      "select rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolcanlogin from pg_roles where rolname = any($1)",
      [Object.values(config.roles)],
    );
    expect(rows).toHaveLength(5);
    for (const f of rows) {
      expect(f.rolsuper, f.rolname).toBe(false);
      expect(f.rolbypassrls, f.rolname).toBe(false);
      expect(f.rolcreatedb, f.rolname).toBe(false);
      expect(f.rolcreaterole, f.rolname).toBe(false);
      expect(f.rolcanlogin, f.rolname).toBe(true);
    }
  });

  it("deja como dueño de cada base al rol correspondiente", async () => {
    const { rows } = await admin.query(
      "select d.datname, r.rolname as dueno from pg_database d join pg_roles r on r.oid = d.datdba where d.datname = any($1)",
      [Object.values(config.bases)],
    );
    const dueno = Object.fromEntries(rows.map((f) => [f.datname, f.dueno]));
    expect(dueno[config.bases.principal]).toBe(config.roles.owner);
    expect(dueno[config.bases.prueba]).toBe(config.roles.owner);
    expect(dueno[config.bases.openfga]).toBe(config.roles.openfga);
  });

  it("escribe URLs que funcionan con cada rol", async () => {
    const r = await inicializar({ admin, config, textoEnv: "", ...opciones });
    const env = parsearEnv(r.textoEnv);
    const casos = [
      ["DATABASE_URL_OWNER", config.roles.owner],
      ["DATABASE_URL_APP", config.roles.app],
      ["DATABASE_URL_CATALOGO", config.roles.catalogo],
      ["DATABASE_URL_PLATAFORMA", config.roles.plataforma],
      ["DATABASE_URL_TEST", config.roles.owner],
      ["OPENFGA_DATASTORE_URI", config.roles.openfga],
    ];
    for (const [clave, rol] of casos) {
      const c = await conectar(env.get(clave));
      const { rows } = await c.query("select current_user as u");
      await c.end();
      expect(rows[0].u, clave).toBe(rol);
    }
  });

  it("es idempotente: la segunda ejecución no cambia nada", async () => {
    const primera = await inicializar({
      admin,
      config,
      textoEnv: "",
      ...opciones,
    });
    const segunda = await inicializar({
      admin,
      config,
      textoEnv: primera.textoEnv,
      ...opciones,
    });
    expect(segunda.creados).toEqual({ roles: [], bases: [] });
    expect(segunda.textoEnv).toBe(primera.textoEnv);
    expect(segunda.cambios).toBe(false);
  });

  it("si se pierde el archivo de entorno, repone las claves sin recrear los roles", async () => {
    const primera = await inicializar({
      admin,
      config,
      textoEnv: "",
      ...opciones,
    });
    const repuesta = await inicializar({
      admin,
      config,
      textoEnv: "",
      ...opciones,
    });
    expect(repuesta.creados).toEqual({ roles: [], bases: [] });
    expect(repuesta.cambios).toBe(true);
    expect(repuesta.textoEnv).not.toBe(primera.textoEnv);
    const c = await conectar(
      parsearEnv(repuesta.textoEnv).get("DATABASE_URL_APP"),
    );
    await c.end();
  });

  it("impide que otros roles se conecten a las bases del proyecto", async () => {
    const { rows } = await admin.query(
      "select has_database_privilege('public', $1, 'CONNECT') as publico",
      [config.bases.principal],
    );
    expect(rows[0].publico).toBe(false);
  });

  it("conserva el resto del archivo de entorno", async () => {
    const r = await inicializar({
      admin,
      config,
      textoEnv: "# mío\nAPI_PORT=3001\n",
      ...opciones,
    });
    expect(r.textoEnv).toContain("# mío");
    expect(r.textoEnv).toContain("API_PORT=3001");
  });
});
