# Tareas — Declaración de Aplicabilidad justificada

- **Spec:** [spec.md](spec.md) · **Plan:** no hay; el proceso es ágil (una rama por rebanada, PR por hito, un solo `/review` al final) y las decisiones de diseño van en el ADR de la tarea 1.
- **Estado:** spec **aprobado el 2026-11-17**. **20 tareas** en 6 fases; en curso desde la 1.

## Cómo leer este documento

- Cada tarea cabe en una sesión de `/implement` (máx. ~1 hora). Orden TDD: prueba → dominio → caso de uso → adaptador → interfaz → documentación.
- **‖** marca tareas que pueden ir en paralelo con otras que no se listan en «Depende».
- Todas incluyen, además de lo indicado, `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde (también con `SIGISO_SIN_BASE=1 PGPORT=1 pnpm test`) y un commit en inglés con Conventional Commits.
- «Aislamiento» = la prueba que intenta leer o cambiar datos de otra empresa y **debe fallar** (regla 2); se comprueba con una mutación (sin la política, falla).
- Los números de migración son los siguientes libres al escribir esto (`0017` en adelante); se ajustan si cambian.

## Fase 1 — Decisión, base de datos y dominio

| ID  | Tarea                                                                                                                                                                                                                                                                                                                                     | Depende |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | ✅ **ADR 037** «Riesgos mínimos y motivos de inclusión derivados» (motivo «riesgo» siempre derivado; tratamiento previsto directo; escala y cortes congelados; qué no cubre). Actualizar el glosario (motivo de inclusión, equivalencias de las decisiones de tratamiento), `modelo-dominio.md` y H8.7 del spec del MVP                      | —       |
| 2   | Migración `0017`: `riesgo` (código correlativo por empresa, probabilidad, impacto, decisión, responsable, versión, estado), `riesgo_control` y `riesgo_entrada` (tratamiento previsto a un control del Anexo A, por código de librería e id estable, sin clave foránea). RLS forzada, **aislamiento** y matriz de privilegios actualizada | 1       |
| 3   | Migración `0018`: `motivo_inclusion` (por empresa y control del Anexo A: tipo, nota obligatoria, versión) y `referencia_tratamiento` (por empresa y norma: análisis y plan con título, versión, fecha y ubicación). RLS forzada, **aislamiento**, privilegios ‖                                                                           | 1       |
| 4   | Migración `0019`: copia congelada de la versión (`declaracion_motivo`, `declaracion_riesgo`, `declaracion_referencia`, y la escala y los cortes en la versión). Inmutables (sin `update` ni `delete`), RLS, **aislamiento**; las versiones anteriores siguen leyéndose                                                                    | 1       |
| 5   | ✅ Dominio puro del riesgo: escala 1 a 5, nivel inicial con sus cortes y su nombre, decisión de tratamiento, regla «aceptar exige responsable» + pruebas (≥ 80 %) ‖                                                                                                                                                                          | 1       |
| 6   | Dominio: ampliar `derivarDeclaracion` con motivos derivados (por control de la empresa y por tratamiento previsto), motivos registrados, «sin motivo», advertencias y bloqueos + pruebas (control retirado, riesgo retirado, ambos caminos, sin vínculos)                                                                                 | 5       |

## Fase 2 — Casos de uso y adaptadores

| ID  | Tarea                                                                                                                                                                                                                                                                                                                          | Depende |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| 7   | Casos de uso de riesgos: crear (código correlativo), cambiar, retirar (con **aviso previo** de los controles del Anexo A que quedarían sin motivo), listar y ver. Permisos `riesgos.ver` (administrador y colaborador) y `riesgos.gestionar` (solo administrador). Acciones de bitácora en el catálogo, con ejemplos y pruebas | 2, 5    |
| 8   | Casos de uso de vínculos: vincular y desvincular riesgo–control de la empresa y riesgo–control del Anexo A (tratamiento previsto); reglas de retirados y de empresa; bitácora ‖                                                                                                                                                | 7       |
| 9   | Casos de uso de motivos (nota obligatoria, versión, «otra persona lo cambió antes») y de referencias al tratamiento; bitácora ‖                                                                                                                                                                                                | 3, 6    |
| 10  | Ajustar obtener y **aprobar** la Declaración: derivar con riesgos y motivos, **bloquear** si un control que aplica no tiene motivo (409 con motivo cerrado), congelar motivos, riesgos, referencias y escala; `declaracion.aprobada` con conteos; versiones antiguas intactas                                                  | 4, 6, 9 |
| 11  | Adaptadores de PostgreSQL de las tareas 7 a 10 + pruebas de integración con la base real: **aislamiento**, hecho y cambio en una sola transacción (rollback si falla la bitácora), versión vieja, carrera del código correlativo, versión congelada que no cambia al cambiar un riesgo                                         | 7 a 10  |

## Fase 3 — Contrato y API

| ID  | Tarea                                                                                                                                                                                                                                     | Depende |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 12  | Contrato OpenAPI: riesgos, vínculos, motivos, referencias y la Declaración ampliada; **guardas de privacidad** del contrato con las excepciones exactas (descripción y notas son textos de la empresa); tipos generados y `generar:check` | 7 a 10  |
| 13  | Controladores y pruebas de la API: 401 → 403 → 400 → 404 → 409, la empresa del token manda, esquemas del contrato, 404 indistinguible entre empresas, bitácora, 500 si falla el registro; mapeo de errores; conformidad con el contrato   | 11, 12  |

## Fase 4 — El documento Word

| ID  | Tarea                                                                                                                                                                                                                                                                                                                                                           | Depende |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 14  | Word: columnas de motivo (con su nota) y de riesgos, sección «Tratamiento de riesgos» con la escala impresa y las referencias, **avisos fijos también en versiones aprobadas** (registro simplificado, sin riesgo residual ni su aceptación, sin controles adicionales ni activos, falta del plan), versión antigua, texto plano; pruebas con el generador real | 10      |

## Fase 5 — Interfaz web

| ID  | Tarea                                                                                                                                                                                                                                                    | Depende |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 15  | Pantalla **Riesgos**: lista con nivel en palabras, crear, cambiar y retirar con aviso previo, detalle con los controles que lo tratan y los vínculos directos; entrada en la navegación; textos es-EC; formularios por la guardia común; pruebas con axe | 13      |
| 16  | **Declaración**: motivos por control (tipo y nota), referencias al tratamiento, resumen con y sin motivo, riesgos sin tratamiento y avisos de bloqueo; textos es-EC; pruebas con axe ‖                                                                   | 13      |

## Fase 6 — Verificación y cierre

| ID  | Tarea                                                                                                                                                                                                                                                                               | Depende |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 17  | `pnpm web:verify-riesgos` con todo real (Keycloak, API, PostgreSQL y web): crear riesgos y vínculos, motivos, **bloqueo sin motivo**, aprobar, versión congelada intacta tras cambiar un riesgo, Word, permisos y aislamiento; ajustar `web:verify-declaracion`; repetible y limpio | 14 a 16 |
| 18  | Documentación de seguridad: STRIDE del hito, clasificación de datos y los insumos nuevos del ADR 028 (riesgos, notas y referencias); guía de ejecución ‖                                                                                                                            | 17      |
| 19  | `/review` completo (arquitecto, multiempresa, seguridad, accesibilidad, cumplimiento y `experto-iso` sobre el documento) y sus correcciones                                                                                                                                         | 17, 18  |
| 20  | PR del hito, `estado.md` al día y cierre del hueco 1 del M6; dejar anotado lo que sigue fuera (controles adicionales, responsable por control, riesgo residual)                                                                                                                     | 19      |

## Lo que queda fuera (no son tareas de esta lista)

Riesgo residual y su aceptación, escala configurable, activos de información, controles adicionales como filas propias, responsable por control, Declaraciones de 9001 y 42001, y ayuda del asistente de IA (spec, sección 9).
