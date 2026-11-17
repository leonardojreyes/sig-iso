# Política de uso de IA — sig-iso

- **Estado:** Propuesta (paso 0.9 mínimo, ADR 031). Pasa a vigente cuando el responsable la apruebe; algunas condiciones dependen de la muestra de calidad del ADR 030.
- **Fecha:** 2026-11-09 · **Responsable del asistente:** el administrador SIG de SynapTech.
- **Alcance:** el asistente de IA del producto. En el paso 0.7 es un solo caso: «explicar ejemplos de evidencia de un requisito» sobre la librería de ejemplo.
- **Orientada a ISO/IEC 42001:** el propio asistente es un sistema de IA de SynapTech y de cada empresa que lo use; esta política es su primer documento. No es un mapeo formal a la norma: el mapeo, la ficha del sistema y el registro de cambios se completan antes del primer cliente externo (ADR 031).
- **Estado de lo que describe:** es el comportamiento **objetivo** del 0.7. El asistente está en construcción; la tabla «Controles técnicos» indica qué existe y qué está previsto.

## Principios

1. **Local por omisión.** Los modelos corren en la máquina (Ollama, `127.0.0.1`). Un modelo externo solo se usa si la empresa lo habilita explícitamente en su política. **Diseño:** viene deshabilitado y sin enrutar (requisito de la implementación, aún no construida).
2. **Siempre borrador.** Todo lo generado lleva el rótulo «Borrador generado por IA», el nombre del modelo y un aviso: son prácticas habituales, no requisitos; hay que contrastarlos con el ejemplar de la norma de la empresa; y qué evidencia basta lo decide el auditor.
3. **Supervisión humana.** La persona lee, contrasta y decide. El asistente no ejecuta acciones, no modifica datos, no evalúa cumplimiento ni toma decisiones.
4. **Solo contenido de la librería (0.7).** Al modelo se le envían norma, edición, cláusula, título breve y guía propia. **Nada de la empresa**, nada de personas, nada escrito libremente por quien consulta.
5. **Sin texto de las normas.** Ni lo enviado ni lo mostrado reproduce texto de las normas ISO. Hay un detector de estructura (cero coincidencias) y una muestra revisada por una persona; el detector no basta contra paráfrasis cercanas.
6. **Transparencia y trazabilidad.** Cada consulta (aceptada o rechazada) queda en la bitácora con modelo, tipo de proveedor, duración y tamaños, **sin** guardar lo que se preguntó ni lo que se respondió.
7. **Un solo punto de entrada.** Toda IA pasa por la misma puerta (`AsistentePort`), que aplica permiso, política de la empresa, límites, revisión del texto y registro.

## Usos permitidos y prohibidos

| Permitido                                                                                  | Prohibido                                                                                        |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Explicar con palabras propias qué suele respaldar un requisito, con la guía de la librería | Decidir, aprobar o evaluar cumplimiento (cumple, parcial, no cumple)                             |
| Redactar borradores que una persona revisa (en fases futuras, con su propia evaluación)    | Enviar datos personales, secretos o información confidencial de una empresa a un modelo externo  |
| Probar modelos locales con la librería de ejemplo                                          | Presentar lo generado como oficial, aprobado o como texto de una norma                           |
|                                                                                            | Acciones automáticas posteriores a la respuesta, agentes o herramientas sobre datos del producto |

## Modelos

- **Catálogo de plataforma:** `granite3.3:2b` (predeterminado) y `qwen2.5:1.5b`, ambos locales y con licencia Apache 2.0 (ADR 030, propuesto). Un modelo nuevo exige informar su tamaño antes de descargarlo, verificar su licencia y actualizar el ADR.
- **Política de cada empresa:** qué modelos permite y cuál es el predeterminado; sin política, solo el predeterminado local. Una empresa no ve ni altera la política de otra. En el 0.7 la política está en configuración; la tabla en base de datos llega después.
- **Cambios** de modelo, de política o de instrucciones al modelo: se revisan y se registran (registro de cambios del asistente).

## Controles técnicos que respaldan la política

| Control | Estado (2026-11-09) |
| --- | --- |
| Permiso `ia.usar` (administrador SIG y colaborador) | Implementado en el PR #14 (sin integrar) |
| Eventos de bitácora `ia.consulta`, `ia.preferencia_cambiada`, `ia.configuracion_cargada`, sin clave posible para el texto | Implementado en el PR #14 (sin integrar) |
| Detector de texto normativo para la respuesta (`revisarRespuestaIa`) y prompt versionado | Implementado en el PR #14 (sin integrar) |
| Un solo punto de entrada (`AsistentePort`), interruptor de apagado (`ia-habilitada`, cerrado por omisión), límite por persona, tiempo máximo de 60 s, llamadas sin seguir redirecciones, texto mostrado como texto, errores sin detalles internos | **Previsto** (tareas 2.x a 4.x del paso 0.7, aún no construido) |
| Política por empresa y modelos permitidos | **Previsto** (en configuración en el 0.7; en base de datos después) |

## Riesgos conocidos

Respuestas inventadas o equivocadas (por eso borrador y contraste); modelos pequeños que no siguen bien el formato (el predeterminado es el que mejor lo hace, ADR 030); paráfrasis cercanas a una norma (la cubre la revisión humana); inyección de instrucciones (la entrada es solo contenido de la librería); fuga a un modelo externo (deshabilitado y no enrutado).

## Incidentes y revisión

- Una respuesta incorrecta o que parezca texto de una norma se **reporta al responsable del asistente**; un canal formal dentro del producto queda para la Fase 1.
- La política se revisa antes del primer cliente externo y cuando cambie el catálogo de modelos, el caso de uso o el tipo de datos que reciba el modelo.

## Pendiente (antes del primer cliente externo)

Muestra de calidad firmada por el responsable (tarea 4.6), ficha del asistente y registro de cambios (4.7), política de derechos de autor de las normas, y validación legal sobre datos personales y proveedores externos.
