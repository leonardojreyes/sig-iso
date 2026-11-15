import { request } from "node:http";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AlmacenArchivosLocal } from "@sig/certificacion";
import {
  A,
  ADMIN,
  AlmacenFalso,
  B,
  COLAB,
  EstadoFalso,
  docx,
  docxConMacros,
  ejecutable,
  entradas,
  pdf,
  pdfTruncado,
  png,
  sha256Hex,
  texto,
} from "@sig/certificacion/prueba";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  crearArnes,
  hechosEnMemoria,
  type Arnes,
} from "../autenticacion/prueba/arnes.js";
import { erroresDeEsquema } from "../autenticacion/prueba/contrato.js";
import { CertificacionApiModule } from "./certificacion-api.module.js";
import { opcionesDePrueba } from "./prueba/opciones.js";

// Evidencias con archivo sobre una aplicación Nest REAL: subidas multipart de verdad, el disco real y los casos de uso reales con
// fakes que separan los datos por empresa. Cada respuesta se valida contra los esquemas de openapi.yaml.
const ADMIN_B = "66666666-6666-4666-8666-666666666666";
const SIN_PERMISOS = "99999999-9999-4999-8999-999999999999";
const ID_FALSO = "dddddddd-0000-4000-8000-000000000000";
const POL = {
  libreriaCodigo: entradas.politicas.libreriaCodigo,
  idEstable: entradas.politicas.idEstable,
};
void AlmacenFalso;

describe("evidencias con archivo (MVP M4, paso 4)", () => {
  let arnes: Arnes;
  let estado: EstadoFalso;
  let raiz: string;
  let almacen: AlmacenArchivosLocal;
  let ahora = new Date("2026-11-11T15:00:00Z");
  const bitacora = hechosEnMemoria();
  let sesion = 0;
  const token = (empresa: string, usuario: string) =>
    arnes.firmar(empresa, usuario, { sid: `s-${++sesion}` });
  const tAdmin = () => token(A, ADMIN);
  const tColab = () => token(A, COLAB);
  const tSin = () => token(A, SIN_PERMISOS);
  const tAdminB = () => token(B, ADMIN_B);
  const enDisco = async (empresa: string = A) =>
    readdir(join(raiz, empresa)).catch(() => [] as string[]);
  /**
   * Espera (hasta 3 s) a que el almacén quede vacío. Cuando multer corta una subida por tamaño, la API responde 413 de inmediato y el
   * almacén termina de borrar el temporal un instante DESPUÉS de la respuesta: la prueba no puede mirar el disco en ese segundo. Si el
   * archivo persistiera, esto agota el tiempo y la prueba falla: sería una fuga real.
   */
  const esperarAlmacenVacio = async (
    empresa: string = A,
  ): Promise<string[]> => {
    let actual = await enDisco(empresa);
    for (let i = 0; i < 60 && actual.length > 0; i++) {
      await new Promise((resolver) => setTimeout(resolver, 50));
      actual = await enDisco(empresa);
    }
    return actual;
  };
  const hayTemporales = async () =>
    (await enDisco()).some((f) => f.startsWith("tmp-"));

  beforeAll(async () => {
    raiz = await mkdtemp(join(tmpdir(), "sigiso-api-evi-"));
    almacen = new AlmacenArchivosLocal(raiz);
    estado = new EstadoFalso();
    arnes = await crearArnes({
      hechos: bitacora.hechos,
      modulos: [
        CertificacionApiModule.register(
          opcionesDePrueba({ estado, almacen, reloj: () => ahora }),
        ),
      ],
    });
  });
  afterAll(async () => {
    await arnes.cerrar();
    await rm(raiz, { recursive: true, force: true });
  });
  beforeEach(async () => {
    // Cada prueba parte con el almacén vacío.
    await rm(join(raiz, A), { recursive: true, force: true });
    await rm(join(raiz, B), { recursive: true, force: true });
    for (const m of [
      estado.controles,
      estado.mapeos,
      estado.evaluaciones,
      estado.alcances,
      estado.evidencias,
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
    estado.conceder(
      ADMIN,
      A,
      "controles.ver",
      "controles.gestionar",
      "evidencias.ver",
      "evidencias.registrar",
      "evidencias.eliminar",
    );
    estado.conceder(
      COLAB,
      A,
      "controles.ver",
      "evidencias.ver",
      "evidencias.registrar",
    );
    estado.conceder(
      ADMIN_B,
      B,
      "controles.ver",
      "controles.gestionar",
      "evidencias.ver",
      "evidencias.registrar",
      "evidencias.eliminar",
    );
    bitacora.estado.eventos = [];
    bitacora.estado.falla = false;
    ahora = new Date("2026-11-11T15:00:00Z");
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

  /** Un formulario multipart: los campos de texto y, AL FINAL por omisión, el archivo (la API exige los campos antes). */
  const formulario = (
    campos: Record<string, string | undefined> = {},
    archivo?: { bytes: Uint8Array; nombre?: string; campo?: string },
    archivoPrimero = false,
  ) => {
    const f = new FormData();
    const anadirArchivo = () =>
      archivo &&
      f.append(
        archivo.campo ?? "archivo",
        new Blob([archivo.bytes as BlobPart]),
        archivo.nombre ?? "politica.pdf",
      );
    if (archivoPrimero) anadirArchivo();
    for (const [k, v] of Object.entries({
      tipo: "documento",
      titulo: "TITULO-PRIVADO política",
      fechaHecho: "2026-11-01",
      ...campos,
    }))
      if (v !== undefined) f.append(k, v);
    if (!archivoPrimero) anadirArchivo();
    return f;
  };
  const crearControl = async () =>
    (await cuerpo(
      await arnes.pedir("/controles", await tAdmin(), "POST", {
        codigo: "C-001",
        nombre: "Política de contraseñas",
      }),
    )) as { id: string };
  const subir = async (
    controlId: string,
    bytes: Uint8Array = pdf(),
    campos: Record<string, string | undefined> = {},
    t?: string,
    nombre?: string,
  ) =>
    arnes.pedir(
      `/controles/${controlId}/evidencias`,
      t ?? (await tAdmin()),
      "POST",
      formulario(campos, { bytes, ...(nombre ? { nombre } : {}) }),
    );
  const evidencia = async (
    controlId: string,
    bytes: Uint8Array = pdf(),
    campos: Record<string, string | undefined> = {},
  ) =>
    (await cuerpo(await subir(controlId, bytes, campos))) as {
      id: string;
      archivo: { sha256: string; tipo: string; bytes: number };
    };

  describe("401 sin token: no se lee ni se guarda nada", () => {
    it.each([
      ["GET", `/controles/${ID_FALSO}/evidencias`],
      ["POST", `/controles/${ID_FALSO}/evidencias`],
      ["POST", `/evidencias/${ID_FALSO}/reemplazo`],
      ["POST", `/evidencias/${ID_FALSO}/eliminacion`],
      ["GET", `/evidencias/${ID_FALSO}/archivo`],
      ["GET", "/cobertura"],
    ])("%s %s", async (metodo, ruta) => {
      const cuerpoPeticion =
        metodo === "POST" && ruta.endsWith("/evidencias")
          ? formulario({}, { bytes: pdf() })
          : metodo === "POST" && ruta.endsWith("/reemplazo")
            ? formulario({}, { bytes: pdf() })
            : undefined;
      await problema(
        await arnes.pedir(ruta, undefined, metodo, cuerpoPeticion),
        401,
        "no_autenticado",
      );
      expect(await enDisco()).toEqual([]);
    });
  });

  describe("subir", () => {
    it("crea la evidencia (201), guarda el archivo, la lista y la descarga idéntica, con la huella en la bitácora", async () => {
      const c = await crearControl();
      const bytes = pdf();
      const r = await subir(c.id, bytes, { vigenteHasta: "2027-06-30" });
      expect(r.status).toBe(201);
      expect(r.headers.get("cache-control")).toBe("no-store");
      const e = (await cuerpo(r)) as {
        id: string;
        archivo: { sha256: string; nombre: string };
      };
      expect(erroresDeEsquema("Evidencia", e)).toEqual([]);
      expect(e).toMatchObject({
        controlId: c.id,
        estado: "activa",
        vigente: true,
        vencida: false,
        vigenteHasta: "2027-06-30",
        fechaHecho: "2026-11-01",
        reemplazaId: null,
      });
      expect(e.archivo).toMatchObject({
        nombre: "politica.pdf",
        tipo: "application/pdf",
        bytes: bytes.length,
        sha256: sha256Hex(bytes),
      });
      expect(
        (await enDisco()).filter((f) => !f.startsWith("tmp-")),
      ).toHaveLength(1);
      expect(await hayTemporales()).toBe(false);
      expect(
        estado.eventos.filter((x) => x.accion === "evidencia.creada"),
      ).toEqual([
        expect.objectContaining({
          objeto: `evidencia:${e.id}`,
          objetoVersion: sha256Hex(bytes),
        }),
      ]);
      expect(JSON.stringify(estado.eventos)).not.toMatch(/PRIVADO|política/);

      const lista = (await cuerpo(
        await arnes.pedir(`/controles/${c.id}/evidencias`, await tColab()),
      )) as unknown[];
      expect(lista).toHaveLength(1);
      for (const x of lista)
        expect(erroresDeEsquema("Evidencia", x)).toEqual([]);
    });

    it("un campo vacío (como manda un formulario HTML) es «no enviado»", async () => {
      const c = await crearControl();
      expect((await subir(c.id, pdf(), { vigenteHasta: "" })).status).toBe(201);
    });

    it("el tipo se decide por el contenido: un TXT con nombre .pdf se guarda y se descarga como TXT", async () => {
      const c = await crearControl();
      const r = await subir(
        c.id,
        texto("Registro de la revisión de accesos.\n"),
        {},
        undefined,
        "informe.pdf",
      );
      const e = (await cuerpo(r)) as {
        id: string;
        archivo: { tipo: string; nombre: string };
      };
      expect(e.archivo).toMatchObject({
        tipo: "text/plain",
        nombre: "informe.pdf",
      });
      const d = await arnes.pedir(
        `/evidencias/${e.id}/archivo`,
        await tAdmin(),
      );
      expect(d.headers.get("content-type")).toContain("text/plain");
      expect(d.headers.get("content-disposition")).toContain(
        'filename="informe.txt"',
      );
    });

    it("un nombre de archivo hostil se normaliza y la descarga lo entrega seguro", async () => {
      const c = await crearControl();
      const e = (await cuerpo(
        await subir(
          c.id,
          pdf(),
          {},
          undefined,
          '../../etc/pa"sswd\r\nX-Inyectada: 1.pdf',
        ),
      )) as { id: string; archivo: { nombre: string } };
      expect(e.archivo.nombre).not.toMatch(/[/\\"\r\n]/);
      const d = await arnes.pedir(
        `/evidencias/${e.id}/archivo`,
        await tAdmin(),
      );
      expect(d.headers.get("x-inyectada")).toBeNull();
      expect(d.headers.get("content-disposition")).toMatch(
        /^attachment; filename="[^"\r\n]+"; filename\*=UTF-8''[^\r\n]+$/,
      );
    });

    it("acepta PNG y DOCX", async () => {
      const c = await crearControl();
      expect(
        (
          (await cuerpo(
            await subir(c.id, png(), {}, undefined, "captura.png"),
          )) as { archivo: { tipo: string } }
        ).archivo.tipo,
      ).toBe("image/png");
      expect(
        (
          (await cuerpo(
            await subir(c.id, docx(), {}, undefined, "acta.docx"),
          )) as { archivo: { tipo: string } }
        ).archivo.tipo,
      ).toContain("wordprocessingml");
    });

    it("tres subidas simultáneas al mismo control quedan todas, sin mezclarse", async () => {
      const c = await crearControl();
      const distintos = [texto("uno\n"), texto("dos\n"), texto("tres\n")];
      const r = await Promise.all(distintos.map((b) => subir(c.id, b)));
      expect(r.map((x) => x.status)).toEqual([201, 201, 201]);
      const e = (await Promise.all(r.map((x) => cuerpo(x)))) as {
        archivo: { sha256: string };
      }[];
      expect(e.map((x) => x.archivo.sha256).sort()).toEqual(
        distintos.map((b) => sha256Hex(b)).sort(),
      );
      expect(await hayTemporales()).toBe(false);
    });
  });

  describe("archivos que no se aceptan", () => {
    it.each([
      ["un ejecutable con nombre .pdf", ejecutable(), "factura.pdf"],
      ["un documento con macros", docxConMacros(), "acta.docx"],
      [
        "un HTML con nombre .txt",
        texto("<html><script>alert(1)</script></html>"),
        "nota.txt",
      ],
      [
        "un SVG con nombre .png",
        texto('<svg xmlns="http://www.w3.org/2000/svg"/>'),
        "logo.png",
      ],
      ["un PDF truncado", pdfTruncado(), "informe.pdf"],
    ])(
      "%s: 415, sin fila, sin archivo y con el rechazo en la bitácora",
      async (_n, bytes, nombre) => {
        const c = await crearControl();
        await problema(
          await subir(c.id, bytes, {}, undefined, nombre),
          415,
          "tipo_no_permitido",
        );
        expect(await enDisco()).toEqual([]);
        expect(estado.evidencias.size).toBe(0);
        expect(estado.eventos.map((e) => e.accion)).toEqual([
          "control.creado",
          "evidencia.subida_rechazada",
        ]);
        expect(estado.eventos.at(-1)).toMatchObject({
          resultado: "rechazado",
          objeto: "control:C-001",
          objetoVersion: sha256Hex(bytes),
        });
        expect(JSON.stringify(estado.eventos)).not.toContain(nombre);
      },
    );

    it("uno de más de 25 MB: 413, sin dejar nada en el disco", async () => {
      const c = await crearControl();
      const grande = new Uint8Array(25 * 1024 * 1024 + 100 * 1024).fill(0x41);
      grande.set(texto("%PDF-1.7\n"));
      await problema(
        await subir(c.id, grande),
        413,
        "archivo_demasiado_grande",
      );
      expect(await esperarAlmacenVacio()).toEqual([]);
      expect(estado.evidencias.size).toBe(0);
    });

    it("si la petición ya declara un tamaño enorme: 413 al instante, sin leer el cuerpo y cerrando la conexión", async () => {
      const c = await crearControl();
      const t = await tAdmin();
      const url = new URL(`${arnes.base}/controles/${c.id}/evidencias`);
      const r = await new Promise<{
        status: number;
        conexion: string | undefined;
      }>((resolver, rechazar) => {
        const req = request(
          {
            host: url.hostname,
            port: url.port,
            path: url.pathname,
            method: "POST",
            headers: {
              authorization: `Bearer ${t}`,
              "content-type": "multipart/form-data; boundary=x",
              "content-length": String(300 * 1024 * 1024),
            },
          },
          (res) => {
            res.resume();
            resolver({
              status: res.statusCode ?? 0,
              conexion: res.headers["connection"],
            });
          },
        );
        req.on("error", rechazar);
        req.write("--x\r\n"); // no se manda el resto: la respuesta no debe esperarlo
      });
      expect(r.status).toBe(413);
      expect(r.conexion).toBe("close");
      expect(await enDisco()).toEqual([]);
    });
  });

  describe("peticiones mal formadas", () => {
    it("sin archivo: 400", async () => {
      const c = await crearControl();
      await problema(
        await arnes.pedir(
          `/controles/${c.id}/evidencias`,
          await tAdmin(),
          "POST",
          formulario(),
        ),
        400,
        "parametro_invalido",
      );
    });

    it("dos archivos, o un archivo con otro nombre de campo: 400 y nada guardado", async () => {
      const c = await crearControl();
      const dos = formulario({}, { bytes: pdf() });
      dos.append("archivo", new Blob([pdf() as BlobPart]), "otro.pdf");
      await problema(
        await arnes.pedir(
          `/controles/${c.id}/evidencias`,
          await tAdmin(),
          "POST",
          dos,
        ),
        400,
        "parametro_invalido",
      );
      await problema(
        await arnes.pedir(
          `/controles/${c.id}/evidencias`,
          await tAdmin(),
          "POST",
          formulario({}, { bytes: pdf(), campo: "otro" }),
        ),
        400,
        "parametro_invalido",
      );
      expect(await enDisco()).toEqual([]);
      expect(estado.evidencias.size).toBe(0);
    });

    it.each([
      ["sin título", { titulo: undefined }],
      ["con un tipo de evidencia desconocido", { tipo: "otro" }],
      ["con una fecha inexistente", { fechaHecho: "2026-02-31" }],
      ["con una fecha futura (para Ecuador)", { fechaHecho: "2026-11-12" }],
      ["con una vigencia anterior al hecho", { vigenteHasta: "2026-10-01" }],
    ])("%s: 400 sin leer el archivo", async (_n, campos) => {
      const c = await crearControl();
      await problema(
        await subir(c.id, pdf(), campos),
        400,
        "parametro_invalido",
      );
      expect(await enDisco()).toEqual([]);
    });

    it("con el archivo ANTES de los campos de texto: 400 (la API decide antes de leer el archivo) y nada guardado", async () => {
      const c = await crearControl();
      await problema(
        await arnes.pedir(
          `/controles/${c.id}/evidencias`,
          await tAdmin(),
          "POST",
          formulario({}, { bytes: pdf() }, true),
        ),
        400,
        "parametro_invalido",
      );
      expect(await enDisco()).toEqual([]);
    });

    it("un identificador de control mal formado: 400", async () => {
      await problema(await subir("no-es-uuid"), 400, "parametro_invalido");
    });
  });

  describe("permisos y empresa: se deciden ANTES de escribir en el disco", () => {
    it("sin permiso: 403 y no se guarda ni un byte", async () => {
      const c = await crearControl();
      await problema(
        await subir(c.id, pdf(), {}, await tSin()),
        403,
        "sin_permiso",
      );
      expect(await enDisco()).toEqual([]);
      expect(estado.evidencias.size).toBe(0);
    });

    it("un control inexistente o de otra empresa: 404 indistinguible y nada guardado", async () => {
      const c = await crearControl();
      const ajeno = await subir(c.id, pdf(), {}, await tAdminB());
      const inexistente = await subir(ID_FALSO, pdf(), {}, await tAdminB());
      expect([ajeno.status, await cuerpo(ajeno)]).toEqual([
        inexistente.status,
        await cuerpo(inexistente),
      ]);
      await problema(await subir(ID_FALSO), 404, "no_encontrado");
      expect(await enDisco()).toEqual([]);
      expect(await enDisco(B)).toEqual([]);
    });

    it("un control retirado: 409", async () => {
      const c = await crearControl();
      await arnes.pedir(`/controles/${c.id}/retiro`, await tAdmin(), "POST", {
        versionEsperada: 1,
      });
      await problema(await subir(c.id), 409, "conflicto");
      expect(await enDisco()).toEqual([]);
    });

    it("el colaborador sube, pero no elimina", async () => {
      const c = await crearControl();
      const r = await subir(c.id, pdf(), {}, await tColab());
      expect(r.status).toBe(201);
      const e = (await cuerpo(r)) as { id: string };
      await problema(
        await arnes.pedir(
          `/evidencias/${e.id}/eliminacion`,
          await tColab(),
          "POST",
        ),
        403,
        "sin_permiso",
      );
    });
  });

  describe("subida cortada a la mitad", () => {
    it("no deja ni fila ni archivo ni temporal", async () => {
      const c = await crearControl();
      const t = await tAdmin();
      const url = new URL(`${arnes.base}/controles/${c.id}/evidencias`);
      await new Promise<void>((resolver) => {
        const req = request({
          host: url.hostname,
          port: url.port,
          path: url.pathname,
          method: "POST",
          headers: {
            authorization: `Bearer ${t}`,
            "content-type": "multipart/form-data; boundary=BORDE",
            "transfer-encoding": "chunked",
          },
        });
        req.on("error", () => undefined);
        req.on("close", () => resolver());
        const campo = (n: string, v: string) =>
          `--BORDE\r\nContent-Disposition: form-data; name="${n}"\r\n\r\n${v}\r\n`;
        req.write(
          campo("tipo", "documento") +
            campo("titulo", "Cortada") +
            campo("fechaHecho", "2026-11-01"),
        );
        req.write(
          '--BORDE\r\nContent-Disposition: form-data; name="archivo"; filename="cortada.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.7\n' +
            "A".repeat(50_000),
        );
        setTimeout(() => req.destroy(), 150); // el cliente se va sin terminar
      });
      for (let i = 0; i < 40 && (await hayTemporales()); i++)
        await new Promise((r) => setTimeout(r, 50));
      expect(await hayTemporales()).toBe(false);
      expect(await enDisco()).toEqual([]);
      expect(estado.evidencias.size).toBe(0);
    });
  });

  describe("listar", () => {
    it("solo las activas por omisión; con incluirHistoricas también el historial; el valor inválido es 400", async () => {
      const c = await crearControl();
      const a = await evidencia(c.id);
      await arnes.pedir(
        `/evidencias/${a.id}/eliminacion`,
        await tAdmin(),
        "POST",
      );
      await evidencia(c.id, texto("otra\n"));
      const t = await tAdmin();
      expect(
        (
          (await cuerpo(
            await arnes.pedir(`/controles/${c.id}/evidencias`, t),
          )) as unknown[]
        ).length,
      ).toBe(1);
      expect(
        (
          (await cuerpo(
            await arnes.pedir(
              `/controles/${c.id}/evidencias?incluirHistoricas=true`,
              t,
            ),
          )) as unknown[]
        ).length,
      ).toBe(2);
      await problema(
        await arnes.pedir(
          `/controles/${c.id}/evidencias?incluirHistoricas=quizas`,
          t,
        ),
        400,
        "parametro_invalido",
      );
      await problema(
        await arnes.pedir(
          `/controles/${c.id}/evidencias?incluirHistoricas=true&incluirHistoricas=false`,
          t,
        ),
        400,
        "parametro_invalido",
      );
    });

    it("marca como vencida la que pasó su vigencia (fecha de Ecuador)", async () => {
      const c = await crearControl();
      await evidencia(c.id, pdf(), { vigenteHasta: "2026-11-11" });
      expect(
        (
          (await cuerpo(
            await arnes.pedir(`/controles/${c.id}/evidencias`, await tAdmin()),
          )) as { vigente: boolean }[]
        )[0],
      ).toMatchObject({ vigente: true });
      ahora = new Date("2026-11-12T05:00:00Z"); // medianoche del 12 en Ecuador
      expect(
        (
          (await cuerpo(
            await arnes.pedir(`/controles/${c.id}/evidencias`, await tAdmin()),
          )) as { vigente: boolean; vencida: boolean }[]
        )[0],
      ).toMatchObject({ vigente: false, vencida: true });
    });

    it("403 sin permiso, 400 con un identificador mal formado y 404 de otra empresa", async () => {
      const c = await crearControl();
      await problema(
        await arnes.pedir(`/controles/${c.id}/evidencias`, await tSin()),
        403,
        "sin_permiso",
      );
      await problema(
        await arnes.pedir("/controles/x/evidencias", await tAdmin()),
        400,
        "parametro_invalido",
      );
      await problema(
        await arnes.pedir(`/controles/${c.id}/evidencias`, await tAdminB()),
        404,
        "no_encontrado",
      );
    });
  });

  describe("reemplazar", () => {
    const reemplazo = async (
      id: string,
      bytes: Uint8Array = png(),
      campos: Record<string, string | undefined> = {},
      t?: string,
    ) =>
      arnes.pedir(
        `/evidencias/${id}/reemplazo`,
        t ?? (await tAdmin()),
        "POST",
        formulario(
          {
            tipo: undefined,
            titulo: undefined,
            fechaHecho: "2026-11-10",
            ...campos,
          },
          { bytes, nombre: "nueva.png" },
        ),
      );

    it("201: la anterior queda reemplazada, la nueva la referencia y hereda título y tipo", async () => {
      const c = await crearControl();
      const a = await evidencia(c.id);
      const r = await reemplazo(a.id);
      expect(r.status).toBe(201);
      const n = (await cuerpo(r)) as {
        id: string;
        titulo: string;
        reemplazaId: string;
        archivo: { tipo: string };
      };
      expect(erroresDeEsquema("Evidencia", n)).toEqual([]);
      expect(n).toMatchObject({
        reemplazaId: a.id,
        titulo: "TITULO-PRIVADO política",
      });
      expect(n.archivo.tipo).toBe("image/png");
      const todas = (await cuerpo(
        await arnes.pedir(
          `/controles/${c.id}/evidencias?incluirHistoricas=true`,
          await tAdmin(),
        ),
      )) as { id: string; estado: string }[];
      expect(todas.map((x) => [x.id, x.estado]).sort()).toEqual(
        [
          [a.id, "reemplazada"],
          [n.id, "activa"],
        ].sort(),
      );
      expect((await enDisco()).length).toBe(2); // nada se borra
    });

    it("un archivo rechazado deja la original activa e intacta", async () => {
      const c = await crearControl();
      const a = await evidencia(c.id);
      await problema(
        await reemplazo(a.id, ejecutable()),
        415,
        "tipo_no_permitido",
      );
      expect(estado.evidencias.get(`${A}|${a.id}`)?.evidencia.estado).toBe(
        "activa",
      );
      expect(await hayTemporales()).toBe(false);
    });

    it("409 si ya no está activa, 404 inexistente o de otra empresa, 400 sin fecha del hecho o sin archivo, 403 sin permiso", async () => {
      const c = await crearControl();
      const a = await evidencia(c.id);
      await arnes.pedir(
        `/evidencias/${a.id}/eliminacion`,
        await tAdmin(),
        "POST",
      );
      await problema(await reemplazo(a.id), 409, "conflicto");
      const b = await evidencia(c.id, texto("otra\n"));
      await problema(await reemplazo(ID_FALSO), 404, "no_encontrado");
      await problema(
        await reemplazo(b.id, png(), {}, await tAdminB()),
        404,
        "no_encontrado",
      );
      await problema(
        await reemplazo(b.id, png(), { fechaHecho: undefined }),
        400,
        "parametro_invalido",
      );
      await problema(
        await arnes.pedir(
          `/evidencias/${b.id}/reemplazo`,
          await tAdmin(),
          "POST",
          formulario({ fechaHecho: "2026-11-10" }),
        ),
        400,
        "parametro_invalido",
      );
      await problema(
        await reemplazo(b.id, png(), {}, await tSin()),
        403,
        "sin_permiso",
      );
      expect(estado.evidencias.get(`${A}|${b.id}`)?.evidencia.estado).toBe(
        "activa",
      );
    });
  });

  describe("eliminar", () => {
    it("204 sin cuerpo; deja el archivo; eliminar otra vez es 409", async () => {
      const c = await crearControl();
      const a = await evidencia(c.id);
      const r = await arnes.pedir(
        `/evidencias/${a.id}/eliminacion`,
        await tAdmin(),
        "POST",
      );
      expect(r.status).toBe(204);
      expect(await r.text()).toBe("");
      expect(r.headers.get("cache-control")).toBe("no-store");
      expect((await enDisco()).length).toBe(1);
      await problema(
        await arnes.pedir(
          `/evidencias/${a.id}/eliminacion`,
          await tAdmin(),
          "POST",
        ),
        409,
        "conflicto",
      );
      expect(
        estado.eventos.filter((e) => e.accion === "evidencia.eliminada"),
      ).toEqual([
        expect.objectContaining({
          objeto: `evidencia:${a.id}`,
          objetoVersion: a.archivo.sha256,
        }),
      ]);
    });

    it("orden 401 → 403 → 400 → 404", async () => {
      const c = await crearControl();
      const a = await evidencia(c.id);
      await problema(
        await arnes.pedir(
          `/evidencias/${a.id}/eliminacion`,
          await tSin(),
          "POST",
        ),
        403,
        "sin_permiso",
      );
      await problema(
        await arnes.pedir(
          "/evidencias/no-es-uuid/eliminacion",
          await tAdmin(),
          "POST",
        ),
        400,
        "parametro_invalido",
      );
      await problema(
        await arnes.pedir(
          `/evidencias/${ID_FALSO}/eliminacion`,
          await tAdmin(),
          "POST",
        ),
        404,
        "no_encontrado",
      );
      await problema(
        await arnes.pedir(
          `/evidencias/${a.id}/eliminacion`,
          await tAdminB(),
          "POST",
        ),
        404,
        "no_encontrado",
      );
      expect(estado.evidencias.get(`${A}|${a.id}`)?.evidencia.estado).toBe(
        "activa",
      );
    });
  });

  describe("descargar", () => {
    it("entrega el archivo idéntico, como adjunto, con el tipo detectado y las cabeceras de seguridad, y deja el hecho", async () => {
      const c = await crearControl();
      const bytes = pdf();
      const e = await evidencia(c.id, bytes);
      estado.eventos = [];
      const r = await arnes.pedir(
        `/evidencias/${e.id}/archivo`,
        await tColab(),
      );
      expect(r.status).toBe(200);
      expect(
        Buffer.compare(Buffer.from(await r.arrayBuffer()), Buffer.from(bytes)),
      ).toBe(0);
      expect(r.headers.get("content-type")).toBe("application/pdf");
      expect(r.headers.get("content-length")).toBe(String(bytes.length));
      expect(r.headers.get("content-disposition")).toMatch(
        /^attachment; filename="politica\.pdf"/,
      );
      expect(r.headers.get("x-content-type-options")).toBe("nosniff");
      expect(r.headers.get("cache-control")).toBe("no-store");
      expect(r.headers.get("content-security-policy")).toBe(
        "default-src 'none'; sandbox",
      );
      expect(estado.eventos).toEqual([
        expect.objectContaining({
          accion: "evidencia.descargada",
          objeto: `evidencia:${e.id}`,
          objetoVersion: sha256Hex(bytes),
        }),
      ]);
    });

    it("una reemplazada se descarga (historial); una eliminada, no", async () => {
      const c = await crearControl();
      const a = await evidencia(c.id);
      await arnes.pedir(
        `/evidencias/${a.id}/reemplazo`,
        await tAdmin(),
        "POST",
        formulario(
          { tipo: undefined, titulo: undefined, fechaHecho: "2026-11-10" },
          { bytes: png(), nombre: "n.png" },
        ),
      );
      expect(
        (await arnes.pedir(`/evidencias/${a.id}/archivo`, await tAdmin()))
          .status,
      ).toBe(200);
      const b = await evidencia(c.id, texto("otra\n"));
      await arnes.pedir(
        `/evidencias/${b.id}/eliminacion`,
        await tAdmin(),
        "POST",
      );
      await problema(
        await arnes.pedir(`/evidencias/${b.id}/archivo`, await tAdmin()),
        404,
        "no_encontrado",
      );
    });

    it("403 sin permiso, 400 mal formado, 404 inexistente o de otra empresa (sin entregar nada)", async () => {
      const c = await crearControl();
      const e = await evidencia(c.id);
      await problema(
        await arnes.pedir(`/evidencias/${e.id}/archivo`, await tSin()),
        403,
        "sin_permiso",
      );
      await problema(
        await arnes.pedir("/evidencias/x/archivo", await tAdmin()),
        400,
        "parametro_invalido",
      );
      const ajeno = await arnes.pedir(
        `/evidencias/${e.id}/archivo`,
        await tAdminB(),
      );
      const inexistente = await arnes.pedir(
        `/evidencias/${ID_FALSO}/archivo`,
        await tAdminB(),
      );
      expect([ajeno.status, await cuerpo(ajeno)]).toEqual([
        inexistente.status,
        await cuerpo(inexistente),
      ]);
    });

    it("si no se puede registrar la descarga, no se entrega el archivo (500)", async () => {
      const c = await crearControl();
      const e = await evidencia(c.id);
      estado.fallarBitacora = true;
      const r = await arnes.pedir(
        `/evidencias/${e.id}/archivo`,
        await tAdmin(),
      );
      await problema(r, 500, "error_interno");
    });
  });

  describe("cobertura", () => {
    it("una evidencia en un control cubre todas las entradas que mapea (200 con la forma del contrato)", async () => {
      const c = await crearControl();
      await arnes.pedir(
        `/controles/${c.id}/mapeos`,
        await tAdmin(),
        "POST",
        POL,
      );
      await arnes.pedir(`/controles/${c.id}/mapeos`, await tAdmin(), "POST", {
        libreriaCodigo: entradas.contexto.libreriaCodigo,
        idEstable: entradas.contexto.idEstable,
      });
      const antes = (await cuerpo(
        await arnes.pedir("/cobertura", await tColab()),
      )) as { entradas: { idEstable: string; estado: string }[] };
      expect(antes.entradas.map((e) => [e.idEstable, e.estado])).toEqual([
        ["ha-4.1", "sin_evidencia"],
        ["a27-5-1", "sin_evidencia"],
        ["a27-5-2", "sin_control"],
      ]);
      await evidencia(c.id);
      const r = await arnes.pedir("/cobertura", await tColab());
      expect(r.headers.get("cache-control")).toBe("no-store");
      const d = (await cuerpo(r)) as {
        hoy: string;
        entradas: { idEstable: string; estado: string }[];
        total: { total: number; cubiertas: number; porcentaje: number };
      };
      expect(erroresDeEsquema("Cobertura", d)).toEqual([]);
      expect(d.hoy).toBe("2026-11-11");
      expect(d.entradas.map((e) => [e.idEstable, e.estado])).toEqual([
        ["ha-4.1", "cubierta"],
        ["a27-5-1", "cubierta"],
        ["a27-5-2", "sin_control"],
      ]);
      expect(d.total).toMatchObject({ total: 3, cubiertas: 2, porcentaje: 67 });
    });

    it("filtra por norma; 400 con una norma inválida o repetida; 403 sin permiso; B no ve lo de A", async () => {
      const c = await crearControl();
      await arnes.pedir(`/controles/${c.id}/mapeos`, await tAdmin(), "POST", {
        libreriaCodigo: entradas.contexto.libreriaCodigo,
        idEstable: entradas.contexto.idEstable,
      });
      await evidencia(c.id);
      const sola = (await cuerpo(
        await arnes.pedir(
          `/cobertura?norma=${encodeURIComponent("ISO 9001")}`,
          await tAdmin(),
        ),
      )) as { entradas: { idEstable: string }[] };
      expect(sola.entradas.map((e) => e.idEstable)).toEqual(["ha-4.1"]);
      await problema(
        await arnes.pedir("/cobertura?norma=%3Cscript%3E", await tAdmin()),
        400,
        "parametro_invalido",
      );
      await problema(
        await arnes.pedir("/cobertura?norma=a&norma=b", await tAdmin()),
        400,
        "parametro_invalido",
      );
      await problema(
        await arnes.pedir("/cobertura", await tSin()),
        403,
        "sin_permiso",
      );
      const deB = (await cuerpo(
        await arnes.pedir("/cobertura", await tAdminB()),
      )) as { entradas: { estado: string }[]; total: { cubiertas: number } };
      expect(deB.entradas.map((e) => e.estado)).toEqual(["sin_control"]);
      expect(deB.total.cubiertas).toBe(0);
    });
  });
});
