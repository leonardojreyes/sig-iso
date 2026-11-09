import { describe, expect, it, vi } from "vitest";
import { EventoIdentidadInvalidoError } from "@sig/auditoria";
import type { EventoKeycloak } from "./proyeccion";
import { ErrorClienteEventos } from "./cliente-eventos";
import { sondearIntentos, type DependenciasSondeo } from "./sondeo";

const AHORA = Date.UTC(2026, 10, 9, 12, 0, 0);
const MIN = 60_000;
const DIA = 24 * 60 * MIN;
const ev = (time: number): EventoKeycloak => ({
  time,
  type: "LOGIN_ERROR",
  error: "invalid_user_credentials",
});

const montar = (
  opciones: {
    eventos?: EventoKeycloak[];
    punto?: number | null;
    registrar?: (
      e: unknown,
    ) => Promise<"registrado" | "ya_existia" | "ignorado">;
    cliente?: () => Promise<EventoKeycloak[]>;
  } = {},
) => {
  let punto = opciones.punto ?? null;
  const guardados: number[] = [];
  const pedidos: Date[] = [];
  const avisos: Array<{ ultimoPunto: number; ahora: number }> = [];
  const deps: DependenciasSondeo = {
    cliente: {
      obtenerIntentosFallidos: async (d) => {
        pedidos.push(d);
        return opciones.cliente ? opciones.cliente() : (opciones.eventos ?? []);
      },
    },
    registrar: { ejecutar: opciones.registrar ?? (async () => "registrado") },
    puntoControl: {
      leer: async () => punto,
      guardar: async (h) => {
        punto = h;
        guardados.push(h);
      },
    },
    avisos: {
      huecoDetectado: async (i) => {
        avisos.push(i);
      },
    },
    ahora: () => new Date(AHORA),
  };
  return { deps, guardados, pedidos, avisos };
};

describe("sondearIntentos", () => {
  it("la primera vez mira las últimas 24 horas y guarda la hora del último evento", async () => {
    const m = montar({ eventos: [ev(AHORA - 10 * MIN), ev(AHORA - 5 * MIN)] });
    const r = await sondearIntentos(m.deps);
    expect(m.pedidos[0]!.getTime()).toBe(AHORA - DIA);
    expect(r).toMatchObject({
      leidos: 2,
      registrados: 2,
      yaExistian: 0,
      ignorados: 0,
      invalidos: 0,
      hueco: false,
      puntoControl: AHORA - 5 * MIN,
    });
    expect(m.guardados).toEqual([AHORA - 5 * MIN]);
  });

  it("con punto de control retrocede un solape de 2 minutos (los repetidos los absorbe la idempotencia)", async () => {
    const punto = AHORA - 30 * MIN;
    const m = montar({
      punto,
      eventos: [ev(punto), ev(punto + MIN)],
      registrar: vi
        .fn()
        .mockResolvedValueOnce("ya_existia")
        .mockResolvedValueOnce("registrado"),
    });
    const r = await sondearIntentos(m.deps);
    expect(m.pedidos[0]!.getTime()).toBe(punto - 2 * MIN);
    expect(r).toMatchObject({
      registrados: 1,
      yaExistian: 1,
      puntoControl: punto + MIN,
    });
  });

  it("procesa de más antiguo a más reciente aunque lleguen desordenados", async () => {
    const orden: number[] = [];
    const m = montar({
      eventos: [ev(AHORA - MIN), ev(AHORA - 3 * MIN), ev(AHORA - 2 * MIN)],
      registrar: async (e) => {
        orden.push((e as EventoKeycloak).time);
        return "registrado";
      },
    });
    await sondearIntentos(m.deps);
    expect(orden).toEqual([AHORA - 3 * MIN, AHORA - 2 * MIN, AHORA - MIN]);
  });

  it("sin eventos nuevos no cambia ni guarda el punto de control", async () => {
    const m = montar({ punto: AHORA - MIN, eventos: [] });
    const r = await sondearIntentos(m.deps);
    expect(m.guardados).toEqual([]);
    expect(r.puntoControl).toBe(AHORA - MIN);
  });

  it("el punto de control nunca retrocede (solo eventos viejos del solape)", async () => {
    const punto = AHORA - MIN;
    const m = montar({ punto, eventos: [ev(punto - MIN)] });
    const r = await sondearIntentos(m.deps);
    expect(m.guardados).toEqual([]);
    expect(r.puntoControl).toBe(punto);
  });

  it("un evento exactamente en el punto de control no vuelve a guardarlo", async () => {
    const punto = AHORA - MIN;
    const m = montar({ punto, eventos: [ev(punto)] });
    await sondearIntentos(m.deps);
    expect(m.guardados).toEqual([]);
  });

  it("cuenta los ignorados", async () => {
    const m = montar({
      eventos: [ev(AHORA - MIN)],
      registrar: async () => "ignorado",
    });
    expect(await sondearIntentos(m.deps)).toMatchObject({
      ignorados: 1,
      registrados: 0,
    });
  });

  it("un evento no interpretable se cuenta como inválido, se omite y NO detiene el sondeo", async () => {
    const m = montar({
      eventos: [ev(AHORA - 3 * MIN), ev(AHORA - 2 * MIN), ev(AHORA - MIN)],
      registrar: async (e) => {
        if ((e as EventoKeycloak).time === AHORA - 2 * MIN)
          throw new EventoIdentidadInvalidoError("x");
        return "registrado";
      },
    });
    const r = await sondearIntentos(m.deps);
    expect(r).toMatchObject({
      registrados: 2,
      invalidos: 1,
      puntoControl: AHORA - MIN,
    });
  });

  it("un error transitorio detiene el sondeo, guarda hasta el último éxito y propaga el error", async () => {
    let n = 0;
    const falla = new Error("base caída");
    const m = montar({
      eventos: [ev(AHORA - 3 * MIN), ev(AHORA - 2 * MIN), ev(AHORA - MIN)],
      registrar: async () => {
        if (++n === 2) throw falla;
        return "registrado";
      },
    });
    await expect(sondearIntentos(m.deps)).rejects.toBe(falla);
    expect(m.guardados).toEqual([AHORA - 3 * MIN]);
    expect(n).toBe(2);
  });

  it("si el primero falla no guarda nada", async () => {
    const m = montar({
      eventos: [ev(AHORA - MIN)],
      registrar: async () => {
        throw new Error("x");
      },
    });
    await expect(sondearIntentos(m.deps)).rejects.toThrow("x");
    expect(m.guardados).toEqual([]);
  });

  it("si Keycloak no responde propaga el error sin tocar el punto de control", async () => {
    const m = montar({
      punto: AHORA - MIN,
      cliente: async () => {
        throw new ErrorClienteEventos("red");
      },
    });
    await expect(sondearIntentos(m.deps)).rejects.toMatchObject({
      codigo: "red",
    });
    expect(m.guardados).toEqual([]);
  });

  it("hueco: si el último punto es más viejo que la retención de Keycloak (7 días) avisa y mira desde el límite de retención", async () => {
    const punto = AHORA - 8 * DIA;
    const m = montar({ punto, eventos: [] });
    const r = await sondearIntentos(m.deps);
    expect(r.hueco).toBe(true);
    expect(m.avisos).toEqual([{ ultimoPunto: punto, ahora: AHORA }]);
    expect(m.pedidos[0]!.getTime()).toBe(AHORA - 7 * DIA);
  });

  it("justo en el límite de retención no es hueco", async () => {
    const m = montar({ punto: AHORA - 7 * DIA, eventos: [] });
    expect((await sondearIntentos(m.deps)).hueco).toBe(false);
    expect(m.avisos).toEqual([]);
  });

  it("un fallo al avisar del hueco no impide sondear", async () => {
    const m = montar({ punto: AHORA - 8 * DIA, eventos: [ev(AHORA - MIN)] });
    m.deps.avisos.huecoDetectado = async () => {
      throw new Error("sin canal");
    };
    expect(await sondearIntentos(m.deps)).toMatchObject({
      hueco: true,
      registrados: 1,
    });
  });

  it("respeta solape y retención configurados", async () => {
    const m = montar({ punto: AHORA - 10 * MIN, eventos: [] });
    await sondearIntentos({ ...m.deps, solapeMs: 5 * MIN });
    expect(m.pedidos[0]!.getTime()).toBe(AHORA - 15 * MIN);
    const h = montar({ punto: AHORA - 10 * MIN, eventos: [] });
    expect(
      (await sondearIntentos({ ...h.deps, retencionMs: 5 * MIN })).hueco,
    ).toBe(true);
  });
});
