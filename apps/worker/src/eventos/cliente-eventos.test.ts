import { describe, expect, it, vi } from "vitest";
import { ClienteEventosKeycloak, ErrorClienteEventos } from "./cliente-eventos";

const BASE = "http://127.0.0.1:8080";
const evento = (t: number, extra: Record<string, unknown> = {}) => ({
  time: t,
  type: "LOGIN_ERROR",
  clientId: "sigiso-web",
  error: "invalid_user_credentials",
  ipAddress: "203.0.113.9",
  details: { username: "x@example.test" },
  ...extra,
});
const json = (c: unknown, estado = 200) =>
  new Response(JSON.stringify(c), {
    status: estado,
    headers: { "content-type": "application/json" },
  });

interface Llamada {
  url: string;
  metodo: string;
  autorizacion: string | null;
  cuerpo: string | null;
}
const montar = (
  paginas: unknown[][] | ((url: URL) => Response | Promise<Response>),
  opciones: {
    token?: () => Response;
    pagina?: number;
    maxPaginas?: number;
    ahora?: () => Date;
  } = {},
) => {
  const llamadas: Llamada[] = [];
  let indice = 0;
  const fetchFn = (async (u: string, init: RequestInit = {}) => {
    const url = new URL(u);
    llamadas.push({
      url: u,
      metodo: init.method ?? "GET",
      autorizacion: new Headers(init.headers).get("authorization"),
      cuerpo: typeof init.body === "string" ? init.body : null,
    });
    if (url.pathname.endsWith("/protocol/openid-connect/token"))
      return (
        opciones.token ??
        (() =>
          json({
            access_token: `tok-${llamadas.length}`,
            expires_in: 60,
            token_type: "Bearer",
          }))
      )();
    if (typeof paginas === "function") return paginas(url);
    return json(paginas[indice++] ?? []);
  }) as unknown as typeof fetch;
  const cliente = new ClienteEventosKeycloak({
    baseUrl: BASE,
    realm: "sigiso",
    clienteId: "sigiso-events",
    clienteSecreto: "secreto-de-prueba",
    fetchFn,
    tamanoPagina: opciones.pagina ?? 2,
    maxPaginas: opciones.maxPaginas ?? 5,
    ahora: opciones.ahora ?? (() => new Date("2026-11-09T12:00:00Z")),
  });
  return { cliente, llamadas };
};

const DESDE = new Date("2026-11-09T00:00:00Z");

describe("ClienteEventosKeycloak", () => {
  it("obtiene el token con la cuenta de servicio y pide solo eventos LOGIN_ERROR desde la fecha, con el token como Bearer", async () => {
    const { cliente, llamadas } = montar([[evento(1_794_000_000_001)]]);
    await cliente.obtenerIntentosFallidos(DESDE);
    expect(llamadas[0]).toMatchObject({
      metodo: "POST",
      url: `${BASE}/realms/sigiso/protocol/openid-connect/token`,
    });
    expect(
      Object.fromEntries(new URLSearchParams(llamadas[0]!.cuerpo!)),
    ).toEqual({
      grant_type: "client_credentials",
      client_id: "sigiso-events",
      client_secret: "secreto-de-prueba",
    });
    const u = new URL(llamadas[1]!.url);
    expect(`${u.origin}${u.pathname}`).toBe(
      `${BASE}/admin/realms/sigiso/events`,
    );
    expect(u.searchParams.get("type")).toBe("LOGIN_ERROR");
    expect(u.searchParams.get("dateFrom")).toBe("2026-11-09");
    expect(llamadas[1]!.autorizacion).toBe("Bearer tok-1");
  });

  it("devuelve SOLO los campos de la lista blanca, ordenados de más antiguo a más reciente, y descarta lo anterior a la fecha", async () => {
    const antes = DESDE.getTime() - 1;
    const { cliente } = montar([
      [evento(DESDE.getTime() + 5), evento(DESDE.getTime() + 1)],
      [evento(antes)],
    ]);
    const r = await cliente.obtenerIntentosFallidos(DESDE);
    expect(r.map((e) => e.time)).toEqual([
      DESDE.getTime() + 1,
      DESDE.getTime() + 5,
    ]);
    const texto = JSON.stringify(r);
    for (const prohibido of [
      "203.0.113.9",
      "x@example.test",
      "details",
      "ipAddress",
    ])
      expect(texto).not.toContain(prohibido);
  });

  it("recorre las páginas hasta que una viene incompleta (first y max correctos)", async () => {
    const t = DESDE.getTime();
    const { cliente, llamadas } = montar([
      [evento(t + 1), evento(t + 2)],
      [evento(t + 3), evento(t + 4)],
      [evento(t + 5)],
    ]);
    const r = await cliente.obtenerIntentosFallidos(DESDE);
    expect(r).toHaveLength(5);
    const paginas = llamadas
      .filter((l) => l.url.includes("/events"))
      .map((l) => [
        new URL(l.url).searchParams.get("first"),
        new URL(l.url).searchParams.get("max"),
      ]);
    expect(paginas).toEqual([
      ["0", "2"],
      ["2", "2"],
      ["4", "2"],
    ]);
  });

  it("si se pasa del tope de páginas FALLA en vez de devolver una lista recortada (no se pierden eventos en silencio)", async () => {
    const t = DESDE.getTime();
    const llenas = Array.from({ length: 10 }, (_, i) => [
      evento(t + 2 * i + 1),
      evento(t + 2 * i + 2),
    ]);
    const { cliente, llamadas } = montar(llenas, { maxPaginas: 3 });
    await expect(cliente.obtenerIntentosFallidos(DESDE)).rejects.toMatchObject({
      codigo: "demasiadas_paginas",
    });
    expect(llamadas.filter((l) => l.url.includes("/events"))).toHaveLength(3);
  });

  it("reutiliza el token mientras vale y lo renueva al vencer (con margen)", async () => {
    let t = new Date("2026-11-09T12:00:00Z");
    const { cliente, llamadas } = montar([[], [], []], { ahora: () => t });
    await cliente.obtenerIntentosFallidos(DESDE);
    t = new Date(t.getTime() + 20_000);
    await cliente.obtenerIntentosFallidos(DESDE);
    expect(llamadas.filter((l) => l.metodo === "POST")).toHaveLength(1);
    t = new Date(t.getTime() + 20_000); // quedan 20 s de 60: dentro del margen de 30 s
    await cliente.obtenerIntentosFallidos(DESDE);
    expect(llamadas.filter((l) => l.metodo === "POST")).toHaveLength(2);
  });

  it("un 401 en los eventos invalida el token y reintenta UNA vez con uno nuevo", async () => {
    let intentos = 0;
    const { cliente, llamadas } = montar((url) => {
      if (url.pathname.endsWith("/events"))
        return intentos++ === 0 ? json({}, 401) : json([]);
      return json({});
    });
    expect(await cliente.obtenerIntentosFallidos(DESDE)).toEqual([]);
    expect(llamadas.filter((l) => l.metodo === "POST")).toHaveLength(2);
  });

  it("un segundo 401 seguido falla (no hay bucle)", async () => {
    const { cliente } = montar((url) =>
      url.pathname.endsWith("/events") ? json({}, 401) : json({}),
    );
    await expect(cliente.obtenerIntentosFallidos(DESDE)).rejects.toMatchObject({
      codigo: "http_401",
    });
  });

  it.each([
    ["token con error", { token: () => json({}, 500) }, "token_http_500"],
    [
      "token sin access_token",
      { token: () => json({ expires_in: 60 }) },
      "token_invalido",
    ],
    [
      "token con expires_in absurdo",
      { token: () => json({ access_token: "a", expires_in: -5 }) },
      "token_invalido",
    ],
    [
      "token que no es JSON",
      { token: () => new Response("<html>", { status: 200 }) },
      "token_invalido",
    ],
  ] as const)("falla con un código claro: %s", async (_n, opciones, codigo) => {
    const { cliente } = montar([[]], opciones);
    await expect(cliente.obtenerIntentosFallidos(DESDE)).rejects.toMatchObject({
      codigo,
    });
  });

  it.each([
    ["eventos con 403", () => json({}, 403), "http_403"],
    ["eventos con 500", () => json({}, 500), "http_500"],
    [
      "eventos que no son un arreglo",
      () => json({ x: 1 }),
      "respuesta_invalida",
    ],
    [
      "eventos que no son JSON",
      () => new Response("x", { status: 200 }),
      "respuesta_invalida",
    ],
  ] as const)("%s", async (_n, respuesta, codigo) => {
    const { cliente } = montar((url) =>
      url.pathname.endsWith("/events")
        ? respuesta()
        : json({ access_token: "a", expires_in: 60 }),
    );
    await expect(cliente.obtenerIntentosFallidos(DESDE)).rejects.toMatchObject({
      codigo,
    });
  });

  it("la red caída falla con un código, sin repetir la causa ni el secreto", async () => {
    const fetchFn = vi.fn(async () =>
      Promise.reject(new Error("connect ECONNREFUSED secreto-de-prueba")),
    );
    const cliente = new ClienteEventosKeycloak({
      baseUrl: BASE,
      realm: "sigiso",
      clienteId: "sigiso-events",
      clienteSecreto: "secreto-de-prueba",
      fetchFn: fetchFn as never,
    });
    const error = await cliente.obtenerIntentosFallidos(DESDE).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorClienteEventos);
    expect(error.codigo).toBe("red");
    expect(String(error.message)).not.toContain("secreto-de-prueba");
  });

  it("ni el mensaje de error de una respuesta con el secreto lo repite", async () => {
    const { cliente } = montar((url) =>
      url.pathname.endsWith("/events")
        ? json({}, 500)
        : json({ access_token: "el-token-secreto", expires_in: 60 }),
    );
    const error = await cliente.obtenerIntentosFallidos(DESDE).catch((e) => e);
    expect(`${error.message} ${error.codigo}`).not.toMatch(
      /el-token-secreto|secreto-de-prueba/,
    );
  });

  it.each([
    ["dirección que no es http(s)", { baseUrl: "ftp://x" }],
    ["dirección con credenciales", { baseUrl: "http://u:p@127.0.0.1:8080" }],
    ["dirección con consulta", { baseUrl: "http://127.0.0.1:8080?a=1" }],
    ["dirección inválida", { baseUrl: "no es una url" }],
    ["realm con símbolos", { realm: "../master" }],
    ["realm vacío", { realm: "" }],
    ["cuenta vacía", { clienteId: "" }],
    ["secreto vacío", { clienteSecreto: "" }],
  ])("rechaza una configuración inválida: %s", (_n, cambio) => {
    const nuevo = () =>
      new ClienteEventosKeycloak({
        baseUrl: BASE,
        realm: "sigiso",
        clienteId: "sigiso-events",
        clienteSecreto: "s",
        fetchFn: vi.fn() as never,
        ...cambio,
      });
    expect(nuevo).toThrow(/configuración/i);
  });
});
