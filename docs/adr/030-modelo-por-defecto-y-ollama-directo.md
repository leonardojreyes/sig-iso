# ADR 030 — Modelo por defecto del asistente local; Ollama directo en el paso 0.7 y LiteLLM a la Fase 1

- **Estado:** Propuesto (2026-11-09). Recorte del 0.7 aprobado y prueba previa cumplida; **falta la muestra de revisión humana (tarea 4.6)** y tu aprobación expresa del ADR para pasar a Aprobado.
- **Fecha:** 2026-11-09
- **Decide:** Ing. Leonardo J. Reyes B.
- **Relación:** ajusta parcialmente el ADR 014 (LiteLLM como pasarela). No lo reemplaza: el resto sigue vigente (puerto `AsistentePort`, Ollama local por defecto, segundo proveedor externo deshabilitado, prompts versionados, todo marcado «borrador generado por IA»).

## Contexto

El ADR 014 dejó pendiente elegir el modelo exacto en el paso 0.7, «informando su tamaño antes de descargar», y fijó LiteLLM como pasarela. En el equipo de desarrollo (Mac de 8 GB) ya estaban instalados dos modelos locales, así que **no hace falta descargar ninguno**.

La prueba previa (tarea 1.5) ejecutó el prompt `evidencia-requisito` sobre 5 cláusulas de la librería de ejemplo (`ha-4.3`, `ha-9.2`, `ha-9.3`, `ha-6.1`, `ha-mejora`, norma ISO 9001) contra los dos modelos, por la API compatible con OpenAI de Ollama (solo `127.0.0.1`), y midió con el detector de texto normativo (cero coincidencias) y a mano el cumplimiento del formato. El informe está en `docs/specs/puerto-ia-0-7/prueba-previa.md`.

### Datos de los modelos

|                                             | `qwen2.5:1.5b` | `granite3.3:2b` |
| ------------------------------------------- | -------------- | --------------- |
| Parámetros / cuantización                   | 1,5 B / Q4_K_M | 2,5 B / Q4_K_M  |
| Tamaño en disco                             | 986 MB         | 1,5 GB          |
| Memoria con el modelo cargado (`ollama ps`) | 1,2 GB         | 1,9 GB          |
| Licencia (según su manifiesto)              | Apache 2.0     | Apache 2.0      |

### Resultados de la prueba previa

Prompt v1.0.0 (tres rondas, 25 consultas por modelo):

|                                    | `qwen2.5:1.5b`                                      | `granite3.3:2b`                                                        |
| ---------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------- |
| Rechazadas por el detector         | 4 de 25 (16 %)                                      | 2 de 25 (8 %)                                                          |
| Mediana de tiempo por consulta     | 8,0 a 13,8 s (según la ronda)                       | 12,8 a 19,8 s                                                          |
| Máximo observado                   | 15,1 s                                              | 23,3 s                                                                 |
| Longitud (se pedían ~150 palabras) | 190 a 280 palabras                                  | 136 a 223 palabras                                                     |
| Formato                            | siempre 5 ítems numerados con negritas (asteriscos) | prosa o listas de 0 a 15 líneas; a veces cierra con «la empresa debe…» |

**Prompt definitivo** (tercera versión; 15 consultas por modelo, 3 repeticiones de las 5 cláusulas):

| | `qwen2.5:1.5b` | `granite3.3:2b` |
| --- | --- | --- |
| Rechazadas por el detector | 0 de 15 (0 %) | 0 de 15 (0 %) |
| Mediana / máximo por consulta | 7,6 s / 8,3 s | 5,0 s / 7,4 s |
| Longitud (se pedían 100 palabras para llegar a ~150) | 129 a 254 palabras | 41 a 99 palabras |
| Viñetas (se pedían de 3 a 5) | 8 a 10; numeración y negritas; repite en el encabezado los datos de la entrada | siempre 5, con la línea inicial pedida |

Con el prompt definitivo ambos pasan el detector, pero **solo `granite3.3:2b` cumple las instrucciones de longitud y de formato**; `qwen2.5:1.5b` las ignora (y tarda más). En `granite3.3:2b` se vio además que algunas viñetas se apartan un poco de la guía (por ejemplo, en `ha-6.1` habló de estudios de mercado), lo que revisará la muestra humana.

Primer ajuste del prompt (formato más estricto y «cada viñeta empieza con una fórmula»; 10 consultas por modelo): `granite3.3:2b` mejoró (0 de 10 rechazadas, 61 a 137 palabras, normalmente 5 viñetas) y `qwen2.5:1.5b` **empeoró** (6 de 10 rechazadas): tomó las fórmulas como encabezados y escribió frases de obligación entre comillas («Suele: "…deben ser…"»). Ese ajuste se descartó: el prompt definitivo ya no obliga a empezar cada viñeta con una fórmula y pide viñetas como frases nominales.

Los tiempos varían entre rondas con la carga del equipo; son del orden de 8 a 23 s, muy por debajo del tope de 60 s del spec.

## Decisión

1. **Modelo predeterminado de plataforma: `granite3.3:2b`.** Sigue mejor las instrucciones de formato y de tono (menos rechazos del detector en todas las rondas y única mejora con el ajuste del prompt) y es el menos propenso a escribir en tono de obligación. Cuesta unos 0,7 GB más de memoria cargado y unos 5 s más por consulta.
2. **Segundo modelo del catálogo: `qwen2.5:1.5b`.** Cumple el criterio de salida del 0.7 (dos modelos distintos sin cambiar código), es más liviano y rápido, pero cumple peor el formato y el tono; una empresa lo puede elegir si prioriza memoria. Un modelo externo se define en el catálogo pero queda **deshabilitado y no enrutado**.
3. **En el paso 0.7 el adaptador habla directo con Ollama** (`http://127.0.0.1:11434/v1`, API compatible con OpenAI), detrás del mismo `AsistentePort`. **LiteLLM, que el ADR 014 fijó como pasarela, se difiere a la Fase 1**, cuando exista un proveedor externo o necesidades de gobierno que lo justifiquen (claves por empresa, límites de costo, respaldo entre proveedores). Como el adaptador ya habla el protocolo de LiteLLM, cambiar de uno a otro es solo la variable `IA_GATEWAY_URL`: no se toca el caso de uso ni la pantalla.
4. **Parámetros de la generación** (fijos en la plantilla versionada): temperatura 0,2 y tope de 400 unidades de salida; el prompt pide un máximo de 100 palabras para que los modelos, que se pasan, aterricen cerca de las 150 del spec.
5. **La política por omisión de una empresa sin política es solo `granite3.3:2b`** (local).

## Cuándo se confirma (pasa a Aprobado)

- ~~El responsable aprueba el recorte del 0.7 (que difiere LiteLLM).~~ **Cumplida (2026-11-09).**
- ~~La prueba previa con el **prompt definitivo** da una tasa de rechazo del detector de 10 % o menos con `granite3.3:2b`~~ **Cumplida (2026-11-09):** 0 de 15, sin lenguaje de obligación.
- La muestra de revisión humana del spec (tarea 4.6, 5 cláusulas × 2 modelos, firmada por el responsable) no encuentra texto copiado de una norma ni confusiones de dominio en las respuestas de `granite3.3:2b`.

Si algo de esto falla, se revisa el prompt o el modelo antes de seguir; no se afloja el detector.

## Alternativas consideradas

| Alternativa                                            | Por qué no                                                                                                                                                                                                                                          |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `qwen2.5:1.5b` como predeterminado                     | Más liviano y rápido, pero ignora longitud y formato, usa negritas que en pantalla se verían como asteriscos y fue el único que cayó a 60 % de rechazos al ajustar el prompt. Queda como segundo modelo.                                            |
| Descargar un modelo de ~3B (el ADR 014 hablaba de ~3B) | Unos 2 GB más en disco y más memoria cargada sobre una pila de ~1,4 GB. Los dos modelos instalados cumplen el criterio de salida; se reconsidera con la muestra de calidad (4.6).                                                                   |
| LiteLLM ya en el 0.7 (ADR 014, opción A)               | 116 paquetes de Python y 140 MB de descarga, un servicio más en memoria y una cadena de suministro nueva (hashes, licencias, escaneo de Python), sin un proveedor externo que lo necesite todavía. Se difiere con el adaptador compatible ya listo. |
| SDK directo de un proveedor                            | Descartado desde el ADR 014.                                                                                                                                                                                                                        |

## Estándar y licencia

- Estándar: API compatible con OpenAI (Ollama expone `/v1/chat/completions`).
- Ollama: MIT. `qwen2.5:1.5b` y `granite3.3:2b`: Apache 2.0, verificado en el manifiesto de cada modelo (`ollama show --license`). LiteLLM (MIT) no se instala en este paso.

## Consecuencias

- La pila de desarrollo suma 1,2 a 1,9 GB con un modelo cargado; con los 1,43 GB medidos queda por debajo de 4 GB. `OLLAMA_MAX_LOADED_MODELS=1` mantiene un solo modelo en memoria, con el costo de recargar al cambiar de modelo.
- Ollama arranca aparte (`ollama serve`, solo `127.0.0.1`), no con `pnpm dev`.
- No hace falta el ADR de excepción a los ADR 022 y 025 por un servicio Python que había previsto el plan: se escribirá si la Fase 1 retoma LiteLLM.
- Windows queda por verificar para el arranque de Ollama (como los hooks, B6).

## Criterio de tecnología mayoritaria (P12)

Ollama y la API compatible con OpenAI son el estándar de hecho para modelos locales; los dos modelos son de licencia permisiva y de proveedores con soporte continuo.
