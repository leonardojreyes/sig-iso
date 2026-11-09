import { describe, expect, it } from "vitest";
import { proyectarEvento } from "./proyeccion";

const USUARIO = "5eed0001-0000-4000-8000-0000000000a1";

describe("proyectarEvento (lista blanca: solo tipo, hora, error, cuenta y aplicación)", () => {
  it("conserva únicamente los campos permitidos", () => {
    const crudo = {
      id: "x",
      time: 1_794_000_000_000,
      type: "LOGIN_ERROR",
      realmId: "r",
      clientId: "sigiso-web",
      userId: USUARIO,
      ipAddress: "203.0.113.9",
      error: "invalid_user_credentials",
      details: {
        username: "persona@example.test",
        auth_method: "openid-connect",
      },
    };
    expect(proyectarEvento(crudo)).toEqual({
      time: 1_794_000_000_000,
      type: "LOGIN_ERROR",
      clientId: "sigiso-web",
      userId: USUARIO,
      error: "invalid_user_credentials",
    });
  });

  it("NUNCA copia la dirección de red, el nombre de usuario tecleado ni los detalles (ni en ningún otro campo)", () => {
    const p = JSON.stringify(
      proyectarEvento({
        time: 1_794_000_000_000,
        type: "LOGIN_ERROR",
        ipAddress: "203.0.113.9",
        details: { username: "persona@example.test" },
        username: "persona",
        sessionId: "s",
        extra: "x",
      }),
    );
    for (const prohibido of [
      "203.0.113.9",
      "persona",
      "username",
      "ipAddress",
      "details",
      "sessionId",
      "extra",
    ])
      expect(p).not.toContain(prohibido);
  });

  it("omite los campos permitidos que no vienen o no son texto/número", () => {
    expect(
      proyectarEvento({ time: 1_794_000_000_000, type: "LOGIN_ERROR" }),
    ).toEqual({ time: 1_794_000_000_000, type: "LOGIN_ERROR" });
    expect(
      proyectarEvento({
        time: 1_794_000_000_000,
        type: "LOGIN_ERROR",
        userId: 5,
        error: { x: 1 },
        clientId: ["a"],
      }),
    ).toEqual({ time: 1_794_000_000_000, type: "LOGIN_ERROR" });
  });

  it("limita el largo de los textos (no se arrastra basura)", () => {
    const p = proyectarEvento({
      time: 1_794_000_000_000,
      type: "LOGIN_ERROR",
      clientId: "a".repeat(500),
      error: "b".repeat(500),
    });
    expect(p?.clientId).toBeUndefined();
    expect(p?.error).toBeUndefined();
  });

  it.each([
    ["null", null],
    ["un texto", "x"],
    ["un arreglo", []],
    ["sin hora", { type: "LOGIN_ERROR" }],
    ["hora que no es entera", { time: 1.5, type: "LOGIN_ERROR" }],
    ["hora como texto", { time: "1794000000000", type: "LOGIN_ERROR" }],
    ["sin tipo", { time: 1_794_000_000_000 }],
    ["tipo que no es texto", { time: 1_794_000_000_000, type: 5 }],
  ])("descarta un evento inservible: %s", (_n, crudo) => {
    expect(proyectarEvento(crudo)).toBeNull();
  });
});
