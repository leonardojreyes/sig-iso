# ADR 038 — Gestión de riesgos completa

- **Estado:** Propuesto (2026-11-22). Pasa a «Aprobado» al integrar el PR del hito C; implementa `docs/specs/gestion-riesgos-completa/` (aprobado el 2026-11-18 con la propuesta por omisión Q1–Q9 y los 13 ajustes del plan). Completa el ADR 037 y no lo contradice.
- **Fecha:** 2026-11-22
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

El ADR 037 dejó un registro **mínimo** de riesgos (probabilidad, impacto, decisión) y declaró en el Word lo que faltaba: activos, riesgo residual y su aceptación formal. Un auditor de la Etapa 2 de ISO/IEC 27001:2022 espera criterios propios de evaluación, historia de las evaluaciones, un plan de tratamiento con responsables y la aceptación formal del riesgo residual por quien corresponde. `experto-iso` revisó el spec y el plan en dos pasadas (la segunda sin bloqueantes, 2026-11-22).

Restricciones: reglas 2 (multiempresa), 3 (sin texto de normas), 4 (bitácora), 5 (IA solo por puerto; aquí no se usa) y 6 (contrato primero); versiones aprobadas de la Declaración inmutables (ADR 033 y 037).

## Decisión

1. **Evaluación como historial append-only** `riesgo_evaluacion` (`inicial`, `revaluacion`, `revision`, `residual`) con motivo, nota, versión de criterios (o «por omisión») y marca `migrada`. `riesgo.probabilidad` e `impacto` siguen siendo el análisis vigente y se actualizan **en la misma transacción**; una prueba de coherencia lo verifica tras cada operación. `PUT /riesgos/{id}` deja de aceptar probabilidad e impacto (cambio de contrato incompatible, con contrato primero). Los riesgos existentes reciben una evaluación inicial «migrada» con su hecho de bitácora; las copias congeladas no cambian.
2. **Criterios versionados e inmutables** (`criterios_version`): descripciones de probabilidad e impacto y un **nivel de aceptación** explícito. Sin filas, rige la escala por omisión de la herramienta, rotulada como tal. **Sin nivel de aceptación explícito no se registran aceptaciones.**
3. **Activos de información** (`activo`, código `A-001`, tipo y clasificación de listas cerradas) ligados a riesgos (`riesgo_activo`). Se retiran, no se borran, con aviso previo de los riesgos que quedarían sin activo.
4. **Decisión «aceptar» pasa a «retener»**, para no confundirla con la **aceptación formal** del riesgo residual. «Transferir» siempre tiene residual (si el responsable afirma que no queda nada, exige nota y constancia). «Evitar» solo es «no requiere» residual cuando la acción de eliminación está **hecha**.
5. **Plan de tratamiento:** acciones con tipo, responsable, fecha objetivo, fecha real, estado y verificación de eficacia. La **aprobación del plan** (por el responsable del riesgo; se guardan el responsable, quien registra y la constancia) es un hecho **distinto** de la aceptación del residual. Se guarda una **huella del conjunto de acciones**: solo cambios de contenido, de decisión o de responsable del riesgo devuelven el plan a borrador; el estado, la nota y la fecha real que cambia el colaborador **no**.
6. **Residual y aceptación:** el residual es «esperado» o «confirmado» y no puede superar el análisis vigente; al revaluar el análisis queda «por revisar». La aceptación guarda el id del análisis, el del residual, la decisión, el responsable y el nivel de aceptación, y **deja de ser vigente si cualquiera cambia** (no si solo cambian descripciones). La **aceptación excepcional** exige quien autoriza, constancia propia (tipo, ubicación, fecha) y vencimiento. Faltar aceptación o plan aprobado **advierte** al aprobar la Declaración; no bloquea (Q6: aprobar la Declaración no es aceptar el riesgo).
7. **Primer permiso por objeto.** `acciones.estado` permite al colaborador cambiar **solo el estado, la nota y la fecha real de las acciones de las que es responsable**. Se resuelve en el caso de uso (método separado, con versión esperada) y no cumple todavía el disparador de OpenFGA del ADR 029; **migrará a tuplas** cuando se adopte. Pruebas negativas: acción ajena y administrador que es responsable. Permisos nuevos: `activos.ver|gestionar`, `criterios.ver|gestionar`, `riesgos.aceptar` (solo administrador SIG, Q4) y `acciones.estado`.
8. **Directorio de personas mínimo:** puerto `DirectorioPersonasPort` en `application` (`listar`, `existeActiva`) con adaptador sobre `usuario` y la empresa de la sesión; no se importa código de otros módulos. `GET /certificacion/personas` devuelve solo `id`, `nombre` y `activa`. Una persona dada de baja no se asigna como responsable nuevo. El nombre nunca se persiste fuera de `usuario` ni va a la bitácora.
9. **Declaración y Word:** la copia congelada se amplía **solo con identificadores, enums, números y conteos** (evaluación inicial y residual, estado de aceptación, conteo de acciones por estado, activos ligados, criterios usados); una prueba comprueba que no existen columnas de texto. Las versiones anteriores quedan intactas y el Word lo dice. Los avisos fijos se ajustan y siguen declarando lo que falta (controles adicionales, responsable por control, riesgos de proceso y oportunidades) y que el producto no decide por la empresa.
10. **La Declaración referencia el plan de tratamiento y los controles:** cada acción puede vincular el control de la empresa que implanta (el mismo vínculo del ADR 037), y ese vínculo alimenta el motivo «riesgo» derivado de la Declaración.
11. **Bitácora (misma transacción):** `activo.*`, `criterios.cambiados`, `evaluacion.registrada|migrada`, `accion.*`, `plan.aprobado|devuelto_a_borrador`, `residual.registrado`, `riesgo.aceptado`, `evitar.confirmado`; objetos de forma exacta y nunca texto libre.
12. **Inmutabilidad:** `riesgo_evaluacion`, `criterios_version`, `riesgo_aceptacion`, `plan_aprobacion` y las tablas congeladas dejan a la aplicación solo `select` e `insert`. Toda tabla nueva lleva `empresa_id`, RLS forzada y su prueba de aislamiento.

## Alternativas

- **Guardar la aceptación como un campo del riesgo.** Pierde la historia y no deja ver cuándo dejó de ser vigente. Se descarta.
- **Que cambiar el estado de una acción devuelva el plan a borrador.** Haría imposible que el colaborador avance sus acciones sin invalidar la aprobación. Se usa la huella de contenido.
- **Bloquear la Declaración si falta la aceptación.** Confunde dos actos distintos. Se prefiere advertir (Q6).
- **Esperar a OpenFGA para el permiso por objeto.** Retrasa el módulo por un solo caso; se resuelve en el caso de uso y se anota la migración.
- **Copia congelada con notas y nombres.** Añade datos personales inmutables sin vía de supresión (ADR 028, insumo 12). Se descarta.

## Estándar y licencia

Sin dependencias nuevas. No incluye texto de normas: solo identificadores y guía propia. «Retener», «modificar», «compartir» y «evitar» siguen la terminología habitual del tratamiento del riesgo. Pendiente de confirmar con el ejemplar de la NTE INEN-ISO/IEC 27001:2023 (cláusulas 6.1.2, 6.1.3, 8.2 y 8.3): qué información documentada debe conservarse, quién aprueba el plan y acepta el residual, y los términos exactos de las opciones de tratamiento.

## Consecuencias

- El módulo cubre lo que un auditor de la Etapa 2 espera del análisis, tratamiento y aceptación del riesgo; la Declaración deja de rotularse «sin residual» cuando existe.
- `PUT /riesgos/{id}` cambia de forma incompatible: se ajustan `web:verify-riesgos` y `web:verify-declaracion`.
- Se agregan al ADR 028 como insumos del asesor legal: el nombre en el directorio, las constancias y las notas.
- **Sigue fuera:** riesgos secundarios, de proceso y de IA, oportunidades, controles adicionales como filas propias, responsable por control, cortes configurables, notificaciones, comparar versiones y la pantalla de Revisión por la dirección.
- **Solo datos de prueba** hasta que el asesor legal valide el ADR 028.
