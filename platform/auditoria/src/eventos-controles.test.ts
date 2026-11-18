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
  // Riesgos mínimos (ADR 037): también solo el hecho y el objeto.
  "riesgo.creado",
  "riesgo.cambiado",
  "riesgo.retirado",
  "vinculo.creado",
  "vinculo.eliminado",
  "motivo.creado",
  "motivo.cambiado",
  "motivo.eliminado",
  "referencia.creada",
  "referencia.cambiada",
  "referencia.eliminada",
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
      "titulo",
      "probabilidad",
      "impacto",
      "nota",
      "ubicacion",
      "version_doc",
      "fecha",
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

describe("el objeto de un vínculo, un motivo o una referencia solo es un identificador, nunca texto de la empresa", () => {
  it.each([
    ["vinculo.creado", "vinculo:R-001.C-001"],
    ["vinculo.eliminado", "vinculo:R-001.a27-5-1"],
    ["vinculo.creado", "vinculo:R-001.C.1.2"],
    ["motivo.creado", "motivo:a27-5-1.legal"],
    ["motivo.cambiado", "motivo:a27-5-1.otro"],
    ["motivo.eliminado", "motivo:a27-5-1.negocio"],
    ["referencia.creada", "referencia:iso-iec-27001.plan"],
    ["referencia.cambiada", "referencia:iso-iec-27001.analisis"],
    ["referencia.eliminada", "referencia:iso-iec-27001.plan"],
  ] as const)("%s acepta su identificador (%s)", (accion, objeto) => {
    expect(() => validarEvento({ ...ejemplos[accion], objeto })).not.toThrow();
  });

  it.each([
    ["vinculo.creado", "vinculo:Pérdida de portátiles.C-001"],
    ["vinculo.creado", "vinculo:R-001."],
    ["vinculo.eliminado", "vinculo:R 001/C 001"],
    ["motivo.creado", "motivo:Nota con nombre y apellido.legal"],
    ["motivo.cambiado", "motivo:Ley de datos personales de Ana Pérez"],
    ["motivo.eliminado", "motivo:"],
    ["referencia.creada", "referencia:título libre.plan"],
    ["referencia.cambiada", "referencia:Plan 2026 (carpeta Calidad)"],
    ["referencia.eliminada", "referencia:"],
  ] as const)("%s rechaza el texto libre (%s)", (accion, objeto) => {
    rechaza({ ...ejemplos[accion], objeto });
  });

  it("ninguna de estas acciones admite el texto en `objetoVersion`, `antes` ni `despues`", () => {
    for (const accion of ["vinculo.creado", "motivo.creado", "referencia.creada"] as const) {
      rechaza({ ...ejemplos[accion], despues: { nota: "texto libre" } });
      rechaza({ ...ejemplos[accion], antes: { titulo: "texto libre" } });
      rechaza({ ...ejemplos[accion], objetoVersion: "texto libre" });
    }
  });
});

describe("el objeto de un riesgo", () => {
  it("acepta el código correlativo y rechaza lo que no es un identificador", () => {
    expect(() => validarEvento({ ...ejemplos["riesgo.creado"], objeto: "riesgo:R-001" })).not.toThrow();
    rechaza({ ...ejemplos["riesgo.creado"], objeto: "riesgo:Pérdida de portátiles" });
    rechaza({ ...ejemplos["riesgo.creado"], objeto: "riesgo:" });
  });
});
