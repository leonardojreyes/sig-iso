import { ErrorAutorizacion } from "@sig/autorizacion";
import {
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type CompiledQuery,
  type DatabaseConnection,
  type Driver,
  type QueryResult,
} from "kysely";
import { describe, expect, it } from "vitest";
import { AutorizacionPostgres } from "./autorizacion-postgres";

// Prueba unitaria con un controlador falso: devuelve la fila que se le indique y cuenta las consultas. Cubre lo que la base
// real no deja fabricar (un rol dañado por fuera del catálogo) y comprueba que lo inválido no llega a consultarla.
const A = "aaaaaaaa-0000-4000-8000-00000000000a";
const U = "a1a1a1a1-0000-4000-8000-0000000000a1";

const falsa = (filas: Array<{ rol: string | null }>) => {
  const consultas: string[] = [];
  const conexion: DatabaseConnection = {
    async executeQuery<R>(q: CompiledQuery): Promise<QueryResult<R>> {
      consultas.push(q.sql);
      return { rows: (/from "usuario"/.test(q.sql) ? filas : []) as R[] };
    },
    // eslint-disable-next-line require-yield
    async *streamQuery() {
      throw new Error("no usado");
    },
  };
  const driver: Driver = {
    init: async () => {},
    acquireConnection: async () => conexion,
    beginTransaction: async () => {},
    commitTransaction: async () => {},
    rollbackTransaction: async () => {},
    releaseConnection: async () => {},
    destroy: async () => {},
  };
  const db = new Kysely<never>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => driver,
      createIntrospector: (d) => new PostgresIntrospector(d),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });
  return { adaptador: new AutorizacionPostgres(db as never), consultas };
};

describe("AutorizacionPostgres (unitaria, sin base)", () => {
  it("un rol fuera del catálogo (dato dañado) FALLA: no se interpreta ni se concede", async () => {
    const { adaptador } = falsa([{ rol: "superadmin" }]);
    await expect(adaptador.rolesDe(U, A as never)).rejects.toBeInstanceOf(ErrorAutorizacion);
    await expect(adaptador.puede(U, "librerias.adoptar", A as never)).rejects.toBeInstanceOf(ErrorAutorizacion);
  });

  it("un permiso desconocido se niega SIN consultar la base", async () => {
    const { adaptador, consultas } = falsa([{ rol: "administrador_sig" }]);
    expect(await adaptador.puede(U, "todo.permitido" as never, A as never)).toBe(false);
    expect(consultas).toEqual([]);
  });

  it("un identificador de persona inválido se rechaza SIN consultar la base", async () => {
    const { adaptador, consultas } = falsa([{ rol: "administrador_sig" }]);
    await expect(adaptador.rolesDe("no-es-uuid", A as never)).rejects.toBeInstanceOf(ErrorAutorizacion);
    await expect(adaptador.puede("00000000-0000-0000-0000-000000000000", "marca.ver", A as never)).rejects.toBeInstanceOf(ErrorAutorizacion);
    expect(consultas).toEqual([]);
  });

  it("con un rol válido concede solo lo que dice la matriz", async () => {
    const { adaptador } = falsa([{ rol: "colaborador" }]);
    expect(await adaptador.puede(U, "librerias.ver", A as never)).toBe(true);
    expect(await adaptador.puede(U, "librerias.adoptar", A as never)).toBe(false);
    expect(await adaptador.rolesDe(U, A as never)).toEqual(["colaborador"]);
  });

  it("sin fila o con rol nulo no hay roles ni permisos", async () => {
    for (const filas of [[], [{ rol: null }]]) {
      const { adaptador } = falsa(filas);
      expect(await adaptador.rolesDe(U, A as never)).toEqual([]);
      expect(await adaptador.puede(U, "marca.ver", A as never)).toBe(false);
    }
  });
});
