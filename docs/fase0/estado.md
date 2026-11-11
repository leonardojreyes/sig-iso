# Estado de la Fase 0 — sig-iso

**Léelo primero al iniciar cualquier sesión.**

- **Paso actual:** **MVP de certificación** (plan ágil, `docs/specs/mvp-certificacion/plan.md`): **M1, M2 y M3 hechos**; siguen M4, M5 y M6. Ver la sección «MVP de certificación — qué está hecho». El **0.7 (puerto de IA)** quedó en preparación (spec aprobado en el PR #13, cimientos en el #14) y el plan lo deja **fuera del MVP**.
- **Pasos cerrados:** 0.1, 0.2, 0.3, 0.4 (#1 y #3), 0.5 (#4) y **0.6 (cerrado el 2026-11-09; PR #5 a #11)**. Siguen fuera del MVP: el resto del 0.7, el 0.8 y el 0.9.
- **PR (2026-11-11):** `main` incluye los PR #1, #3 a #12, #15 (cierre formal del 0.6), #18 (spec del modelo de dominio v2) y #19 (**MVP M1**, Anexo A de 27001). El #2 se cerró a propósito (PR de prueba que viola las reglas). **Abiertos:** #13 (spec, plan y tareas del 0.7), #14 (cimientos del puerto de IA), #16 y #17 (documentos) y **#20 (MVP M2 + M3, hito H2)**. La protección de `main` exige los **7 checks**, incluido `integracion`, y que la rama esté al día. Regla de trabajo: nada se confirma ni se empuja directo en `main`; cada tarea o grupo de tareas va en una rama `feature/…`, con PR y los 7 checks en verde, y el merge lo haces tú.
- **Rama del MVP:** M2 y M3 están en `feature/mvp-m2-m3`, rebasada sobre `main` el 2026-11-11 y **abierta como PR #20 (hito H2)**. La antigua `feature/mvp-m2-diagnostico` de GitHub quedó obsoleta (tiene la historia previa al rebase y se puede borrar).
- **Corte 0.6 cerrado: 65 de 70 tareas hechas.** Las 5 restantes no bloquean: **4.4** (tuya), **9.2 y 9.3** (OpenFGA, pospuestas por el ADR 029) y **11.2 y 11.3** (worker de intentos fallidos, diferidas a la Fase 1). Plan en `docs/specs/corte-vertical-0-6/`; `/review` completo sin bloqueantes en `docs/revisiones/2026-11-09-review-corte-0-6.md`.

## MVP de certificación — qué está hecho

Plan vigente: `docs/specs/mvp-certificacion/plan.md` (manda sobre los specs largos; proceso ágil: una rama por rebanada, TDD, PR por hito y **un solo `/review` completo al final**). Código en `modules/certificacion` (hexagonal: dominio, aplicación, infraestructura), la API en `apps/api/src/certificacion/` y las pantallas en `apps/web`. Migraciones `0006` a `0008`.

| Hito | Qué entrega | Estado |
| --- | --- | --- |
| **M1** | Anexo A de ISO/IEC 27001:2022 como librería propia (**93 controles** planos, con tipo y grupo, guías de SynapTech; «borrador, numeraciones sin verificar»), esquema de librerías v3 y migración `0006`; el listado de requisitos muestra tipo y grupo | **Hecho** (`5bc949b`) |
| **M2** | **Alcance** por norma (texto y aprobación con quién y cuándo) y **diagnóstico**: estado por entrada (cumple, parcial, no cumple, no aplica; «sin evaluar» = no hay fila), comentario, fecha objetivo, **madurez** por norma, capítulo y tema, y concurrencia optimista por versión | **Hecho** |
| **M3** | **Controles de la empresa** y **mapeos** muchos a muchos con las entradas de las normas adoptadas (**marco de controles unificado**: una medida, varias normas) | **Hecho** |
| M4 | Evidencias con archivo (huella SHA-256, vigencia, reemplazo, descarga protegida) y cobertura. Requiere el ADR 032 (almacén de archivos) | Pendiente |
| M5 | Declaración de Aplicabilidad de 27001 derivada del diagnóstico y los controles, aprobación con versión congelada y exportación a Word. Requiere el ADR 033 | Pendiente |
| M6 | Cierre: `/review` completo, STRIDE ampliado (subida, descarga, exportación), este archivo y la guía de ejecución | Pendiente |

**M2 y M3 en detalle** (para no tener que releer el código):

- **Tablas** (todas con `empresa_id`, RLS forzada y clave foránea compuesta con la empresa; una prueba de aislamiento por tabla): `alcance` y `evaluacion` (`0007`), `control` y `control_mapeo` (`0008`). La aplicación **no puede borrar** alcances, evaluaciones ni controles: un control se **retira** y su código no se reutiliza. Los mapeos sí se pueden quitar (con rastro). Las entradas de las normas se referencian por `(código de librería, id estable)` **sin clave foránea**, con la versión de la librería fijada al evaluar, así una versión nueva de la librería no deja nada huérfano.
- **API** (contrato primero en `packages/contracts/openapi.yaml`, 19 operaciones protegidas en total): `GET/PUT /alcances`, `POST /alcances/aprobacion`, `GET /diagnostico`, `PUT /diagnostico/evaluaciones`, `GET/POST /controles`, `PUT /controles/{id}`, `POST /controles/{id}/retiro`, `POST /controles/{id}/mapeos` (201 o 200 si ya existía) y `POST /controles/{id}/mapeos/eliminacion` (204). Orden de evaluación **401 → 403 → 400 → 404 → 409**: el permiso se decide antes que la forma, y un recurso de otra empresa es un 404 indistinguible de uno inexistente. El contrato tiene un código nuevo, `409 conflicto` (versión vieja, código repetido, control retirado, tope de 50 mapeos por control).
- **Pantallas** (`/e/<empresa>/…`): `diagnostico`, `alcance` y `controles`, con navegación propia. Las escrituras son formularios `POST` hacia rutas propias de la web que verifican el `Origin`, que la empresa de la dirección sea la verificada y una lista cerrada de campos, y reenvían a la API con el token de la sesión; **la web no decide nada**. El resultado vuelve como un aviso de una lista cerrada. Un 403 se muestra como «sin acceso», sin revelar qué existe.
- **Permisos** (`platform/autorizacion`): el administrador SIG tiene todo; el colaborador consulta el alcance, el diagnóstico y el marco de controles y puede evaluar; los demás roles todavía no pueden nada (ADR 029). Permisos nuevos: `diagnostico.ver|evaluar`, `alcance.ver|gestionar|aprobar`, `controles.ver|gestionar`.
- **Bitácora** (acciones nuevas, siempre dentro de la misma transacción que el cambio): `evaluacion.cambiada`, `alcance.cambiado|aprobado`, `control.creado|cambiado|retirado`, `mapeo.creado|eliminado`. Solo estados, banderas y el objeto: **nunca** el comentario, el texto del alcance ni el nombre o la descripción de un control.
- **Verificación de extremo a extremo** con todo real (Keycloak, API, PostgreSQL y web): `pnpm web:verify-diagnostico` (44 comprobaciones) y `pnpm web:verify-controles` (51). Cubren permisos por rol, `Origin`, concurrencia y aislamiento con la empresa B. **Escriben en tu base local** (marca `VERIF-`): los controles de prueba quedan retirados, no se borran.
- **Medición del 2026-11-11:** `pnpm lint` sin errores (queda un aviso que ya existía), `pnpm typecheck` y `pnpm test` en verde (16 de 16 tareas).

**Límites conocidos del MVP** (decisiones ya tomadas; no son defectos pendientes de corregir):

- Las pantallas **no asignan responsable** (ni en el diagnóstico ni en los controles), aunque la API lo admite. Hoy nada lo asigna; cuando se agregue, reevaluar una entrada debe conservar el responsable.
- «Aprobar» el alcance aprueba el texto **ya guardado**, no lo que esté escrito en la caja; la pantalla lo dice.
- El `409 conflicto` de la API es genérico (el contrato es deliberadamente cerrado); el aviso de la web enumera las causas posibles.
- Un mapeo cuya entrada dejó de estar adoptada se sigue mostrando, sin título y rotulado, y no suma normas al control.
- Solo el administrador SIG gestiona controles y alcance; que el colaborador **proponga** cambios queda para después.
- **Solo datos de prueba** hasta que el asesor legal valide el ADR 028 (sin cambios).
- El campo `nombre` de un control es el título de una medida, no el de una persona: por eso tiene una **excepción explícita** en la prueba de privacidad del contrato (el resto de los cuerpos de petición no admite nombres).

## Corte 0.6 (cerrado) — qué está terminado

- **Catálogo:** `pnpm libraries:load` (4.5) carga las librerías con el rol del catálogo, de forma idempotente, todo o nada, con la huella de cada versión y un hecho de plataforma por carga.
- **Base de datos y aislamiento:** PostgreSQL 16 con RLS, roles `sigiso_*`, migraciones 0001–0005, prueba de aislamiento entre empresas (fases 1 y 2).
- **Bitácora inmutable** encadenada por huellas, con intentos fallidos y mantenimiento (fase 3). ADR 028 de privacidad **aprobado como provisional** (2026-11-08), pendiente del asesor legal.
- **Librerías de normas:** esquema v2, validador con control de texto en el CI, borrador `0.1.0` de la librería de ejemplo (4.1 a 4.3 y 4.6).
- **Dominio y casos de uso** de empresas y normas: marca, catálogo, adopción, listado y consulta con 404 indistinguible (fase 5).
- **API completa** (fase 6): contrato OpenAPI, verificación de tokens, guardia, filtro de 403/404 cruzado, controladores, límite de frecuencia, conformidad del contrato.
- **Autorización por rol desde la base** (ADR 029, tarea 9.4): `usuario.rol` y matriz en código. OpenFGA 1.22.1 instalado pero **pospuesto**.
- **Keycloak 26.8.2 local** (fase 8): realm sin secretos, arranque en 127.0.0.1, ingreso real verificado, mensaje genérico de credenciales inválidas, clientes integrados deshabilitados.
- **Ingreso y portada reales** (10.8): una sola acción hacia Keycloak (la aplicación no pide contraseña), avisos genéricos de error y, con sesión, la portada lleva al listado de la empresa.
- **Adopción desde la pantalla** (10.7): botón solo para el administrador SIG, con `Origin` verificado y aviso de las entradas disponibles.
- **Listado de requisitos real** (10.6): las entradas de las librerías adoptadas con filtros, rótulo de ejemplo y estados vacíos por rol; la cabecera muestra a la persona real.
- **Web, hasta la 10.5:** ingreso OIDC con PKCE, sesión (cookie sellada, renovación, cierre), proxy que protege `/e/<empresa>/…` (404 idéntico a otra empresa, sin caché) y **marca real de la empresa**. Verificado de extremo a extremo con `pnpm web:verify-login` (36 comprobaciones).
- **Siembra** de dos empresas y cuatro cuentas de prueba, `pnpm ram:report`, trazas mínimas y un flag de OpenFeature.

## Corte 0.6 — lo que queda fuera del cierre (5 tareas)

- **4.4 (tuya, no bloquea):** verificar numeraciones y guías con tus ejemplares y decidir sobre los títulos (`docs/specs/corte-vertical-0-6/verificacion-numeraciones.md`). Mientras tanto la librería de ejemplo `0.1.0` está **cargada en la base local**, marcada «borrador, numeraciones sin verificar»; al verificar se publica la versión siguiente.
- **9.2 y 9.3:** OpenFGA, pospuestas por el ADR 029 hasta que haya permisos por objeto. La autorización por rol funciona desde la base.
- **11.2 y 11.3 (diferidas a la Fase 1, M5):** el worker de intentos fallidos y de eventos de administración. El código de 11.1 queda en el repositorio, probado; la bitácora acepta esos registros, pero nada los alimenta todavía, y la prueba de aislamiento no cubre el paso «intento fallido → bitácora desde Keycloak».

## Pendiente del responsable

1. **PR #20 (hito H2, M2 + M3):** abierto; necesita los 7 checks en verde y tu merge. El **#14** (cimientos de IA) sigue abierto y cambia `platform/autorizacion/src/roles.ts`: se integre antes o después, se resuelve **fusionando `main` en `feature/mvp-m2-m3`** (sin reescribir historia) y juntando su lista de permisos con la del MVP. Después del merge del #20, se puede borrar la rama obsoleta `feature/mvp-m2-diagnostico`.
2. **Aprobar o ajustar el recorte del 0.7** y el ADR 030 (modelo por defecto del asistente), propuestos tras la prueba previa, e integrar el **#13** cuando quieras. El plan del MVP deja todo esto para después, así que no bloquea.
3. **Ramas ya integradas** (se pueden borrar, en local y en GitHub): `feature/docs-fase0-skills`, `feature/paso-0-5-look-and-feel`, `feature/paso-0-6-librerias`, `feature/paso-0-6-plataforma`, `feature/paso-0-6-adopcion`, `feature/paso-0-6-ingreso`, `feature/paso-0-6-cierre`, `feature/paso-0-6-aislamiento-e2e`, `feature/proteger-local`, `feature/mvp-m1-anexo-a`, `docs/cierre-paso-0-6`, `docs/spec-dominio-v2`, la obsoleta `feature/mvp-m2-diagnostico`, `docs/estado-paso-0-4` y `fix/pipeline-bootstrap`. Dejar `feature/prueba-violacion-reglas` (PR #2 cerrado) mientras sirva de ejemplo, y las ramas del 0.7 (`feature/spec-ia-0-7`, `feature/ia-cimientos`) hasta integrarlas.
4. **Numeraciones y títulos de la librería de ejemplo (4.4)** cuando tengas los ejemplares: `docs/specs/corte-vertical-0-6/verificacion-numeraciones.md`.
5. **Asesor legal para el ADR 028** (aprobado como provisional el 2026-11-08): validar bases de tratamiento, retención, derechos de las personas y el rol de SynapTech (`docs/adr/028-privacidad-y-bitacora.md`, «No resuelto» e «Insumos para el asesor legal»). **Bloquea el uso con datos de personas reales**, incluido el personal de SynapTech, y en todo caso al primer cliente externo.
6. **A1 de la revisión de calidad** (el repositorio de GitHub es público): decisión tuya, pendiente; requiere un ADR. Sus demás hallazgos (`docs/revisiones/2026-11-08-revision-calidad-fase0.md`): M1, M5 y la protección de `.local/` resueltos; A2, M3 y M4 son prerrequisitos de la Fase 1 (abajo); **M2** conviene al pasar por la migración de adopción y **B1–B4** al pasar por esos archivos.
7. Corregir o quitar el `GITHUB_TOKEN` inválido de `~/.zshrc` (mientras tanto, `env -u GITHUB_TOKEN` en `git` y `gh`).
8. Para más adelante: integrar OpenFGA cuando haya permisos por objeto (ADR 029); decidir si `acceso.cruzado` se registra también para el catálogo global (ver H6.10 abajo).

Base local lista: `pnpm db:init`, `pnpm db:migrate` y `pnpm db:seed` dejaron los roles y las bases `sigiso`, `sigiso_test` y `openfga` con el esquema migrado (**hasta la `0008`**) y las dos empresas de prueba; `pnpm libraries:load` carga las librerías (la de ejemplo y, desde M1, el Anexo A de 27001; si todavía no adoptaste esta última, hazlo desde la pantalla de requisitos); las claves están en `.env.local` y `.local/` (ignorados). La empresa A ya adoptó la librería de ejemplo (ver «Brechas y avisos»). Los scripts `web:verify-diagnostico` y `web:verify-controles` dejaron en tu base datos de prueba de A: una evaluación, un alcance y controles `VERIF-…` retirados.

## Próximos pasos técnicos

1. **Integrar el PR #20 (H2)** y resolver `roles.ts` con el #14 (ver «Pendiente del responsable»).
2. **M4 — evidencias con archivo.** Primero el ADR 032 (almacén de archivos detrás de `AlmacenArchivosPort`, adaptador de sistema de archivos local; lista cerrada de tipos por la firma del contenido; 25 MB; huella SHA-256), migración `0009`, subida y descarga protegida, reemplazo y **cobertura** (una evidencia respalda varias entradas).
3. **M5 — Declaración de Aplicabilidad de 27001.** ADR 033 (`docx` detrás de `GeneradorDocumentoPort`, licencias comprobadas con `scripts/check-licenses.mjs`), derivada del diagnóstico y los controles, marcada preliminar, aprobación con versión congelada e inmutable y exportación a Word.
4. **M6 — cierre del MVP:** un solo `/review` completo (arquitecto, multiempresa, seguridad y cumplimiento), STRIDE ampliado, este archivo y `docs/fase0/guia-de-ejecucion.md`.
5. **Después del MVP:** el resto del 0.7 (IA local, modelo pequeño con su tamaño informado antes de descargar), 0.8 (Helm y OpenTofu validados, sin clúster) y 0.9; y los prerrequisitos de la Fase 1 de abajo que el MVP no resolvió.


- **Actualizado:** 2026-11-11

## Prerrequisitos de la Fase 1 (de la revisión de calidad del 2026-11-08)

**No se empieza la Fase 1 sin resolver estos tres puntos.** Se abordan juntos con un `/spec` de «modelo de dominio v2 y esquema de librerías v3», validado con `experto-iso`, más los ADR correspondientes.

- **A2 · Esquema de librerías limitado a la Estructura Armonizada.** `libreria_entrada` (migración 0002) exige `capitulo between 4 and 10` y `nivel in (1, 2)`, y `packages/normas-schema/libreria-norma.schema.json` tiene la misma restricción. No admite los controles del Anexo A de 27001 ni de 42001 (base de la Declaración de Aplicabilidad) y contradice P14. Corrección: tipo de entrada `clausula | control | objetivo`, sección/tema libre, jerarquía de profundidad variable con `padre_id`, atributos propios por norma; migración nueva + ADR + una librería de prueba con controles de Anexo A.
- **Avance con el MVP (2026-11-11):** **A2** quedó resuelto en lo mínimo con M1 (migración `0006` y esquema v3: `tipo` `clausula` o `control`, `grupo`, `capitulo` opcional en los controles, y la librería del Anexo A de 27001); siguen pendientes la jerarquía con `padre_id`, el tipo `objetivo`, los atributos por norma y las librerías de 42001 y 9001. **M4** (el alcance) quedó cubierto con un texto por norma y su aprobación; sedes y exclusiones en tablas, Certificado, Activo de información, evaluación de impacto de IA, orígenes de NC y clasificación de hallazgos siguen pendientes. **M3** (roles múltiples) sigue pendiente: el MVP funciona con un solo rol por persona.
- **M3 · Un solo rol por persona.** Pasar a roles múltiples (`usuario_rol` con vigencia opcional) y modelar la relación persona–proceso para validar la independencia del auditor (no audita su propio trabajo) y el acceso limitado en el tiempo del auditor externo. Hoy `usuario.rol` y la matriz en código (ADR 029, tarea 9.4) asumen un solo rol.
- **M4 · Entidades que faltan en el modelo de dominio** (`docs/producto/modelo-dominio.md`): Certificado (número, organismo, alcance, emisión, vencimiento, estado); Alcance por norma con sedes y exclusiones justificadas; Activo de información; Evaluación de impacto de sistemas de IA (42001); orígenes de No conformidad (queja, incidente, revisión por la dirección); clasificación de hallazgos de auditoría externa (NC mayor, NC menor, observación, oportunidad de mejora) y plazos de cierre.

## Brechas y avisos del cierre del corte 0.6

- **H6.10 · el 404 cruzado no se registra como `acceso.cruzado`.** El evento existe y el filtro de la API lo maneja, pero ningún código de producción lo emite y el proxy de la web responde 404 sin escribir en la bitácora. La indistinguibilidad del 404 sí está verificada. Resolverlo en la Fase 1 (detectar «otra empresa» comparando el slug de la URL con la empresa del token).
- **`pnpm web:verify-listado` adopta la librería para la empresa A** si no estaba adoptada (lo advierte su cabecera). `web:verify-aislamiento` no adopta nada.

## Respuestas de arranque (`/fase0-inicio`)

| #   | Pregunta                      | Respuesta                                                                |
| --- | ----------------------------- | ------------------------------------------------------------------------ |
| 1   | Nombre de código              | `sig-iso` (se mantiene)                                                  |
| 2   | Destino del primer despliegue | Solo local por ahora (0.8 deja Helm/OpenTofu validados, sin clúster)     |
| 3   | Revisores humanos de PR       | Solo el responsable                                                      |
| 4   | Repositorio GitHub            | Autorizada su creación (se hará en 0.2; visibilidad privada por defecto) |
| 5   | Ollama                        | Modelo pequeño (~3B), local; tamaño a informar antes de descargar (0.7)  |

## Decisiones

ADR 001–025, 027 y 029 aprobados; ADR 026 aprobado el 2026-11-08; ADR 028 aprobado como **provisional** (falta el asesor legal). Índice: `docs/adr/README.md`.

## Pendientes

- ORM y migraciones: decididos en el ADR 024 (Kysely y migraciones SQL) y en uso desde el corte 0.6.
- Sin Docker (ADR 022): PostgreSQL 16 nativo (Homebrew); Keycloak 26.8.2 y su JRE en `.local/` (ADR 025); OpenFGA 1.22.1 instalado pero sin uso (ADR 029). Falta instalar Valkey (`brew install valkey`) cuando se construya la cola.
- Repo remoto **público** (decisión del responsable, para habilitar protección de ramas sin plan de pago): https://github.com/leonardojreyes/sig-iso . `GITHUB_TOKEN` del entorno es inválido: usar `env -u GITHUB_TOKEN gh ...` y `env -u GITHUB_TOKEN git push ...`.
- TypeScript fijado en 5.9 (la v7 nativa rompe typescript-eslint).
- Librería de DOCX: el plan fija `docx` (MIT) en el ADR 033, que se escribe al empezar M5 y completa el ADR 021; PDF queda fuera del MVP.
- Revisión de `experto-iso`: los subagentes existen desde 0.3 (`.claude/agents/`); el responsable valida las numeraciones de las normas con sus ejemplares (4.4).
- Nota: `CLAUDE.md` global prefiere npm; el monorepo usa pnpm (ADR 003).

## Próximos pasos de la Fase 0

0.1 a 0.6 cerrados → **MVP de certificación (en curso: M1 a M3 hechos; M4 a M6 pendientes)** → resto del 0.7 → 0.8 → 0.9

## Paso 0.3 — notas

- Creados: `CLAUDE.md` raíz (56 líneas) y por carpeta (`apps/`, `modules/`, `docs/`, `libraries/`), `.claude/settings.json`, hooks Node en `.claude/hooks/`, 8 subagentes y 8 comandos.
- Los subagentes y comandos nuevos se cargan al **reiniciar la sesión de Claude Code**; la demostración se revisó manualmente con sus listas de control.
- Hooks probados: bloquean `.env*` (también rutas Windows), borrado recursivo forzado, `push` a `main`; permiten `.env.example`, `pnpm test`, push a `feature/*`.
- **Skills creados (2026-11-08):** `.claude/skills/{modulo-hexagonal,migracion-rls,libreria-normas,endpoint-contrato}/SKILL.md`, cada uno con cuándo usarlo, pasos, ejemplo y criterio de terminado, basados en la estructura real del repositorio (`modules/empresas` y `modules/normas`, `platform/db/migrations`, `packages/normas-schema`, `packages/contracts`, `apps/api`) y en los ADR 001, 010, 024, 025, 026, 027 y 029. Con esto existen los 8 subagentes, 4 skills, 8 comandos y 4 hooks, todos en git (solo `settings.local.json` está ignorado).
- **Defecto encontrado y corregido en los hooks (2026-11-08):** `settings.json` los invocaba con ruta relativa (`node .claude/hooks/pre-edit.mjs`) y las reglas de denegación del entorno eran relativas al directorio actual (`./.env`); si el directorio de trabajo de Claude Code no era la raíz del repositorio, Node fallaba con código 1 (no bloqueante) y **una escritura de `.env` prosperó** (archivo de prueba, ya borrado). Ahora los cuatro hooks usan `node "$CLAUDE_PROJECT_DIR/.claude/hooks/<nombre>.mjs"` y se agregaron denegaciones `**/.env` para leer, editar y escribir. Verificado ejecutando cada comando desde una subcarpeta: `pre-edit` sale con 2 ante `.env` y con 0 ante un archivo normal. **Los cambios de hooks se aplican al reiniciar la sesión de Claude Code (o revisándolos en `/hooks`).** Para Windows se asume el intérprete de Git Bash, que expande `$CLAUDE_PROJECT_DIR`.
- **Protección de `.local/` (hallazgo del `/review` del 2026-11-09, aprobada por el responsable):** el hook de Bash bloquea leer o copiar `.local/secretos-*` y `.local/realm/` (realm resuelto, con contraseñas) con `cat`, `head`, `grep`, `sed`, `cp`… y por redirección; los registros (`*.log`) y el resto de `.local/` siguen legibles. `pre-edit` bloquea editar o escribir cualquier archivo de `.local/`, y `settings.json` deniega `Read` de esos secretos y `Edit`/`Write` de `.local/**`. 58 pruebas en `pnpm test:hooks`. Los scripts de pnpm leen y escriben esos archivos por su cuenta, sin pasar por estas reglas. Se aplica al reiniciar la sesión.
- **Endurecimiento de permisos y hooks (M1, 2026-11-09):** las reglas del hook de Bash viven ahora en `.claude/hooks/reglas-bash.mjs` (función pura) con 47 pruebas en `reglas-bash.test.mjs` (`pnpm test:hooks`, usa `node:test`). Cambios: bloquea la lectura/copia de `.env`, `.env.local`, `.env.*` (excepto `.env.example`) con `cat|head|tail|less|more|grep|sed|awk|bat|cp|mv|…` y por redirección; con `psql` bloquea `DELETE|UPDATE|ALTER|GRANT|REVOKE|CREATE ROLE` salvo contra `sigiso_test`; bloquea `git checkout .`, `git checkout -- .` y `git restore` (se permite `--staged`). En `settings.json`, `Bash(node:*)` pasó a `node scripts/*`, `node .claude/hooks/*` y `node --test .claude/hooks/*` (`node -e` vuelve a pedir aprobación) y se agregaron denegaciones para `git checkout .` y `git restore`. Los cambios de `settings.json` se aplican al reiniciar la sesión.
- Limitaciones: hooks no probados en Windows real; el escaneo de secretos del hook Stop es básico (gitleaks completo en 0.4); el hook de Bash evalúa el texto completo del comando, así que puede dar falsos positivos si el texto menciona un comando prohibido.

## Paso 0.4 — notas

- Pipeline: `.github/workflows/ci.yml` (lint, tipos, cobertura 80 % en dominio, build en macOS+Windows, validación de librerías) y `seguridad.yml` (gitleaks, Semgrep CE, OSV, Trivy, SBOM CycloneDX, licencias). Artefactos `evidencia-*` (90 días); ver `docs/security/evidencias/README.md`.
- **Protección de la rama principal activa:** PR obligatorio, 7 checks requeridos (`verificar` macOS/Windows, `integracion`, `gitleaks`, `semgrep`, `osv-scanner y licencias`, `trivy y SBOM CycloneDX`; eran 6 hasta el paso 0.6), historial lineal, sin force-push, también para administradores. Revisores requeridos: 0 (el responsable es el único revisor).
- **PR correcto (#1):** 6 de 6 checks en verde, incluido Windows. Integrado por el responsable.
- **PR que viola reglas (#2, cerrado sin integrar):** `gitleaks` detectó 2 secretos falsos y `osv-scanner y licencias` rechazó `mupdf@1.28.1` (AGPL-3.0-or-later). Estado de merge: BLOCKED. Además, GitHub push protection bloqueó por sí solo una clave con formato AWS.
- El primer run falló por dos defectos propios (tag inexistente de `trivy-action`, carpeta `libraries/normas` ausente en checkout limpio); corregidos en #1.
- OSV: 2 vulnerabilidades medias en `minimatch` transitivo (Nx/ESLint), ignoradas hasta 2026-12-04 en `osv-scanner.toml`.
- Pendientes: axe (llega con las pantallas, 0.5); anclar acciones por SHA antes de producción; Trivy no detectó los secretos falsos (solo gitleaks), aceptable porque gitleaks es el control principal; el merge a la rama principal lo hace el responsable (el clasificador de permisos me lo bloquea).
- Efecto de hacer público el repo: el correo del autor de los commits es visible.

## Paso 0.5 — notas

- Entregado: `packages/tokens`, `packages/ui` (base + 4 de dominio), `apps/storybook`, cinco pantallas plantilla en `/e/<empresa>/…` (empresas de prueba `a` verde y `b` azul), guía en `docs/design/guia-de-estilo.md`, ADR 023 (Aprobado).
- Contraste WCAG AA verificado por prueba automática (claro, oscuro y dos empresas): 24 pruebas en verde. `lint`, `typecheck`, `test` y `build` en verde.
- La pantalla de ingreso es solo plantilla: sin autenticación hasta 0.6.
- `/review` hecho (arquitectura, multiempresa, seguridad, accesibilidad). Corregido: validación del id de empresa, CSS de marca solo de la empresa actual, datos demo por empresa con pruebas de aislamiento, `logoUrl` validado, cabeceras básicas, `<button>` dentro de `<a>` (nuevo `BotonEnlace`), foco y resumen de errores en el formulario, migas subrayadas, `prefers-reduced-motion`, textos a i18n.
- Pendiente (registrado, no bloquea 0.5): CSP con nonce (necesita middleware; antes de producción); valores `rem` arbitrarios a tokens; regla de lint para la regla 7; `role="meter"` y contraste de la pista en barras; cabeceras `sr-only` en la matriz de riesgos; hex literales en pruebas; constante compartida para la clave `sig-tema`; autorización por empresa (OpenFGA) en 0.6.
- Aprobado por el responsable: pantallas, Storybook y ADR 023.
