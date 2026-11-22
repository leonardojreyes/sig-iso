# Plan — Etapa A · Gestión de riesgos completa

## Contexto

La «Declaración justificada» (#28, en `main`) dejó un registro **mínimo** de riesgos y avisos fijos en el Word. Este módulo cierra lo que un auditor de 27001 espera: activos, criterios propios, evaluación con historia, plan de tratamiento, riesgo residual y su aceptación formal. Spec: `docs/specs/gestion-riesgos-completa/spec.md` (borrador; se asume la propuesta por omisión de Q1–Q9 **más los ajustes de abajo**, que son tuyos de aprobar). El producto no decide nada: calcula nivel, avisa y congela.

Al aprobar: se guarda como `docs/specs/gestion-riesgos-completa/plan.md`, se ajusta el spec, se abre el ADR 038 «Propuesto» y se pasa a `/tasks`.

Revisado por `arquitecto`, `revisor-cumplimiento` y `experto-iso`: **encontraron bloqueantes; este texto ya los incorpora** (pendiente que confirmen en una segunda pasada breve antes de `/tasks`).

## Hallazgos del código que condicionan el diseño

- `modules/certificacion` hexagonal. `riesgo` hoy: `probabilidad`, `impacto`, `decision`, `responsable_id` nulo salvo `aceptar`; sin delete; update por columnas (0020). Migración libre: **0026** (de la 0021 a la 0025 las usaron control documental (0021, 0022) y auditoría interna (0023 a 0025)). Último ADR: 037 → **038**.
- Sin puerto de personas en certificación (solo `responsable_id` con FK compuesta a `usuario`); `GET /personas` es solo administrador.
- Bitácora: lista cerrada en `platform/auditoria/src/dominio/catalogo.ts`; `despues` solo claves de tipo cerrado; nunca texto libre.
- Contrato: `contrato.test.ts` fija la lista **exacta** de textos libres por operación (todos con `maxLength`); `esquemas-riesgos.ts` duplica esquemas; `conformidad-openapi.test.ts` compara Nest vs contrato.
- Toda tabla nueva se declara en 3 sitios de `privilegios.integration.test.ts` y lleva su `aislamiento-*.integration.test.ts`.

## Ajustes al spec que propone este plan (a aprobar)

1. **Renombrar la decisión «aceptar» → «retener»** (evita confundirla con la _aceptación formal_ del residual). Migración de datos del valor y del contrato (`decision`).
2. **«Transferir» siempre tiene residual** (se evalúa y se acepta); si el responsable afirma que no queda nada, exige nota y constancia. **«Evitar» solo es «no requiere»** cuando la acción de eliminación está **«hecha»**; antes sigue valiendo el análisis vigente.
3. **Residual «esperado» vs «confirmado»:** el residual se etiqueta; aceptar con acciones sin «hecha»/sin verificación o con plan sin aprobar **advierte**. «Tras el tratamiento» sale de los motivos de revaluación del análisis; se agrega «cambio de criterios o de contexto».
4. **Tope del residual contra el análisis vigente** (no contra el inicial); al revaluar el análisis, el residual queda «por revisar».
5. **Vigencia de la aceptación (corrige la regla 5, que contradecía a H5.3):** se guarda el id del análisis vigente, el id del residual (o referencia al análisis si decisión «retener»), la decisión, el responsable y el `nivel_aceptacion`; deja de ser vigente si **cualquiera** cambia. Cambiar solo descripciones de criterios no la invalida (se marca «evaluado con criterios anteriores»).
6. **Sin `nivel_aceptacion` explícito de la empresa no se registran aceptaciones** (se rotula «sin criterios propios» en pantalla y Word).
7. **Aceptación excepcional:** además de `autoriza_id`, exige constancia propia (tipo, ubicación recuperable, fecha), alerta si autorizador = responsable = quien registra, y **vencimiento** (revisión corta, plazo máximo configurable).
8. **Aprobación del plan:** solo cambios de **contenido** (descripción, tipo, responsable, fecha, control, alta/baja de acciones), de **decisión** o de **responsable del riesgo** la devuelven a borrador; el estado/nota/fecha real que cambia el colaborador **no**. Se implementa guardando en `plan_aprobacion` una **huella del conjunto de acciones** (sin campo mutable ni acoplamiento transaccional).
9. Avisos de «sin acciones» también para «transferir» y «evitar»; «mitigar» sin control (en acción o vínculo) se señala. No se acepta ni se aprueba plan sin responsable.
10. **Revisión sin cambio:** tipo `revision` en el historial; `proxima_revision` por omisión = un año tras la última revisión.
11. **Copia congelada:** solo **identificadores opacos, enums, números y conteos**. Quedan fuera notas, justificaciones, escenario, constancias y nombres; prueba de que esas columnas no existen en las tablas congeladas.
12. Resumen para la revisión por la dirección (H6.6): distribución por nivel (inicial/residual), riesgos sobre el nivel de aceptación, acciones por estado y sin verificación, cambios desde un corte (filtro por fecha).
13. Spec §5: agregar al cuadro de datos las referencias de constancia, nota de verificación, `escenario` y nota del motivo (con `maxLength`) y la fila del **nombre en el directorio** (finalidad, base, minimización; depende del asesor legal, ADR 028).

## Decisiones de diseño (ADR 038, «Propuesto» al empezar A1; «Aprobado» en C4)

1. **Evaluación como historial append-only** `riesgo_evaluacion` (`inicial | revaluacion | revision | residual`, probabilidad, impacto, motivo, nota, versión de criterios o «por omisión», marca `migrada`, autor, fecha). `riesgo.probabilidad/impacto` siguen siendo el análisis vigente, actualizado en la misma transacción; **prueba de integración de coherencia** tras cada operación. El `PUT /riesgos/{id}` pierde probabilidad e impacto (cambio de contrato incompatible: contrato primero y ajuste de `web:verify-riesgos` y `web:verify-declaracion`). Backfill: una evaluación `inicial` «migrada» por riesgo, con hecho de bitácora propio (`evaluacion.migrada`, actor de sistema); copias congeladas intactas.
2. `escenario`, `proxima_revision`, responsable obligatorio **en la aplicación** (no `NOT NULL`, por filas previas, que se listan «incompleto»).
3. **Criterios versionados** `criterios_version`, inmutables; sin filas = escala por omisión rotulada.
4. **Aprobación del plan ≠ aceptación del residual**: `plan_aprobacion` y `riesgo_aceptacion` separadas; constancia con tres datos (responsable, quien registra, constancia). «Misma persona» se **deriva** (no se guarda); «excepcional» **sí** se guarda.
5. **Inmutabilidad en BD:** `riesgo_evaluacion`, `criterios_version`, `riesgo_aceptacion`, `plan_aprobacion` y tablas congeladas → solo `select`/`insert` para la app, reflejado en la matriz de privilegios.
6. **Permisos:** `activos.ver|gestionar`, `criterios.ver|gestionar`, `riesgos.aceptar` (solo administrador, Q4), `acciones.estado` (colaborador, sus acciones, Q5). Es el **primer permiso por objeto**: se resuelve en el caso de uso (método separado `cambiarEstadoAccion` que solo toca `estado`, `nota`, `fecha_real`, con versión esperada), no cumple el disparador de OpenFGA del ADR 029; el ADR deja constancia de que migrará a tuplas. Pruebas negativas: acción ajena, y administrador responsable.
7. **Directorio de personas (A1, no A3):** puerto `DirectorioPersonasPort` en `application` (`listar`, `existeActiva`), adaptador Kysely en `infrastructure` sobre `usuario` con empresa de la sesión; **no se importa** código de otros módulos. Endpoint `GET /certificacion/personas` (solo `id`, `nombre`, `activa`; permiso `riesgos.ver`; sin motivo ni fecha de baja). Una persona dada de baja no puede asignarse como responsable nuevo. Excepción exacta en `contrato.test.ts`. El nombre nunca se persiste fuera de `usuario` ni va a bitácora.
8. **Q6:** faltar aceptación/plan aprobado **advierte**, no bloquea aprobar la Declaración.

## Bitácora (P15): acciones y objetos (tabla completa en el ADR/tasks)

Todas en la misma transacción, `despues` solo enums/números/uuid/fechas, prueba que rechaza texto libre.

- Activos: `activo.creado|cambiado|retirado` (`activo:A-001`); `activo.ligado|desligado` (`vinculo:R-001.A-001`).
- Criterios: `criterios.cambiados` (`criterios:v3`).
- Evaluación: `evaluacion.registrada` (`evaluacion:R-001.E2`, tipo en `despues`), `evaluacion.migrada`; `riesgo.cambiado` ya cubre escenario, responsable y `proxima_revision` (solo qué campos cambiaron).
- Acciones: `accion.creada|cambiada|estado_cambiado|verificada` (`accion:R-001.T1`).
- Plan: `plan.aprobado` (con `constancia_tipo`), `plan.devuelto_a_borrador` (actor = quien cambió; motivo enum).
- Residual/aceptación: `residual.registrado`, `riesgo.aceptado` (nivel enum, `excepcional` bool, `autoriza` como bool de presencia), `evitar.confirmado`.
- Declaración: `declaracion.aprobada` suma conteos nuevos.

## Rebanadas (rama `feature/gestion-riesgos-*`, TDD, PR por hito, **un `/review` al final** + una pasada breve de `arquitecto` al cierre del hito B)

### Hito A — Fundamentos (H1–H3)

- **A1 Activos + directorio** — `0026` (`activo` código `A-001`, `riesgo_activo`; RLS forzada; sin delete; update por columnas), ADR 038 «Propuesto», directorio (decisión 7), casos de uso, contrato, controlador, pantallas `/e/<empresa>/activos`, aviso previo al retiro; `aislamiento-activos`.
- **A2 Criterios** — `0027`, pantalla y matriz 5×5 con palabra + número.
- **A3 Evaluación y revisión** — `0028` (`riesgo_evaluacion`, `escenario`, `proxima_revision`, backfill «migrada», renombre `aceptar → retener`), revaluación, revisión sin cambio, marcas de vencidas (fecha de Ecuador).

### Hito B — Tratamiento y residual (H4–H5)

- **B1 Acciones** — `0029` (`accion_tratamiento`, verificación de eficacia, control vinculado opcional, vencida derivada, aviso si el control no está implementado).
- **B2 Plan** — `plan_aprobacion` con huella del conjunto de acciones; estado derivado.
- **B3 Residual y aceptación** — `0030` (`riesgo_aceptacion`, tope ≤ análisis vigente en dominio y `check` donde aplique); `estadoDeAceptacion` pura, recibe análisis vigente, residual, aceptación, `nivel_aceptacion` y decisión; excepcional con constancia y vencimiento.

### Hito C — Declaración, Word y cierre (H6)

- **C1** `0031`: copia congelada ampliada (decisión 11), inmutable; versiones anteriores quedan con nulos y el Word lo dice.
- **C2** `GeneradorDocumentoDocx`: activos, residual, aceptación, plan, criterios; avisos ajustados; texto plano. **Prueba que escanea `es-EC.ts` y la plantilla Word buscando párrafos largos** (sin texto de normas).
- **C3** resumen consultable (`GET /riesgos/resumen`) y advertencias en la Declaración.
- **C4** `pnpm web:verify-riesgos-completos` (todo real, repetible, bajo 120/min), STRIDE (`docs/security/stride-gestion-riesgos.md`), clasificación de datos, ADR 038 y 037 → «Aprobado», `hoja-de-ruta.md` y `estado.md` en el mismo PR, `/review` único.

## Archivos críticos (patrón)

- `modules/certificacion/src/domain/` (`riesgo.ts` + nuevos `activo`, `criterios`, `evaluacion`, `accion-tratamiento`, `plan`, `aceptacion`), `application/` (`repositorios.port.ts`, `contexto.ts`, `riesgos.use-cases.ts`, `declaracion.use-cases.ts`→`armarCopia`; `index.ts` solo con lo que consume `apps/api`), `infrastructure/*-kysely.adapter.ts`, `unidad-de-trabajo-certificacion.ts`, `generador-documento-docx.adapter.ts`.
- `platform/db/migrations/0026…0031` y `platform/db/src/aislamiento-*`, `privilegios.integration.test.ts`.
- `platform/autorizacion/src/roles.ts`, `platform/auditoria/src/dominio/catalogo.ts`, `packages/contracts/openapi.yaml` (+ `contrato.test.ts`, `generar-tipos.mjs`).
- `apps/api/src/certificacion/*.controller.ts`, `esquemas-riesgos.ts`, `tokens.ts`, `composicion.ts`; `apps/web/src/certificacion/escribir.ts`, `auth/guardia-formulario.ts` (reutilizar), `src/pantallas/*`, `src/i18n/es-EC.ts`.
- Reutilizar: `calcularNivel`/`CORTES_NIVEL`, `exigirPermiso`, `ConflictoDeVersionError`, `versionEsperada`, `siguienteNumero` con reintento.

## Riesgos

- Migrar riesgos existentes sin alterar versiones aprobadas → backfill solo agrega filas; prueba que lo verifica.
- Colaborador sobre acciones ajenas → caso de uso + prueba negativa (sin RLS posible).
- Datos personales → directorio mínimo, copia congelada sin texto libre, nada a bitácora; sigue «solo datos de prueba» hasta el asesor legal (ADR 028).
- Cambio de contrato incompatible (`PUT /riesgos`, `retener`) → contrato primero y verificadores ajustados.
- Tamaño (≈26 tareas, 3 hitos) → PR por hito.
- Términos de tratamiento y 6.1.2/6.1.3/8.2/8.3 «a confirmar» con tu NTE INEN-ISO/IEC 27001:2023.

## Verificación

- Por tarea: `pnpm lint`, `pnpm typecheck`, `pnpm test` (≥ 80 % dominio); integración en `sigiso_test` con aislamiento por tabla nueva (A intenta leer/ligar/aceptar lo de B y falla; sin la política, la prueba falla).
- Contrato: `conformidad-openapi`, `contrato.test.ts`, tipos regenerados.
- Extremo a extremo: `pnpm web:verify-riesgos-completos` y los verificadores existentes ajustados.
- Manual: activo → criterios → revaluar → acciones → aprobar plan → residual → aceptar (normal y excepcional) → aprobar Declaración → abrir el Word (residual, aceptación, avisos) → versión antigua intacta.
