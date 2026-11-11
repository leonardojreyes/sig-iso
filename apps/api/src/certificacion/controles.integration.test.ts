import {
  AgregarMapeoUseCase,
  AprobarAlcanceUseCase,
  CambiarControlUseCase,
  CrearControlUseCase,
  EvaluarEntradaUseCase,
  GuardarAlcanceUseCase,
  ListarAlcancesUseCase,
  ListarControlesUseCase,
  ListarDiagnosticoUseCase,
  QuitarMapeoUseCase,
  RetirarControlUseCase,
} from "@sig/certificacion";
import {
  A,
  ADMIN,
  B,
  COLAB,
  EstadoFalso,
  crearAutorizacionFalsa,
  crearCatalogoFalso,
  crearUnidadFalsa,
  entradas,
} from "@sig/certificacion/prueba";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  crearArnes,
  hechosEnMemoria,
  type Arnes,
} from "../autenticacion/prueba/arnes.js";
import { erroresDeEsquema } from "../autenticacion/prueba/contrato.js";
import { CertificacionApiModule } from "./certificacion-api.module.js";

// /controles y sus mapeos sobre una aplicación Nest REAL con los casos de uso reales y fakes que separan los datos por empresa.
// Cada respuesta se valida contra los esquemas de openapi.yaml.
const ADMIN_B = "66666666-6666-4666-8666-666666666666";
const POL = {
  libreriaCodigo: entradas.politicas.libreriaCodigo,
  idEstable: entradas.politicas.idEstable,
};
const CTX = {
  libreriaCodigo: entradas.contexto.libreriaCodigo,
  idEstable: entradas.contexto.idEstable,
};
const ID_FALSO = "dddddddd-0000-4000-8000-000000000000";

describe("controladores de controles y mapeos (MVP M3, paso 4)", () => {
  let arnes: Arnes;
  let estado: EstadoFalso;
  const bitacora = hechosEnMemoria();
  let sesion = 0;
  const token = (empresa: string, usuario: string) =>
    arnes.firmar(empresa, usuario, { sid: `s-${++sesion}` });
  const tAdmin = () => token(A, ADMIN);
  const tColab = () => token(A, COLAB);
  const tAdminB = () => token(B, ADMIN_B);

  beforeAll(async () => {
    estado = new EstadoFalso();
    const autorizacion = crearAutorizacionFalsa(estado);
    const catalogo = crearCatalogoFalso(estado);
    const unidad = crearUnidadFalsa(estado);
    const reloj = () => new Date("2026-11-10T12:00:00Z");
    arnes = await crearArnes({
      hechos: bitacora.hechos,
      modulos: [
        CertificacionApiModule.register({
          alcances: new ListarAlcancesUseCase(unidad, autorizacion, catalogo),
          guardarAlcance: new GuardarAlcanceUseCase(
            unidad,
            autorizacion,
            catalogo,
            reloj,
          ),
          aprobarAlcance: new AprobarAlcanceUseCase(
            unidad,
            autorizacion,
            catalogo,
            reloj,
          ),
          diagnostico: new ListarDiagnosticoUseCase(
            unidad,
            autorizacion,
            catalogo,
          ),
          evaluar: new EvaluarEntradaUseCase(
            unidad,
            autorizacion,
            catalogo,
            reloj,
          ),
          listarControles: new ListarControlesUseCase(
            unidad,
            autorizacion,
            catalogo,
          ),
          crearControl: new CrearControlUseCase(
            unidad,
            autorizacion,
            reloj,
            () => crypto.randomUUID(),
          ),
          cambiarControl: new CambiarControlUseCase(
            unidad,
            autorizacion,
            reloj,
          ),
          retirarControl: new RetirarControlUseCase(
            unidad,
            autorizacion,
            reloj,
          ),
          agregarMapeo: new AgregarMapeoUseCase(
            unidad,
            autorizacion,
            catalogo,
            reloj,
          ),
          quitarMapeo: new QuitarMapeoUseCase(unidad, autorizacion),
        }),
      ],
    });
  });
  afterAll(async () => {
    await arnes.cerrar();
  });
  beforeEach(() => {
    for (const m of [
      estado.controles,
      estado.mapeos,
      estado.evaluaciones,
      estado.alcances,
    ])
      m.clear();
    estado.eventos = [];
    estado.permisos.clear();
    estado.carrera = false;
    estado.fallarBitacora = false;
    estado.catalogoPorEmpresa.clear();
    estado.catalogoPorEmpresa.set(A, [
      entradas.contexto,
      entradas.politicas,
      entradas.roles,
    ]);
    estado.catalogoPorEmpresa.set(B, [entradas.contexto]);
    estado.conceder(ADMIN, A, "controles.ver", "controles.gestionar");
    estado.conceder(COLAB, A, "controles.ver");
    estado.conceder(ADMIN_B, B, "controles.ver", "controles.gestionar");
    bitacora.estado.eventos = [];
    bitacora.estado.falla = false;
  });

  const cuerpo = async (r: Response) => (await r.json()) as unknown;
  const problema = async (r: Response, status: number, codigo: string) => {
    expect(r.status).toBe(status);
    expect(r.headers.get("content-type")).toMatch(
      /^application\/problem\+json/,
    );
    const c = (await cuerpo(r)) as Record<string, unknown>;
    expect(c).toMatchObject({ status, codigo });
    expect(erroresDeEsquema("Problema", c)).toEqual([]);
  };
  const crear = (t: string | undefined, c: unknown) =>
    arnes.pedir("/controles", t, "POST", c);
  const nuevo = {
    codigo: "C-001",
    nombre: "Política de contraseñas",
    descripcion: "DESCRIPCION-PRIVADA",
  };
  const creado = async (t?: string, c: Record<string, unknown> = nuevo) =>
    (await cuerpo(await crear(t ?? (await tAdmin()), c))) as {
      id: string;
      version: number;
      codigo: string;
    };

  describe("401 sin token", () => {
    it.each([
      ["GET", "/controles"],
      ["POST", "/controles"],
      ["PUT", `/controles/${ID_FALSO}`],
      ["POST", `/controles/${ID_FALSO}/retiro`],
      ["POST", `/controles/${ID_FALSO}/mapeos`],
      ["POST", `/controles/${ID_FALSO}/mapeos/eliminacion`],
    ])("%s %s", async (metodo, ruta) => {
      await problema(
        await arnes.pedir(
          ruta,
          undefined,
          metodo,
          metodo === "GET" ? undefined : {},
        ),
        401,
        "no_autenticado",
      );
    });
  });

  describe("crear y listar", () => {
    it("crea con 201 y la forma del contrato, sin caché, y registra el hecho sin el texto", async () => {
      const r = await crear(await tAdmin(), nuevo);
      expect(r.status).toBe(201);
      expect(r.headers.get("cache-control")).toBe("no-store");
      const c = (await cuerpo(r)) as {
        codigo: string;
        estado: string;
        version: number;
      };
      expect(erroresDeEsquema("Control", c)).toEqual([]);
      expect(c).toMatchObject({
        codigo: "C-001",
        estado: "vigente",
        version: 1,
      });
      expect(estado.eventos.map((e) => e.accion)).toEqual(["control.creado"]);
      expect(JSON.stringify(estado.eventos)).not.toMatch(/PRIVADA|contraseñas/);
    });

    it("el código repetido responde 409 (también con uno retirado)", async () => {
      const c = await creado();
      await problema(await crear(await tAdmin(), nuevo), 409, "conflicto");
      await arnes.pedir(`/controles/${c.id}/retiro`, await tAdmin(), "POST", {
        versionEsperada: 1,
      });
      await problema(await crear(await tAdmin(), nuevo), 409, "conflicto");
    });

    it("el colaborador ve el marco pero no crea: 403 antes que 400", async () => {
      const t = await tColab();
      expect((await arnes.pedir("/controles", t)).status).toBe(200);
      await problema(await crear(t, nuevo), 403, "sin_permiso");
      await problema(await crear(t, [1]), 403, "sin_permiso");
      expect(estado.controles.size).toBe(0);
    });

    it("400 por forma (sin repetir el valor) y la empresa del cuerpo se ignora", async () => {
      const t = await tAdmin();
      for (const malo of [
        { ...nuevo, codigo: "C 1" },
        { ...nuevo, nombre: "" },
        { ...nuevo, nombre: 7 },
        { ...nuevo, responsableId: "x" },
        { ...nuevo, descripcion: "x".repeat(1001) },
        [1],
        "texto",
      ])
        await problema(await crear(t, malo), 400, "parametro_invalido");
      await crear(t, { ...nuevo, empresaId: B });
      expect(
        [...estado.controles.values()].every((c) => c.empresaId === A),
      ).toBe(true);
    });

    it("el marco trae las entradas y las normas que alcanza cada control, con la forma del contrato", async () => {
      const t = await tAdmin();
      const c = await creado(t);
      await arnes.pedir(`/controles/${c.id}/mapeos`, t, "POST", CTX);
      await arnes.pedir(`/controles/${c.id}/mapeos`, t, "POST", POL);
      const r = await arnes.pedir("/controles", await tColab());
      expect(r.headers.get("cache-control")).toBe("no-store");
      const m = (await cuerpo(r)) as {
        controles: { mapeos: { idEstable: string }[]; normas: string[] }[];
        normas: string[];
      };
      expect(erroresDeEsquema("MarcoControles", m)).toEqual([]);
      expect(m.normas).toEqual(["ISO 9001", "ISO/IEC 27001"]);
      expect(m.controles[0]!.normas).toEqual(["ISO 9001", "ISO/IEC 27001"]);
      expect(m.controles[0]!.mapeos.map((x) => x.idEstable).sort()).toEqual([
        "a27-5-1",
        "ha-4.1",
      ]);
    });

    it("filtra por norma y los retirados solo salen si se piden; los filtros inválidos son 400", async () => {
      const t = await tAdmin();
      const c1 = await creado(t);
      const c2 = await creado(t, { codigo: "C-002", nombre: "Otro" });
      await arnes.pedir(`/controles/${c1.id}/mapeos`, t, "POST", CTX);
      await arnes.pedir(`/controles/${c2.id}/mapeos`, t, "POST", POL);
      await arnes.pedir(`/controles/${c2.id}/retiro`, t, "POST", {
        versionEsperada: 1,
      });
      const codigos = async (q: string) =>
        (
          (await cuerpo(await arnes.pedir(`/controles${q}`, t))) as {
            controles: { codigo: string }[];
          }
        ).controles.map((c) => c.codigo);
      expect(await codigos("")).toEqual(["C-001"]);
      expect(await codigos("?incluirRetirados=true")).toEqual([
        "C-001",
        "C-002",
      ]);
      expect(await codigos(`?norma=${encodeURIComponent("ISO 9001")}`)).toEqual(
        ["C-001"],
      );
      for (const q of [
        "?incluirRetirados=quizas",
        "?incluirRetirados=true&incluirRetirados=false",
        "?norma=%3Cscript%3E",
        "?norma=a&norma=b",
      ])
        await problema(
          await arnes.pedir(`/controles${q}`, t),
          400,
          "parametro_invalido",
        );
    });

    it("aislamiento: B no ve los controles de A", async () => {
      await creado();
      const deB = (await cuerpo(
        await arnes.pedir("/controles", await tAdminB()),
      )) as { controles: unknown[] };
      expect(deB.controles).toEqual([]);
    });
  });

  describe("cambiar y retirar", () => {
    it("cambia con la versión vista, sin pisar: una versión vieja es 409", async () => {
      const t = await tAdmin();
      const c = await creado(t);
      const r = await arnes.pedir(`/controles/${c.id}`, t, "PUT", {
        versionEsperada: 1,
        nombre: "Gestión de contraseñas",
        descripcion: null,
      });
      expect(r.status).toBe(200);
      const n = (await cuerpo(r)) as {
        nombre: string;
        version: number;
        descripcion: string | null;
      };
      expect(erroresDeEsquema("Control", n)).toEqual([]);
      expect(n).toMatchObject({
        nombre: "Gestión de contraseñas",
        version: 2,
        descripcion: null,
      });
      await problema(
        await arnes.pedir(`/controles/${c.id}`, t, "PUT", {
          versionEsperada: 1,
          nombre: "Pisada",
        }),
        409,
        "conflicto",
      );
      expect(estado.eventos.map((e) => e.accion)).toEqual([
        "control.creado",
        "control.cambiado",
      ]);
    });

    it("orden 401 → 403 → 400 → 404 → 409", async () => {
      const t = await tAdmin();
      const c = await creado(t);
      await problema(
        await arnes.pedir(`/controles/${c.id}`, await tColab(), "PUT", {
          versionEsperada: 1,
          nombre: "x",
        }),
        403,
        "sin_permiso",
      );
      await problema(
        await arnes.pedir("/controles/no-es-uuid", t, "PUT", {
          versionEsperada: 1,
        }),
        400,
        "parametro_invalido",
      );
      await problema(
        await arnes.pedir(`/controles/${c.id}`, t, "PUT", {
          nombre: "sin versión",
        }),
        400,
        "parametro_invalido",
      );
      await problema(
        await arnes.pedir(`/controles/${c.id}`, t, "PUT", {
          versionEsperada: 1,
          nombre: "",
        }),
        400,
        "parametro_invalido",
      );
      await problema(
        await arnes.pedir(`/controles/${ID_FALSO}`, t, "PUT", {
          versionEsperada: 1,
          nombre: "x",
        }),
        404,
        "no_encontrado",
      );
      await problema(
        await arnes.pedir(`/controles/${c.id}`, t, "PUT", {
          versionEsperada: 9,
          nombre: "x",
        }),
        409,
        "conflicto",
      );
    });

    it("retira, queda congelado (409) y retirar otra vez es 409", async () => {
      const t = await tAdmin();
      const c = await creado(t);
      const r = await arnes.pedir(`/controles/${c.id}/retiro`, t, "POST", {
        versionEsperada: 1,
      });
      expect(r.status).toBe(200);
      expect(erroresDeEsquema("Control", await cuerpo(r))).toEqual([]);
      await problema(
        await arnes.pedir(`/controles/${c.id}`, t, "PUT", {
          versionEsperada: 2,
          nombre: "x",
        }),
        409,
        "conflicto",
      );
      await problema(
        await arnes.pedir(`/controles/${c.id}/retiro`, t, "POST", {
          versionEsperada: 2,
        }),
        409,
        "conflicto",
      );
    });

    it("aislamiento: un control de A es 404 para B, igual que uno inexistente, y B no cambia nada", async () => {
      const c = await creado();
      const tb = await tAdminB();
      const cruzado = await arnes.pedir(`/controles/${c.id}`, tb, "PUT", {
        versionEsperada: 1,
        nombre: "intruso",
      });
      const inexistente = await arnes.pedir(
        `/controles/${ID_FALSO}`,
        tb,
        "PUT",
        { versionEsperada: 1, nombre: "intruso" },
      );
      expect([cruzado.status, await cuerpo(cruzado)]).toEqual([
        inexistente.status,
        await cuerpo(inexistente),
      ]);
      await problema(
        await arnes.pedir(`/controles/${c.id}/retiro`, tb, "POST", {
          versionEsperada: 1,
        }),
        404,
        "no_encontrado",
      );
      expect(estado.controles.get(c.id)).toMatchObject({
        nombre: "Política de contraseñas",
        estado: "vigente",
      });
    });
  });

  describe("mapeos", () => {
    it("201 la primera vez, 200 si ya existía, y 204 al quitar", async () => {
      const t = await tAdmin();
      const c = await creado(t);
      const r1 = await arnes.pedir(`/controles/${c.id}/mapeos`, t, "POST", POL);
      expect(r1.status).toBe(201);
      const m1 = (await cuerpo(r1)) as Record<string, unknown>;
      expect(m1).toEqual({ ...POL, creado: true });
      expect(erroresDeEsquema("MapeoResultado", m1)).toEqual([]);
      const r2 = await arnes.pedir(`/controles/${c.id}/mapeos`, t, "POST", POL);
      expect(r2.status).toBe(200);
      expect(await cuerpo(r2)).toEqual({ ...POL, creado: false });
      const q = await arnes.pedir(
        `/controles/${c.id}/mapeos/eliminacion`,
        t,
        "POST",
        POL,
      );
      expect(q.status).toBe(204);
      expect(q.headers.get("cache-control")).toBe("no-store");
      expect(await q.text()).toBe("");
      await problema(
        await arnes.pedir(
          `/controles/${c.id}/mapeos/eliminacion`,
          t,
          "POST",
          POL,
        ),
        404,
        "no_encontrado",
      );
      expect(estado.eventos.map((e) => e.accion)).toEqual([
        "control.creado",
        "mapeo.creado",
        "mapeo.eliminado",
      ]);
      expect(estado.eventos.at(-1)!.objeto).toBe("mapeo:C-001.a27-5-1");
    });

    it("una entrada que la empresa no adoptó es 404 (igual que un control ajeno); 403 antes que 400", async () => {
      const t = await tAdmin();
      const c = await creado(t);
      await problema(
        await arnes.pedir(`/controles/${c.id}/mapeos`, t, "POST", {
          libreriaCodigo: "otra-libreria",
          idEstable: "x-1",
        }),
        404,
        "no_encontrado",
      );
      await problema(
        await arnes.pedir(
          `/controles/${c.id}/mapeos`,
          await tAdminB(),
          "POST",
          POL,
        ),
        404,
        "no_encontrado",
      );
      await problema(
        await arnes.pedir(
          `/controles/${c.id}/mapeos`,
          await tColab(),
          "POST",
          [1],
        ),
        403,
        "sin_permiso",
      );
      await problema(
        await arnes.pedir(`/controles/${c.id}/mapeos`, t, "POST", {
          libreriaCodigo: "ISO",
          idEstable: "../x",
        }),
        400,
        "parametro_invalido",
      );
      await problema(
        await arnes.pedir("/controles/no-uuid/mapeos", t, "POST", POL),
        400,
        "parametro_invalido",
      );
      expect(estado.mapeos.size).toBe(0);
    });

    it("un control retirado no recibe ni pierde mapeos (409)", async () => {
      const t = await tAdmin();
      const c = await creado(t);
      await arnes.pedir(`/controles/${c.id}/mapeos`, t, "POST", POL);
      await arnes.pedir(`/controles/${c.id}/retiro`, t, "POST", {
        versionEsperada: 1,
      });
      await problema(
        await arnes.pedir(`/controles/${c.id}/mapeos`, t, "POST", CTX),
        409,
        "conflicto",
      );
      await problema(
        await arnes.pedir(
          `/controles/${c.id}/mapeos/eliminacion`,
          t,
          "POST",
          POL,
        ),
        409,
        "conflicto",
      );
      expect(estado.mapeos.size).toBe(1);
    });

    it("si falla la bitácora, el mapeo no queda y responde 500", async () => {
      const t = await tAdmin();
      const c = await creado(t);
      estado.fallarBitacora = true;
      await problema(
        await arnes.pedir(`/controles/${c.id}/mapeos`, t, "POST", POL),
        500,
        "error_interno",
      );
      expect(estado.mapeos.size).toBe(0);
    });
  });
});
