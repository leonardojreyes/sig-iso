// @vitest-environment node
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AlmacenAcceso } from "../auth/almacen-acceso";
import { leerConfiguracion } from "../auth/configuracion";
import type { ResultadoCallback } from "../auth/flujo";
import { crearServicioSesion } from "../auth/sesion";
import {
  descargarEvidencia,
  eliminarEvidencia,
  reemplazarEvidencia,
  subirEvidencia,
} from "./escribir";

const config = leerConfiguracion({
  OIDC_CLIENT_SECRET: randomBytes(18).toString("base64url"),
  SESSION_SEALING_KEY: randomBytes(32).toString("base64url"),
});
const AHORA = new Date("2026-11-11T10:00:00Z");
const CONTROL = "cccccccc-1111-4111-8111-111111111111";
const EVIDENCIA = "eeeeeeee-1111-4111-8111-111111111111";
const callbackOk = (): Extract<ResultadoCallback, { ok: true }> => ({
  ok: true,
  tokens: {
    acceso: "acceso-inicial",
    refresco: "refresco-0",
    id: "id.token.firmado",
  },
  identidad: {
    sub: "5eed0001-0000-4000-8000-0000000000a1",
    sid: "sesion-kc-1",
  },
  retorno: "/",
  limpiarCookie: "sig-oidc=; Max-Age=0",
});

interface Llamada {
  metodo: string;
  ruta: string;
  autorizacion: string | null;
  tipoContenido: string | null;
  /** Los campos de un multipart EN ORDEN; los archivos como `archivo:<nombre>:<bytes>`. */
  campos: [string, string][] | null;
  cuerpoVacio: boolean;
}

const montar = async (
  api: { estado?: number | "lanza"; respuesta?: () => Response } = {},
) => {
  const llamadas: Llamada[] = [];
  const fetchFn = (async (url: string, init: RequestInit = {}) => {
    if (url.startsWith(`${config.apiUrl}/sesion/`))
      return new Response(null, { status: 204 });
    if (!url.startsWith(config.apiUrl))
      return new Response(null, { status: 404 });
    const cabeceras = new Headers(init.headers);
    const cuerpo = init.body;
    llamadas.push({
      metodo: init.method ?? "GET",
      ruta: url.replace(config.apiUrl, ""),
      autorizacion: cabeceras.get("authorization"),
      tipoContenido: cabeceras.get("content-type"),
      campos:
        cuerpo instanceof FormData
          ? [...cuerpo.entries()].map(([k, v]) => [
              k,
              typeof v === "string" ? v : `archivo:${v.name}:${v.size}`,
            ])
          : null,
      cuerpoVacio: cuerpo === undefined || cuerpo === null,
    });
    if (api.estado === "lanza") throw new Error("ECONNREFUSED");
    if (api.respuesta) return api.respuesta();
    return new Response(api.estado === 204 ? null : "{}", {
      status: api.estado ?? 201,
    });
  }) as unknown as typeof fetch;
  const deps = {
    config,
    ahora: () => AHORA,
    fetchFn,
    almacen: new AlmacenAcceso(),
  };
  const r = await crearServicioSesion(deps).iniciar(callbackOk());
  const cookie = r.headers
    .getSetCookie()
    .find((c) => c.startsWith(`${config.nombreCookieSesion}=`))!
    .split(";")[0]!;
  llamadas.length = 0;
  const enviar = (
    manejador: typeof subirEvidencia,
    id: string,
    cuerpo: FormData | null,
    o: {
      metodo?: string;
      origen?: string | null;
      cookie?: string | null;
      slug?: string;
      verificado?: string | null;
      cabeceras?: Record<string, string>;
    } = {},
  ) => {
    const {
      metodo = "POST",
      origen = config.origen,
      cookie: c = cookie,
      slug = "empresa-a",
      verificado = "empresa-a",
    } = o;
    const peticion = new Request(`${config.origen}/e/${slug}/x/${id}`, {
      method: metodo,
      headers: {
        ...(origen === null ? {} : { origin: origen }),
        ...(c ? { cookie: c } : {}),
        ...(o.cabeceras ?? {}),
      },
      ...(metodo === "GET" || metodo === "HEAD" || cuerpo === null
        ? {}
        : { body: cuerpo }),
    });
    return manejador(peticion, {
      slugDeLaDireccion: slug,
      slugVerificado: verificado,
      deps,
      id,
    });
  };
  return { llamadas, enviar, deps, cookie };
};

const destino = (r: Response): URL => new URL(r.headers.get("location")!);
const aviso = (r: Response) => destino(r).searchParams.get("aviso");
const pdf = (nombre = "politica.pdf", bytes = 1234) =>
  new File([new Uint8Array(bytes).fill(0x41)], nombre, {
    type: "application/pdf",
  });
const formulario = (
  campos: Record<string, string> = {},
  archivo: File | null = pdf(),
  archivoPrimero = false,
) => {
  const f = new FormData();
  if (archivoPrimero && archivo) f.append("archivo", archivo);
  for (const [k, v] of Object.entries({
    tipo: "documento",
    titulo: "  Política de contraseñas  ",
    fechaHecho: "2026-11-01",
    ...campos,
  }))
    f.append(k, v);
  if (!archivoPrimero && archivo) f.append("archivo", archivo);
  return f;
};

describe("subir una evidencia desde la web", () => {
  it("reenvía a la API un multipart con SOLO los campos conocidos, los de texto primero y el archivo al final", async () => {
    const { enviar, llamadas } = await montar();
    const f = formulario(
      {
        vigenteHasta: "2027-06-30",
        empresaId: "otra",
        estado: "eliminada",
        archivoId: "../../x",
      },
      pdf("mi politica.pdf", 777),
      true,
    ); // el navegador mandó el archivo PRIMERO
    const r = await enviar(subirEvidencia, CONTROL, f);
    expect(r.status).toBe(303);
    expect(destino(r).pathname).toBe(`/e/empresa-a/controles/${CONTROL}`);
    expect(aviso(r)).toBe("evidencia_subida");
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]).toMatchObject({
      metodo: "POST",
      ruta: `/controles/${CONTROL}/evidencias`,
      autorizacion: "Bearer acceso-inicial",
      tipoContenido: null,
    });
    expect(llamadas[0]!.campos).toEqual([
      ["tipo", "documento"],
      ["titulo", "Política de contraseñas"],
      ["fechaHecho", "2026-11-01"],
      ["vigenteHasta", "2027-06-30"],
      ["archivo", "archivo:mi politica.pdf:777"],
    ]);
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("un campo vacío (vigencia sin llenar) no viaja", async () => {
    const { enviar, llamadas } = await montar();
    await enviar(subirEvidencia, CONTROL, formulario({ vigenteHasta: "" }));
    expect(llamadas[0]!.campos!.map(([k]) => k)).toEqual([
      "tipo",
      "titulo",
      "fechaHecho",
      "archivo",
    ]);
  });

  it("conserva la vista del historial al volver", async () => {
    const { enviar } = await montar();
    const r = await enviar(
      subirEvidencia,
      CONTROL,
      formulario({ f_historicas: "true" }),
    );
    expect(destino(r).searchParams.get("historicas")).toBe("true");
  });

  it.each([
    [400, "no_valido"],
    [403, "sin_permiso"],
    [404, "no_encontrado"],
    [409, "conflicto"],
    [413, "archivo_grande"],
    [415, "tipo_no_permitido"],
    [500, "no_disponible"],
    ["lanza", "no_disponible"],
  ] as const)(
    "traduce el estado %s de la API al aviso «%s»",
    async (estado, esperado) => {
      const { enviar } = await montar({ estado });
      expect(
        aviso(await enviar(subirEvidencia, CONTROL, formulario())),
        String(estado),
      ).toBe(esperado);
    },
  );

  it("un 401 de la API lleva a ingresar y cierra la sesión", async () => {
    const { enviar } = await montar({ estado: 401 });
    const r = await enviar(subirEvidencia, CONTROL, formulario());
    expect(destino(r).pathname).toBe("/auth/login");
    expect(destino(r).searchParams.get("retorno")).toBe(
      `/e/empresa-a/controles/${CONTROL}`,
    );
  });

  describe("lo que no es válido se rechaza en la web, sin llamar a la API", () => {
    it.each([
      ["sin archivo", formulario({}, null)],
      ["con un archivo vacío", formulario({}, new File([], "vacio.pdf"))],
      ["sin título", formulario({ titulo: "   " })],
      [
        "con un título de más de 120 caracteres",
        formulario({ titulo: "x".repeat(121) }),
      ],
      ["con un tipo de evidencia desconocido", formulario({ tipo: "otro" })],
      ["sin tipo", formulario({ tipo: "" })],
      ["sin fecha del hecho", formulario({ fechaHecho: "" })],
      [
        "con una fecha con otro formato",
        formulario({ fechaHecho: "01/11/2026" }),
      ],
      [
        "con una vigencia con otro formato",
        formulario({ vigenteHasta: "mañana" }),
      ],
    ])("%s: aviso «no_valido»", async (_n, f) => {
      const { enviar, llamadas } = await montar();
      expect(aviso(await enviar(subirEvidencia, CONTROL, f))).toBe("no_valido");
      expect(llamadas).toEqual([]);
    });

    it("un archivo de más de 25 MB: «archivo_grande», sin llamar a la API", async () => {
      const { enviar, llamadas } = await montar();
      expect(
        aviso(
          await enviar(
            subirEvidencia,
            CONTROL,
            formulario({}, pdf("grande.pdf", 26_214_401)),
          ),
        ),
      ).toBe("archivo_grande");
      expect(llamadas).toEqual([]);
    });

    it("una petición que ya declara más bytes de los permitidos: «archivo_grande» SIN leer el cuerpo", async () => {
      const { enviar, llamadas } = await montar();
      const r = await enviar(subirEvidencia, CONTROL, formulario(), {
        cabeceras: { "content-length": String(300 * 1024 * 1024) },
      });
      expect(aviso(r)).toBe("archivo_grande");
      expect(llamadas).toEqual([]);
    });

    it("un cuerpo que no es un formulario (multipart roto): «no_valido», sin llamar a la API", async () => {
      const { llamadas, deps, cookie } = await montar();
      const peticion = new Request(`${config.origen}/e/empresa-a/x/${CONTROL}`, {
        method: "POST",
        headers: { origin: config.origen, cookie, "content-type": "multipart/form-data; boundary=x" },
        body: "esto no es multipart",
      });
      const r = await subirEvidencia(peticion, { slugDeLaDireccion: "empresa-a", slugVerificado: "empresa-a", deps, id: CONTROL });
      expect(r.status).toBe(303);
      expect(aviso(r)).toBe("no_valido");
      expect(destino(r).pathname).toBe(`/e/empresa-a/controles/${CONTROL}`);
      expect(llamadas).toEqual([]);
    });
  });

  describe("protecciones del formulario", () => {
    it("GET 405; Origin ausente, «null» o ajeno 403; empresa distinta o ausente 404; identificador que no es UUID 404", async () => {
      const { enviar, llamadas } = await montar();
      expect(
        (await enviar(subirEvidencia, CONTROL, null, { metodo: "GET" })).status,
      ).toBe(405);
      for (const origen of [
        null,
        "null",
        "https://malo.example.test",
        `${config.origen}.malo.example.test`,
      ])
        expect(
          (await enviar(subirEvidencia, CONTROL, formulario(), { origen }))
            .status,
          String(origen),
        ).toBe(403);
      expect(
        (
          await enviar(subirEvidencia, CONTROL, formulario(), {
            verificado: "empresa-b",
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await enviar(subirEvidencia, CONTROL, formulario(), {
            verificado: null,
          })
        ).status,
      ).toBe(404);
      for (const id of ["no-es-uuid", "../../etc", "", `${CONTROL}/../x`])
        expect(
          (await enviar(subirEvidencia, id, formulario())).status,
          id,
        ).toBe(404);
      expect(llamadas).toEqual([]);
    });

    it("sin sesión lleva a ingresar, sin llamar a la API", async () => {
      const { enviar, llamadas } = await montar();
      expect(
        destino(
          await enviar(subirEvidencia, CONTROL, formulario(), { cookie: null }),
        ).pathname,
      ).toBe("/auth/login");
      expect(llamadas).toEqual([]);
    });
  });
});

describe("reemplazar una evidencia desde la web", () => {
  it("reenvía a la ruta de reemplazo con los campos conocidos; título y tipo vacíos no viajan; vuelve al control", async () => {
    const { enviar, llamadas } = await montar();
    const f = formulario({
      titulo: "",
      tipo: "",
      control: CONTROL,
      vigenteHasta: "2028-01-01",
    });
    const r = await enviar(reemplazarEvidencia, EVIDENCIA, f);
    expect(llamadas[0]).toMatchObject({
      metodo: "POST",
      ruta: `/evidencias/${EVIDENCIA}/reemplazo`,
    });
    expect(llamadas[0]!.campos!.map(([k]) => k)).toEqual([
      "fechaHecho",
      "vigenteHasta",
      "archivo",
    ]);
    expect(destino(r).pathname).toBe(`/e/empresa-a/controles/${CONTROL}`);
    expect(aviso(r)).toBe("evidencia_reemplazada");
  });

  it("puede cambiar título y tipo; sin el control de vuelta (o con uno inválido) vuelve a la lista de controles", async () => {
    const { enviar, llamadas } = await montar();
    await enviar(
      reemplazarEvidencia,
      EVIDENCIA,
      formulario({ titulo: "Otro título", tipo: "registro", control: CONTROL }),
    );
    expect(llamadas[0]!.campos!.slice(0, 2)).toEqual([
      ["tipo", "registro"],
      ["titulo", "Otro título"],
    ]);
    expect(
      destino(await enviar(reemplazarEvidencia, EVIDENCIA, formulario({})))
        .pathname,
    ).toBe("/e/empresa-a/controles");
    expect(
      destino(
        await enviar(
          reemplazarEvidencia,
          EVIDENCIA,
          formulario({ control: "../../x" }),
        ),
      ).pathname,
    ).toBe("/e/empresa-a/controles");
  });

  it("traduce 409, 413 y 415, y rechaza sin llamar a la API lo inválido (sin archivo, sin fecha, otro tipo, otro id)", async () => {
    for (const [estado, esperado] of [
      [409, "conflicto"],
      [413, "archivo_grande"],
      [415, "tipo_no_permitido"],
    ] as const) {
      const { enviar } = await montar({ estado });
      expect(
        aviso(
          await enviar(
            reemplazarEvidencia,
            EVIDENCIA,
            formulario({ control: CONTROL }),
          ),
        ),
      ).toBe(esperado);
    }
    const { enviar, llamadas } = await montar();
    for (const f of [
      formulario({}, null),
      formulario({ fechaHecho: "" }),
      formulario({ tipo: "otro" }),
      formulario({ titulo: "x".repeat(121) }),
    ])
      expect(aviso(await enviar(reemplazarEvidencia, EVIDENCIA, f))).toBe(
        "no_valido",
      );
    expect(
      (await enviar(reemplazarEvidencia, "no-es-uuid", formulario())).status,
    ).toBe(404);
    expect(
      (
        await enviar(reemplazarEvidencia, EVIDENCIA, formulario(), {
          origen: null,
        })
      ).status,
    ).toBe(403);
    expect(llamadas).toEqual([]);
  });
});

describe("eliminar una evidencia desde la web", () => {
  const f = (extra: Record<string, string> = {}) => {
    const x = new FormData();
    x.append("control", CONTROL);
    for (const [k, v] of Object.entries(extra)) x.append(k, v);
    return x;
  };

  it("POST sin cuerpo ni Content-Type a la ruta de eliminación; vuelve al control con el aviso", async () => {
    const { enviar, llamadas } = await montar({ estado: 204 });
    const r = await enviar(
      eliminarEvidencia,
      EVIDENCIA,
      f({ f_historicas: "true" }),
    );
    expect(llamadas[0]).toMatchObject({
      metodo: "POST",
      ruta: `/evidencias/${EVIDENCIA}/eliminacion`,
      tipoContenido: null,
      cuerpoVacio: true,
    });
    expect(destino(r).pathname).toBe(`/e/empresa-a/controles/${CONTROL}`);
    expect(aviso(r)).toBe("evidencia_eliminada");
    expect(destino(r).searchParams.get("historicas")).toBe("true");
  });

  it("traduce 403, 404 y 409 y exige Origin, empresa y un UUID", async () => {
    for (const [estado, esperado] of [
      [403, "sin_permiso"],
      [404, "no_encontrado"],
      [409, "conflicto"],
    ] as const) {
      const { enviar } = await montar({ estado });
      expect(aviso(await enviar(eliminarEvidencia, EVIDENCIA, f()))).toBe(
        esperado,
      );
    }
    const { enviar, llamadas } = await montar();
    expect(
      (await enviar(eliminarEvidencia, EVIDENCIA, f(), { metodo: "GET" }))
        .status,
    ).toBe(405);
    expect(
      (
        await enviar(eliminarEvidencia, EVIDENCIA, f(), {
          origen: "https://malo.example.test",
        })
      ).status,
    ).toBe(403);
    expect((await enviar(eliminarEvidencia, "x", f())).status).toBe(404);
    expect(
      (
        await enviar(eliminarEvidencia, EVIDENCIA, f(), {
          verificado: "empresa-b",
        })
      ).status,
    ).toBe(404);
    expect(llamadas).toEqual([]);
  });
});

describe("descargar una evidencia desde la web", () => {
  const bytes = new Uint8Array([
    0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37,
  ]);
  const ok =
    (cabeceras: Record<string, string> = {}) =>
    () =>
      new Response(bytes, {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="politica.pdf"; filename*=UTF-8''politica.pdf`,
          "content-length": String(bytes.length),
          ...cabeceras,
        },
      });

  it("entrega el archivo idéntico como adjunto, pide a la API con el token y NO manda el token al navegador", async () => {
    const { enviar, llamadas } = await montar({ respuesta: ok() });
    const r = await enviar(descargarEvidencia, EVIDENCIA, null, {
      metodo: "GET",
    });
    expect(r.status).toBe(200);
    expect(
      Buffer.compare(Buffer.from(await r.arrayBuffer()), Buffer.from(bytes)),
    ).toBe(0);
    expect(llamadas).toEqual([
      expect.objectContaining({
        metodo: "GET",
        ruta: `/evidencias/${EVIDENCIA}/archivo`,
        autorizacion: "Bearer acceso-inicial",
      }),
    ]);
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("content-disposition")).toMatch(
      /^attachment; filename="politica\.pdf"/,
    );
    expect(r.headers.get("content-length")).toBe(String(bytes.length));
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("content-security-policy")).toBe(
      "default-src 'none'; sandbox",
    );
    expect(JSON.stringify([...r.headers.entries()])).not.toContain(
      "acceso-inicial",
    );
  });

  it("solo reenvía cabeceras de una lista cerrada: nada de lo demás que mande la API", async () => {
    const { enviar } = await montar({
      respuesta: ok({
        "set-cookie": "robada=1",
        "x-evil": "1",
        location: "https://malo.example.test",
        "content-security-policy": "default-src *",
      }),
    });
    const r = await enviar(descargarEvidencia, EVIDENCIA, null, {
      metodo: "GET",
    });
    expect(r.headers.get("x-evil")).toBeNull();
    expect(r.headers.get("location")).toBeNull();
    expect(r.headers.getSetCookie().some((c) => c.includes("robada"))).toBe(
      false,
    );
    expect(r.headers.get("content-security-policy")).toBe(
      "default-src 'none'; sandbox",
    ); // la nuestra, no la de la API
  });

  it("SIEMPRE adjunto: una disposición «inline» (o hostil) de la API se cambia por un adjunto genérico", async () => {
    for (const d of [
      'inline; filename="x.pdf"',
      'attachment; filename="a"; x=y',
      "attachment; filename=\"a\"; filename*=UTF-8''a;b",
      "",
      'attachment; filename="' + "a".repeat(300) + '"',
    ]) {
      const { enviar } = await montar({
        respuesta: ok({ "content-disposition": d }),
      });
      const r = await enviar(descargarEvidencia, EVIDENCIA, null, {
        metodo: "GET",
      });
      expect(r.headers.get("content-disposition"), d).toBe(
        'attachment; filename="archivo"',
      );
    }
  });

  it.each([
    "text/html",
    "image/svg+xml",
    "application/javascript",
    "application/zip",
    "",
    "text/html; charset=utf-8",
  ])(
    "un tipo de contenido fuera de la lista cerrada (%j) no se entrega: «no_disponible»",
    async (tipo) => {
      const { enviar } = await montar({
        respuesta: ok({ "content-type": tipo }),
      });
      const r = await enviar(descargarEvidencia, EVIDENCIA, null, {
        metodo: "GET",
      });
      expect(r.status).toBe(303);
      expect(aviso(r)).toBe("no_disponible");
    },
  );

  it("acepta el tipo con parámetros (text/plain; charset=utf-8) y lo entrega sin ellos", async () => {
    const { enviar } = await montar({
      respuesta: ok({ "content-type": "text/plain; charset=utf-8" }),
    });
    expect(
      (
        await enviar(descargarEvidencia, EVIDENCIA, null, { metodo: "GET" })
      ).headers.get("content-type"),
    ).toBe("text/plain");
  });

  it.each([
    [403, "sin_permiso"],
    [404, "no_encontrado"],
    [500, "no_disponible"],
    [502, "no_disponible"],
  ] as const)(
    "si la API responde %d, vuelve a los controles con el aviso «%s» (y no entrega nada)",
    async (estado, esperado) => {
      const { enviar } = await montar({ estado });
      const r = await enviar(descargarEvidencia, EVIDENCIA, null, {
        metodo: "GET",
      });
      expect(r.status).toBe(303);
      expect(destino(r).pathname).toBe("/e/empresa-a/controles");
      expect(aviso(r)).toBe(esperado);
    },
  );

  it("un 401 de la API lleva a ingresar; sin sesión también; y una caída de la API es «no_disponible»", async () => {
    const { enviar } = await montar({ estado: 401 });
    expect(
      destino(
        await enviar(descargarEvidencia, EVIDENCIA, null, { metodo: "GET" }),
      ).pathname,
    ).toBe("/auth/login");
    const b = await montar();
    expect(
      destino(
        await b.enviar(descargarEvidencia, EVIDENCIA, null, {
          metodo: "GET",
          cookie: null,
        }),
      ).pathname,
    ).toBe("/auth/login");
    expect(b.llamadas).toEqual([]);
    const c = await montar({ estado: "lanza" });
    expect(
      aviso(
        await c.enviar(descargarEvidencia, EVIDENCIA, null, { metodo: "GET" }),
      ),
    ).toBe("no_disponible");
  });

  it("solo GET; empresa distinta o identificador que no es UUID: 404, sin llamar a la API", async () => {
    const { enviar, llamadas } = await montar({ respuesta: ok() });
    expect(
      (
        await enviar(descargarEvidencia, EVIDENCIA, formulario(), {
          metodo: "POST",
        })
      ).status,
    ).toBe(405);
    expect(
      (
        await enviar(descargarEvidencia, EVIDENCIA, null, {
          metodo: "GET",
          verificado: "empresa-b",
        })
      ).status,
    ).toBe(404);
    for (const id of ["x", "../../etc/passwd", `${EVIDENCIA}/../x`])
      expect(
        (await enviar(descargarEvidencia, id, null, { metodo: "GET" })).status,
        id,
      ).toBe(404);
    expect(llamadas).toEqual([]);
  });
});
