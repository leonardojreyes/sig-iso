import { describe, expect, it } from "vitest";
import { EventoBitacoraInvalidoError } from "./dominio/errores";
import { validarEvento } from "./dominio/validacion";
import { ejemplos } from "./prueba/ejemplos";

// Eventos de los controles de la empresa y sus mapeos (MVP, M3). La bitácora guarda el hecho y el objeto, nunca el texto.
const rechaza = (e: unknown) =>
  expect(() => validarEvento(e)).toThrow(EventoBitacoraInvalidoError);
const ACCIONES = [
  "control.creado",
  "control.cambiado",
  "control.retirado",
  "mapeo.creado",
  "mapeo.eliminado",
] as const;

describe.each(ACCIONES)("%s", (accion) => {
  const e = ejemplos[accion];
  it("acepta su ejemplo", () => expect(() => validarEvento(e)).not.toThrow());
  it("exige empresa, objeto y una persona como actor", () => {
    rechaza({ ...e, empresaId: null });
    rechaza({ ...e, objeto: undefined });
    rechaza({ ...e, actor: { tipo: "sistema" } });
  });
  it("solo registra hechos que salieron bien", () => {
    rechaza({ ...e, resultado: "rechazado", motivo: "sin_permiso" });
  });
  it("NUNCA admite el nombre, la descripción ni otro texto", () => {
    for (const clave of [
      "nombre",
      "descripcion",
      "texto",
      "comentario",
      "responsable",
      "correo",
    ]) {
      rechaza({ ...e, despues: { [clave]: "algo" } });
      rechaza({ ...e, antes: { [clave]: "algo" } });
    }
  });
});

describe("el objeto", () => {
  it("acepta el código del control y el mapeo con el id estable", () => {
    expect(() =>
      validarEvento({
        ...ejemplos["control.creado"],
        objeto: "control:ctl.ACC_01-a",
      }),
    ).not.toThrow();
    expect(() =>
      validarEvento({
        ...ejemplos["mapeo.creado"],
        objeto: `mapeo:${"C".repeat(20)}.${"a".repeat(41)}`,
      }),
    ).not.toThrow();
  });
  it("rechaza un objeto con espacios o con un texto libre", () => {
    rechaza({
      ...ejemplos["control.creado"],
      objeto: "control:Política de contraseñas",
    });
    rechaza({ ...ejemplos["mapeo.creado"], objeto: "mapeo:C 1.a27" });
  });
});
