import { describe, expect, it } from "vitest";
import {
  ACCIONES,
  CATALOGO,
  esClaveProhibida,
  MOTIVOS,
} from "./dominio/catalogo";
import { EventoBitacoraInvalidoError } from "./dominio/errores";
import { validarEvento } from "./dominio/validacion";
import { EMPRESA, HUELLA, USUARIO, ejemplos } from "./prueba/ejemplos";

// Eventos del puerto de IA (paso 0.7, spec §7). La bitácora registra QUE hubo una consulta y COMO le fue; jamás el texto enviado
// ni el recibido. Todo es vocabulario cerrado.
const MODELO = "99999999-8888-4777-8666-555555555555";
const consulta = ejemplos["ia.consulta"];
const rechaza = (evento: unknown) =>
  expect(() => validarEvento(evento)).toThrow(EventoBitacoraInvalidoError);
const problemas = (evento: unknown): readonly string[] => {
  try {
    validarEvento(evento);
  } catch (e) {
    if (e instanceof EventoBitacoraInvalidoError) return e.problemas;
    throw e;
  }
  return [];
};

describe("acciones de IA en el catálogo", () => {
  it("existen las tres acciones y cada una tiene su ejemplo", () => {
    for (const a of [
      "ia.consulta",
      "ia.preferencia_cambiada",
      "ia.configuracion_cargada",
    ] as const) {
      expect(ACCIONES).toContain(a);
      expect(() => validarEvento(ejemplos[a]), a).not.toThrow();
    }
  });

  it("los motivos nuevos son códigos de la lista cerrada y los admite ia.consulta", () => {
    const nuevos = [
      "modelo_no_permitido",
      "externo_no_habilitado",
      "limite_excedido",
      "texto_de_norma",
      "modelo_no_disponible",
      "tiempo_agotado",
    ] as const;
    for (const m of nuevos) {
      expect(MOTIVOS, m).toContain(m);
      expect(CATALOGO["ia.consulta"].motivos, m).toContain(m);
    }
  });

  it("la falta de permiso NO es un motivo de ia.consulta (se registra como acceso.denegado, un solo evento por intento)", () => {
    expect(CATALOGO["ia.consulta"].motivos).not.toContain("sin_permiso");
    rechaza({ ...consulta, resultado: "rechazado", motivo: "sin_permiso" });
  });

  it("ninguna clave de antes/despues de IA es un dato personal, un secreto ni texto libre", () => {
    for (const a of [
      "ia.consulta",
      "ia.preferencia_cambiada",
      "ia.configuracion_cargada",
    ] as const) {
      for (const c of [
        ...Object.keys(CATALOGO[a].antes),
        ...Object.keys(CATALOGO[a].despues),
      ]) {
        expect(esClaveProhibida(c), `${a}.${c}`).toBe(false);
        expect(c, `${a}.${c}`).not.toMatch(
          /prompt|respuesta|texto|mensaje|contenido|pregunta/,
        );
      }
    }
  });
});

describe("ia.consulta", () => {
  it("acepta una consulta correcta con modelo, proveedor, duración y tamaños", () => {
    const r = validarEvento(consulta);
    expect(r).toMatchObject({
      accion: "ia.consulta",
      resultado: "ok",
      actorTipo: "usuario",
      empresaId: EMPRESA,
    });
    expect(r.despues).toMatchObject({ modelo_id: MODELO, proveedor: "local" });
  });

  it.each([
    "modelo_no_permitido",
    "externo_no_habilitado",
    "limite_excedido",
    "texto_de_norma",
  ] as const)(
    "acepta un rechazo por %s, incluso sin modelo ni medidas (se rechaza antes de llamar al modelo)",
    (motivo) => {
      expect(() =>
        validarEvento({
          ...consulta,
          resultado: "rechazado",
          motivo,
          despues: undefined,
        }),
      ).not.toThrow();
    },
  );

  it.each(["modelo_no_disponible", "tiempo_agotado"] as const)(
    "acepta un error por %s",
    (motivo) => {
      expect(() =>
        validarEvento({ ...consulta, resultado: "error", motivo }),
      ).not.toThrow();
    },
  );

  it("las medidas son opcionales una por una (p. ej. el modelo no devolvió el tamaño)", () => {
    expect(() =>
      validarEvento({
        ...consulta,
        despues: { modelo_id: MODELO, proveedor: "local", duracion_ms: 1200 },
      }),
    ).not.toThrow();
    expect(() =>
      validarEvento({ ...consulta, despues: { proveedor: "externo" } }),
    ).not.toThrow();
  });

  it("exige empresa, usuario y objeto con la versión del prompt", () => {
    rechaza({ ...consulta, empresaId: null });
    rechaza({ ...consulta, actor: { tipo: "usuario" } });
    rechaza({ ...consulta, objeto: undefined });
    rechaza({ ...consulta, objetoVersion: undefined });
    rechaza({ ...consulta, objetoVersion: "evidencia-requisito@1" });
  });

  it("solo admite actor usuario y los tres resultados del catálogo", () => {
    rechaza({ ...consulta, actor: { tipo: "sistema", usuarioId: USUARIO } });
    rechaza({ ...consulta, resultado: "pendiente" });
  });

  it.each([
    ["prompt", "Explica la cláusula"],
    ["respuesta", "Una práctica habitual es..."],
    ["texto", "cualquier cosa"],
    ["modelo", "qwen2.5:1.5b"],
    ["correo", "alguien@ejemplo.test"],
    ["ip", "10.0.0.1"],
  ])(
    "NUNCA admite la clave «%s» (no hay forma de registrar texto enviado o recibido)",
    (clave, valor) => {
      const p = problemas({
        ...consulta,
        despues: { ...consulta.despues, [clave]: valor },
      });
      expect(p.length).toBeGreaterThan(0);
      expect(JSON.stringify(p)).not.toContain(valor);
    },
  );

  it("rechaza valores fuera del tipo: proveedor desconocido, modelo que no es UUID, medidas negativas o con decimales", () => {
    rechaza({
      ...consulta,
      despues: { ...consulta.despues, proveedor: "nube" },
    });
    rechaza({
      ...consulta,
      despues: { ...consulta.despues, modelo_id: "qwen2.5:1.5b" },
    });
    rechaza({ ...consulta, despues: { ...consulta.despues, duracion_ms: -1 } });
    rechaza({
      ...consulta,
      despues: { ...consulta.despues, unidades_entrada: 1.5 },
    });
  });

  it("el objeto sigue la forma tipo:identificador", () => {
    rechaza({ ...consulta, objeto: "requisito con espacios" });
    expect(() =>
      validarEvento({ ...consulta, objeto: `requisito:${MODELO}` }),
    ).not.toThrow();
  });
});

describe("ia.preferencia_cambiada", () => {
  const evento = ejemplos["ia.preferencia_cambiada"];

  it("acepta el cambio con el modelo anterior y el nuevo, o solo el nuevo la primera vez", () => {
    expect(() => validarEvento(evento)).not.toThrow();
    expect(() => validarEvento({ ...evento, antes: undefined })).not.toThrow();
  });

  it("solo lo hace una persona de una empresa, y es un resultado correcto", () => {
    rechaza({ ...evento, empresaId: null });
    rechaza({ ...evento, actor: { tipo: "plataforma" } });
    rechaza({ ...evento, resultado: "rechazado" });
  });

  it("antes y después solo llevan el identificador del modelo", () => {
    rechaza({ ...evento, despues: { modelo_id: MODELO, nombre: "Qwen" } });
    rechaza({ ...evento, despues: { modelo_id: "no-es-uuid" } });
  });
});

describe("ia.configuracion_cargada", () => {
  const evento = ejemplos["ia.configuracion_cargada"];

  it("es un hecho de plataforma, sin empresa, con la huella del contenido sembrado", () => {
    expect(validarEvento(evento)).toMatchObject({
      empresaId: null,
      actorTipo: "plataforma",
      objetoVersion: HUELLA,
    });
    rechaza({ ...evento, empresaId: EMPRESA });
    rechaza({ ...evento, actor: { tipo: "usuario", usuarioId: USUARIO } });
    rechaza({ ...evento, objetoVersion: undefined });
    rechaza({ ...evento, objetoVersion: "texto-que-no-es-huella" });
  });

  it("solo cuenta modelos y políticas", () => {
    rechaza({
      ...evento,
      despues: { modelos: 3, politicas: 2, detalle: "qwen" },
    });
  });
});
