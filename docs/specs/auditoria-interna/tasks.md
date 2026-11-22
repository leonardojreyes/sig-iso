# Tareas — Auditoría interna

- **Spec:** [spec.md](spec.md) (con los ajustes de la sección 11) · **Rama:** `feature/auditoria-interna` · **Plan:** no hay; proceso ágil, las decisiones van en el ADR 040 de la tarea 1.
- **Estado:** **25 tareas** en 5 fases, **~2 días**. **Aprobado el 2026-11-19** con la propuesta por omisión. **Hechas 1 a 16** (rama `feature/auditoria-interna`); siguen las tareas 17 a 25 (pantallas y cierre).
- **Ajustes al orden** (decididos al implementar): el contrato de cada grupo de operaciones va **junto con su controlador** (tareas 9 a 11), porque la prueba de conformidad compara ambos; la tarea 8 quedó en permisos `auditoria.*` y acciones de bitácora. Los puertos y adaptadores de programa y auditorías se hicieron en la tarea 10 y la 11 solo agregó casos de uso. La **cobertura real** (auditorías cerradas) llega con la tarea 15; el programa ya muestra la cobertura **planificada** (lo que entra al año y lo que falta justificar).

## Cómo leer este documento

- Cada tarea cabe en una sesión de `/implement` (máx. ~1 hora). Orden TDD: prueba → dominio → caso de uso → adaptador → interfaz → documentación. **‖** = puede ir en paralelo.
- Todas incluyen `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde y un commit en inglés con Conventional Commits.
- «Aislamiento» = prueba que intenta leer o cambiar datos de otra empresa y **debe fallar**; toda tabla nueva se declara en los tres sitios de `privilegios.integration.test.ts`.
- **Contrato primero**; bitácora con acciones nuevas en el catálogo (objeto de forma exacta, sin texto libre) y en la misma transacción.
- **Migraciones `0023` a `0025`.** Este módulo entra antes que «Gestión de riesgos completa»: **sus migraciones se renumeran a partir de la `0026`** y su ADR sigue siendo el 038 (este módulo usa el **040**).
- Reutiliza el directorio de personas del control documental, el generador de Word (ADR 033), la guardia común de formularios de la web y la fecha de Ecuador.
- Modelo: **Haiku** en las tareas de solo documentación o pantallas que repiten un patrón (1, 17 a 21, 23, 25); **Sonnet** en base de datos, dominio, casos de uso, seguridad y revisión.

## Fase 1 — Decisión, base de datos y dominio

| #   | Tarea                                                                                                                                                                                                                                                                                                                                                  | Depende de |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| 1   | **ADR 040** «Auditoría interna» en «Propuesto» (proceso mínimo, independencia y excepción con medida, cobertura y prerrequisito, informe congelado, permisos); corregir la regla 9 del modelo de dominio (repetición = aviso) y marcar «Proceso» y «Persona–proceso» como del MVP                                                                      | —          |
| 2   | Migración `0023`: `proceso` (código `PR-001`, dueña, importancia, frecuencia, marca transversal, retiro) y `persona_proceso` (cuatro relaciones); RLS forzada, sin delete, update por columnas, **aislamiento** y matriz de privilegios                                                                                                                | 1          |
| 3   | Migración `0024`: `programa_auditoria` (uno por año, aprobación), `programa_exclusion` (proceso o capítulo fuera del año con motivo), `auditoria` (código `AI-2027-01`, fechas, reuniones, estado, cancelación), `auditoria_norma`, `auditoria_proceso` y `auditoria_equipo` (con excepción y medida compensatoria); RLS, **aislamiento**, privilegios | 2          |
| 4   | Migración `0025`: `auditoria_item` (entrada y versión de librería fijadas, resultado, nota, versión), `auditoria_pregunta`, `hallazgo` (tipo, requisito, enunciado, evidencia, justificación de gravedad, anulación) y `auditoria_informe` (copia congelada, inmutable); RLS, **aislamiento**, privilegios                                             | 3          |
| 5   | **Dominio** de independencia (función pura): bloqueo por relación con un proceso del alcance (incluido «Gestión del SIG» cuando hay cláusulas 4 a 10), aviso por repetición en 12 meses, excepción con motivo y medida, no autoaprobación                                                                                                              | 1          |
| 6   | **Dominio** de estados y fechas: transiciones de programa y auditoría (solo avanzan, cancelada no se reabre), reuniones obligatorias, hora de Ecuador, código correlativo                                                                                                                                                                              | 1          |
| 7   | **Dominio** de lista y cobertura (puras): generar filas desde entradas adoptadas (alcance por capítulo, congelada con su versión de librería) y calcular **cobertura** (año y 12 meses móviles, sin contar «no verificado» ni «no aplica» sin justificación), brechas del Anexo A según la Declaración y el **prerrequisito** de la Etapa 2            | 1          |

## Fase 2 — Procesos, programa y planificación (contrato, casos de uso y API)

| #   | Tarea                                                                                                                                                                                                                                                                                                         | Depende de |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 8   | **Contrato** OpenAPI: `/procesos`, relaciones, `/programas`, `/auditorias` (planificación y equipo); permisos `auditoria.ver\|planificar\|ejecutar\|aprobar\|gestionar` en la matriz (administrador: todo; auditor interno: ver y ejecutar solo en las suyas; colaborador: ver) y acciones nuevas de bitácora | 1          |
| 9   | Casos de uso y controlador de **procesos y relaciones** (alta, retiro, «Gestión del SIG» con un botón, avisos de sin dueña o sin relaciones)                                                                                                                                                                  | 2, 8       |
| 10  | Casos de uso y controlador del **programa** (crear, motivos de no inclusión, aprobar, reprogramar y cancelar con motivo, ayudas H2.4 y cobertura)                                                                                                                                                             | 3, 6, 7, 8 |
| 11  | Casos de uso y controlador de **planificar y designar** (alcance, criterios, equipo, independencia con 409 explicado, excepción con medida, avisos de repetición)                                                                                                                                             | 3, 5, 8    |

## Fase 3 — Ejecución, hallazgos e informe

| #   | Tarea                                                                                                                                                                                                     | Depende de   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 12  | **Contrato** de `/auditorias/{id}/lista`, `/items`, `/hallazgos`, `/informe` y exportación; errores 409 y orden 401 → 403 → 400 → 404 → 409                                                               | 8            |
| 13  | Casos de uso de la **lista de verificación**: generar y regenerar, preguntas propias, evaluar filas con concurrencia y solo el equipo designado, avance                                                   | 4, 7, 12     |
| 14  | Casos de uso de **hallazgos**: tipos, campos obligatorios de la NC, justificación de gravedad mayor, anular con motivo; no sale de la fila (transversales)                                                | 4, 12        |
| 15  | Casos de uso de **emitir informe y cerrar**: reevalúa la independencia, exige filas evaluadas, congela la copia (conclusión, limitaciones, programa), cierra con constancia y expone el **prerrequisito** | 6, 7, 13, 14 |
| 16  | **Word del informe** (`GeneradorDocumentoPort`, texto plano, rótulo «no es certificado»), siempre desde la copia congelada; la exportación queda en la bitácora **antes** de entregarse                   | 15           |

## Fase 4 — Pantallas

| #   | Tarea                                                                                                                           | Depende de |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 17  | Pantalla **Procesos** (lista, alta, relaciones, avisos)                                                                         | 9          |
| 18  | Pantalla **Programa anual** (línea de tiempo por trimestre, cobertura, criterios visibles, aprobar y motivos)                   | 10         |
| 19  | Pantalla de **planificación de una auditoría** (alcance, criterios, equipo, independencia y excepción visibles)                 | 11         |
| 20  | Pantalla de **lista de verificación y hallazgos** (avance, resultados, preguntas propias, guía de la guía de tipos)             | 13, 14     |
| 21  | Pantalla del **informe y cierre** (emitir, cerrar, descargar Word) y **panel** con el prerrequisito de la Etapa 2 y sus brechas | 15, 16     |

## Fase 5 — Verificación y cierre

| #   | Tarea                                                                                                                                                                                            | Depende de |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| 22  | `pnpm web:verify-auditoria` con todo real (permisos por rol, independencia y excepción, `Origin`, concurrencia, informe congelado, aislamiento con la empresa B); repetible y limpia lo que crea | 17 a 21    |
| 23  | STRIDE y clasificación de datos (`docs/security/stride-auditoria-interna.md`); insumo nuevo en el ADR 028 (relación persona–proceso, hallazgos con texto libre e informe congelado)              | 22         |
| 24  | **`/review` completo** (seis revisores en paralelo) y correcciones de lo importante; lo demás queda anotado                                                                                      | 22, 23     |
| 25  | Cierre: marcar «Hecho» en `docs/producto/hoja-de-ruta.md`, actualizar `docs/fase0/estado.md`, ADR 040 a «Aprobado», renumerar las migraciones de riesgos en su rama y **abrir el PR**            | 24         |

## Notas

- **Orden con riesgos:** la renumeración de «Gestión de riesgos completa» (de `0023…0028` a `0026…0031`) se hace en la tarea 25, solo en sus documentos.
- **Decisiones de producto que quedan para ti** (con propuesta por omisión en el spec): ver las secciones 10 y 11.
