// pnpm ia:prueba-previa — prueba previa del paso 0.7 (tarea 1.5): ejecuta la plantilla `evidencia-requisito` contra modelos REALES
// por la API compatible con OpenAI (Ollama directo, solo 127.0.0.1) y mide cuántas respuestas pasan el detector de texto normativo.
// Solo lee la librería de ejemplo (sin datos de ninguna empresa) y escribe el informe en la ruta que se le indique.
// Uso: node --import tsx scripts/ia-prueba-previa.ts [--salida docs/specs/puerto-ia-0-7/prueba-previa.md] [--modelos a,b] [--repeticiones n]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  revisarRespuestaIa,
  validarLibreria,
  type Libreria,
} from "@sig/normas-schema";
import {
  renderizarEvidenciaRequisito,
  type EntradaEvidenciaRequisito,
} from "@sig/prompts";
import { parse } from "yaml";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const argumento = (nombre: string, porDefecto: string): string => {
  const i = process.argv.indexOf(nombre);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : porDefecto;
};
const BASE = (process.env.IA_GATEWAY_URL ?? "http://127.0.0.1:11434").replace(
  /\/+$/,
  "",
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE))
  throw new Error(
    "La prueba previa solo habla con un servicio local (127.0.0.1).",
  );
const MODELOS = argumento("--modelos", "qwen2.5:1.5b,granite3.3:2b").split(",");
const REPETICIONES = Number(argumento("--repeticiones", "1"));
const SALIDA = argumento("--salida", "");
const ESPERA_MS = 120_000;

// Cobertura pedida por experto-iso: común, común, parcial, parcial, parcial (con el numeral distinto por norma).
const CLAUSULAS = ["ha-4.3", "ha-9.2", "ha-9.3", "ha-6.1", "ha-mejora"];
const NORMA = "ISO 9001";

const validada = validarLibreria(
  parse(
    readFileSync(
      join(raiz, "libraries/normas/ejemplo-estructura-armonizada.yaml"),
      "utf8",
    ),
  ),
);
if (!validada.ok) throw new Error("La librería de ejemplo no es válida.");
const libreria: Libreria = validada.libreria;

const entradaDe = (id: string): EntradaEvidenciaRequisito => {
  const e = libreria.entradas.find((x) => x.id === id);
  if (!e) throw new Error(`No existe la entrada ${id}.`);
  const propia = e.aplica_a.find((a) => a.norma === NORMA);
  if (!propia) throw new Error(`La entrada ${id} no aplica a ${NORMA}.`);
  const otras = e.aplica_a
    .filter((a) => a !== propia)
    .map((a) => ({ norma: a.norma, edicion: a.edicion, clausula: a.clausula }));
  return {
    norma: propia.norma,
    edicion: propia.edicion,
    clausula: propia.clausula,
    titulo: e.titulo,
    guia: e.guia,
    alcance: e.alcance_comun,
    ...(e.alcance_comun === "parcial" ? { otrasNormas: otras } : {}),
  };
};

interface Resultado {
  modelo: string;
  clausula: string;
  respuesta: string;
  detector: string[];
  palabras: number;
  ejemplos: number;
  ms: number;
  tokensEntrada: number | null;
  tokensSalida: number | null;
  observaciones: string[];
  error?: string;
}

/** Comprobaciones de la lista de revisión que el detector no cubre (aproximadas; la revisión humana manda). */
const observar = (
  texto: string,
  entrada: EntradaEvidenciaRequisito,
): string[] => {
  const obs: string[] = [];
  const numerales = [
    ...texto.matchAll(/\b\d{1,2}\.\d{1,2}(?:\.\d{1,2})?\b/g),
  ].map((m) => m[0]);
  if (numerales.some((n) => n !== entrada.clausula))
    obs.push("menciona otro numeral");
  if (/[«»"“”]/.test(texto)) obs.push("usa comillas");
  if (/\b(the|and|should|must|shall|with)\b/i.test(texto))
    obs.push("posible inglés");
  if (/borrador/i.test(texto)) obs.push("menciona «borrador»");
  if (
    /\b(no conformidad (mayor|menor)|observaci[oó]n|certificaci[oó]n garantizada|aprobar[aá] la certificaci[oó]n)\b/i.test(
      texto,
    )
  )
    obs.push("habla de clasificación de hallazgos o promesa de certificación");
  if (
    /\b(el auditor|la auditoría)\s+(exigir[aá]|aceptar[aá]|pedir[aá])\b/i.test(
      texto,
    )
  )
    obs.push("habla por el auditor");
  if (
    /información documentada/i.test(texto) &&
    !/no (es|son)[^.]*informaci[oó]n documentada/i.test(texto)
  )
    obs.push("menciona información documentada");
  return obs;
};

const contarEjemplos = (texto: string): number =>
  texto.split("\n").filter((l) => /^\s*(?:[-•*]|\d+[.)])\s+\S/.test(l)).length;

const consultar = async (
  modelo: string,
  clausula: string,
): Promise<Resultado> => {
  const entrada = entradaDe(clausula);
  const prompt = renderizarEvidenciaRequisito(entrada);
  const t0 = Date.now();
  const base = {
    modelo,
    clausula,
    respuesta: "",
    detector: [] as string[],
    palabras: 0,
    ejemplos: 0,
    ms: 0,
    tokensEntrada: null,
    tokensSalida: null,
    observaciones: [] as string[],
  };
  try {
    const r = await fetch(`${BASE}/v1/chat/completions`, {
      method: "POST",
      redirect: "error",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(ESPERA_MS),
      body: JSON.stringify({
        model: modelo,
        messages: prompt.mensajes.map((m) => ({
          role: m.rol,
          content: m.contenido,
        })),
        max_tokens: prompt.maxTokens,
        temperature: prompt.temperatura,
        stream: false,
      }),
    });
    const ms = Date.now() - t0;
    if (!r.ok) return { ...base, ms, error: `HTTP ${r.status}` };
    const j = (await r.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const respuesta = (j.choices?.[0]?.message?.content ?? "").trim();
    return {
      ...base,
      respuesta,
      detector: revisarRespuestaIa(respuesta),
      palabras: respuesta.split(/\s+/).filter(Boolean).length,
      ejemplos: contarEjemplos(respuesta),
      ms,
      tokensEntrada: j.usage?.prompt_tokens ?? null,
      tokensSalida: j.usage?.completion_tokens ?? null,
      observaciones: observar(respuesta, entrada),
    };
  } catch (e) {
    return {
      ...base,
      ms: Date.now() - t0,
      error: e instanceof Error ? e.name : "error",
    };
  }
};

const resultados: Resultado[] = [];
for (const modelo of MODELOS) {
  for (let rep = 0; rep < REPETICIONES; rep++) {
    for (const clausula of CLAUSULAS) {
      const r = await consultar(modelo, clausula);
      resultados.push(r);
      console.log(
        `${modelo.padEnd(14)} ${clausula.padEnd(10)} ${String(r.ms).padStart(6)} ms  ${String(r.palabras).padStart(3)} palabras  ${r.ejemplos} ejemplos  detector: ${r.error ? `ERROR ${r.error}` : r.detector.length === 0 ? "limpio" : r.detector.join(",")}${r.observaciones.length ? `  obs: ${r.observaciones.join("; ")}` : ""}`,
      );
    }
  }
}

const porModelo = MODELOS.map((m) => {
  const filas = resultados.filter((r) => r.modelo === m);
  const validas = filas.filter((r) => !r.error);
  const rechazadas = validas.filter((r) => r.detector.length > 0);
  const tiempos = validas.map((r) => r.ms).sort((a, b) => a - b);
  return {
    modelo: m,
    total: filas.length,
    errores: filas.length - validas.length,
    rechazadas: rechazadas.length,
    tasa: validas.length
      ? Math.round((100 * rechazadas.length) / validas.length)
      : 0,
    medianaMs: tiempos[Math.floor(tiempos.length / 2)] ?? 0,
    maxMs: tiempos.at(-1) ?? 0,
  };
});
console.log("\nResumen por modelo:");
for (const p of porModelo)
  console.log(
    `  ${p.modelo}: ${p.total} consultas, ${p.errores} con error, ${p.rechazadas} rechazadas por el detector (${p.tasa} %), mediana ${p.medianaMs} ms, máximo ${p.maxMs} ms`,
  );

if (SALIDA) {
  const lineas = [
    "# Prueba previa del paso 0.7 (tarea 1.5)",
    "",
    `- **Fecha:** ${new Date().toISOString().slice(0, 10)} · **Prompt:** \`evidencia-requisito@1.0.0\` · **Norma consultada:** ${NORMA} · **Servicio:** Ollama local directo (API compatible con OpenAI), solo 127.0.0.1`,
    `- **Muestra:** ${CLAUSULAS.length} cláusulas × ${MODELOS.length} modelos × ${REPETICIONES} repetición(es). Entrada: solo la librería de ejemplo (sin datos de ninguna empresa).`,
    "- **Detector:** `revisarRespuestaIa` de `@sig/normas-schema` (tono normativo, citas largas, enlaces), umbral de cero coincidencias. Las «observaciones» son comprobaciones aproximadas de la lista del plan; la revisión humana manda.",
    "",
    "## Resumen",
    "",
    "| Modelo | Consultas | Con error | Rechazadas por el detector | Tasa | Mediana | Máximo |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...porModelo.map(
      (p) =>
        `| ${p.modelo} | ${p.total} | ${p.errores} | ${p.rechazadas} | ${p.tasa} % | ${p.medianaMs} ms | ${p.maxMs} ms |`,
    ),
    "",
    "## Respuestas",
    "",
    ...resultados.flatMap((r) => [
      `### ${r.modelo} · ${r.clausula}`,
      "",
      `- Tiempo: ${r.ms} ms · Palabras: ${r.palabras} · Ejemplos en lista: ${r.ejemplos} · Unidades de entrada/salida: ${r.tokensEntrada ?? "—"}/${r.tokensSalida ?? "—"}`,
      `- Detector: ${r.error ? `ERROR (${r.error})` : r.detector.length === 0 ? "limpio" : r.detector.join(", ")}${r.observaciones.length ? ` · Observaciones: ${r.observaciones.join("; ")}` : ""}`,
      "",
      ...r.respuesta.split("\n").map((l) => `> ${l}`),
      "",
    ]),
  ];
  mkdirSync(dirname(join(raiz, SALIDA)), { recursive: true });
  writeFileSync(join(raiz, SALIDA), lineas.join("\n"));
  console.log(`\nInforme escrito en ${SALIDA}`);
}
