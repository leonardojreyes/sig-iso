# Estado de la Fase 0 — sig-iso

**Léelo primero al iniciar cualquier sesión.**

- **Paso actual:** 0.6 Plataforma transversal y corte vertical — en curso (ingreso por empresa, aislamiento multiempresa, librería de ejemplo y bitácora inmutable).
- **Pasos cerrados:** 0.1, 0.2, 0.3, 0.4 (integrado en #1 y #3), 0.5 (integrado en #4).
- **Rama y PR (2026-11-09):** `main` incluye los PR #1, #3, #4, #5, #6, #7 y #8 (adopción desde la pantalla, 10.7); el #2 se cerró a propósito (PR de prueba que viola las reglas). La rama `feature/paso-0-6-ingreso` (10.8 y 11.1, M1 y seguimiento de la revisión) está rebasada sobre `main` y su PR está abierto. La protección de `main` exige los **7 checks**, incluido `integracion`. Regla de trabajo: nada se confirma ni se empuja directo en `main`; cada tarea o grupo de tareas va en una rama `feature/…`, con PR y los 7 checks en verde, y el merge lo haces tú.
- **Corte 0.6: 63 de 68 tareas hechas** (2 más quedan pospuestas por el ADR 029). Plan en `docs/specs/corte-vertical-0-6/` (`tasks.md` tiene el detalle y las notas de cada tarea).

## Corte 0.6 — qué está terminado

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

## Corte 0.6 — qué falta (6 tareas)

- **4.4 (tuya, no bloquea):** verificar numeraciones y guías con tus ejemplares y decidir sobre los títulos (`docs/specs/corte-vertical-0-6/verificacion-numeraciones.md`). Mientras tanto la librería de ejemplo `0.1.0` ya está **cargada en la base local** (4.5 hecha, `pnpm libraries:load`), marcada «borrador, numeraciones sin verificar»; al verificar se publica la versión siguiente.
- **11.1 (hecha); 11.2 y 11.3 DIFERIDAS a la Fase 1 (M5, aprobado 2026-11-09):** el worker de intentos fallidos no hace falta para ver el sistema. El código de 11.1 queda en el repositorio, probado; la bitácora ya acepta esos registros, pero nada los alimenta todavía, y la prueba 12.4 no cubre el paso «intento fallido → bitácora desde Keycloak».
- **12.3 (hecha) y 12.4 (prueba hecha con `pnpm web:verify-aislamiento`; falta el `/review` completo).** Ver «Brechas y avisos del cierre del corte 0.6».

## Pendiente del responsable

1. ~~Integrar el PR #8~~ (hecho 2026-11-09). Integrar el PR de `feature/paso-0-6-ingreso` cuando sus 7 checks estén en verde.
2. **Ramas viejas ya integradas** (se pueden borrar, en local y en GitHub): `feature/docs-fase0-skills`, `feature/paso-0-5-look-and-feel`, `feature/paso-0-6-librerias`, `feature/paso-0-6-plataforma`, `docs/estado-paso-0-4`, `fix/pipeline-bootstrap`. Dejar `feature/prueba-violacion-reglas` (PR #2 cerrado) mientras sirva de ejemplo.
3. **Numeraciones y títulos de la librería de ejemplo (4.4)** cuando tengas los ejemplares: `docs/specs/corte-vertical-0-6/verificacion-numeraciones.md`. Mientras tanto la `0.1.0` está cargada solo en tu base local, marcada «borrador, numeraciones sin verificar».
4. **Asesor legal para el ADR 028** (aprobado como provisional el 2026-11-08): validar bases de tratamiento, retención, derechos de las personas y el rol de SynapTech (`docs/adr/028-privacidad-y-bitacora.md`, «No resuelto» e «Insumos para el asesor legal»). **Bloquea el uso con datos de personas reales**, incluido el personal de SynapTech, y en todo caso al primer cliente externo.
5. **Revisión externa de calidad** (`docs/revisiones/2026-11-08-revision-calidad-fase0.md`, hoy sin seguimiento en git): decidir si se confirma en el repositorio. Seguimiento de sus hallazgos:
   - **A1** (el repositorio es público): decisión tuya, pendiente; requiere un ADR.
   - **M1** (permisos y hooks de Claude Code): **corregido 2026-11-09**, ver «Paso 0.3 — notas».
   - **B5** (este archivo desactualizado): corregido (PR y próximos pasos al día).
   - **M5** (alcance del 0.6): plan propuesto, a la espera de tu aprobación.
   - **A2, M3 y M4:** registrados abajo como prerrequisitos de la Fase 1.
   - **M2** (amarrar `adoptada_por` a la misma empresa) conviene al pasar por la migración de adopción; **B1–B4** al pasar por esos archivos.
6. Corregir o quitar el `GITHUB_TOKEN` inválido de `~/.zshrc` (mientras tanto, `env -u GITHUB_TOKEN` en `git` y `gh`).
7. Para más adelante: integrar OpenFGA cuando haya permisos por objeto (ADR 029); decidir si `acceso.cruzado` se registra también para el catálogo global.

Base local lista: `pnpm db:init`, `pnpm db:migrate` y `pnpm db:seed` dejaron los roles y las bases `sigiso`, `sigiso_test` y `openfga` con el esquema migrado y las dos empresas de prueba; `pnpm libraries:load` cargó la librería de ejemplo; las claves están en `.env.local` y `.local/` (ignorados). La empresa A no tiene librerías adoptadas (para que pruebes la adopción en pantalla).

## Próximos pasos técnicos

1. ~~11.2 y 11.3~~ diferidas a la Fase 1 (ver arriba).
2. ~~12.3~~ hecha (`docs/fase0/guia-de-ejecucion.md`; la pila completa usa 1.430 MB reales de 4 GB, medidos con `ram:report`, que ahora usa la huella real en macOS); **12.4** prueba de aislamiento de extremo a extremo y `/review` completo. Con eso se cierra el corte 0.6.
3. Después: 0.7 (IA local, modelo pequeño con su tamaño informado antes de descargar), 0.8 (Helm y OpenTofu validados, sin clúster) y 0.9. Antes de la Fase 1, el `/spec` del modelo de dominio v2 (punto 5 de los pendientes).

- **Actualizado:** 2026-11-09

## Prerrequisitos de la Fase 1 (de la revisión de calidad del 2026-11-08)

**No se empieza la Fase 1 sin resolver estos tres puntos.** Se abordan juntos con un `/spec` de «modelo de dominio v2 y esquema de librerías v3», validado con `experto-iso`, más los ADR correspondientes.

- **A2 · Esquema de librerías limitado a la Estructura Armonizada.** `libreria_entrada` (migración 0002) exige `capitulo between 4 and 10` y `nivel in (1, 2)`, y `packages/normas-schema/libreria-norma.schema.json` tiene la misma restricción. No admite los controles del Anexo A de 27001 ni de 42001 (base de la Declaración de Aplicabilidad) y contradice P14. Corrección: tipo de entrada `clausula | control | objetivo`, sección/tema libre, jerarquía de profundidad variable con `padre_id`, atributos propios por norma; migración nueva + ADR + una librería de prueba con controles de Anexo A.
- **M3 · Un solo rol por persona.** Pasar a roles múltiples (`usuario_rol` con vigencia opcional) y modelar la relación persona–proceso para validar la independencia del auditor (no audita su propio trabajo) y el acceso limitado en el tiempo del auditor externo. Hoy `usuario.rol` y la matriz en código (ADR 029, tarea 9.4) asumen un solo rol.
- **M4 · Entidades que faltan en el modelo de dominio** (`docs/producto/modelo-dominio.md`): Certificado (número, organismo, alcance, emisión, vencimiento, estado); Alcance por norma con sedes y exclusiones justificadas; Activo de información; Evaluación de impacto de sistemas de IA (42001); orígenes de No conformidad (queja, incidente, revisión por la dirección); clasificación de hallazgos de auditoría externa (NC mayor, NC menor, observación, oportunidad de mejora) y plazos de cierre.

## Brechas y avisos del cierre del corte 0.6

- **H6.10 · el 404 cruzado no se registra como `acceso.cruzado`.** El evento existe y el filtro de la API lo maneja, pero ningún código de producción lo emite y el proxy de la web responde 404 sin escribir en la bitácora. La indistinguibilidad del 404 sí está verificada. Resolverlo en la Fase 1 (detectar «otra empresa» comparando el slug de la URL con la empresa del token).
- **`pnpm web:verify-listado` adopta la librería para la empresa A** si no estaba adoptada (lo advierte su cabecera). Se ejecutó el 2026-11-09 durante la medición de memoria: **A ya tiene adoptada la librería de ejemplo**, así que el aviso de «la empresa A no tiene librerías adoptadas» de más arriba ya no es cierto. La adopción en pantalla se prueba ahora con `admin-b`. `web:verify-aislamiento` no adopta nada.

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
- Elegir librería de PDF/DOCX (ADR 021) cuando se construya el primer reporte.
- Revisión de `experto-iso`: los subagentes existen desde 0.3 (`.claude/agents/`); el responsable valida las numeraciones de las normas con sus ejemplares (4.4).
- Nota: `CLAUDE.md` global prefiere npm; el monorepo usa pnpm (ADR 003).

## Próximos pasos de la Fase 0

0.1 a 0.5 cerrados → **0.6 (en curso)** → 0.7 → 0.8 → 0.9

## Paso 0.3 — notas

- Creados: `CLAUDE.md` raíz (56 líneas) y por carpeta (`apps/`, `modules/`, `docs/`, `libraries/`), `.claude/settings.json`, hooks Node en `.claude/hooks/`, 8 subagentes y 8 comandos.
- Los subagentes y comandos nuevos se cargan al **reiniciar la sesión de Claude Code**; la demostración se revisó manualmente con sus listas de control.
- Hooks probados: bloquean `.env*` (también rutas Windows), borrado recursivo forzado, `push` a `main`; permiten `.env.example`, `pnpm test`, push a `feature/*`.
- **Skills creados (2026-11-08):** `.claude/skills/{modulo-hexagonal,migracion-rls,libreria-normas,endpoint-contrato}/SKILL.md`, cada uno con cuándo usarlo, pasos, ejemplo y criterio de terminado, basados en la estructura real del repositorio (`modules/empresas` y `modules/normas`, `platform/db/migrations`, `packages/normas-schema`, `packages/contracts`, `apps/api`) y en los ADR 001, 010, 024, 025, 026, 027 y 029. Con esto existen los 8 subagentes, 4 skills, 8 comandos y 4 hooks, todos en git (solo `settings.local.json` está ignorado).
- **Defecto encontrado y corregido en los hooks (2026-11-08):** `settings.json` los invocaba con ruta relativa (`node .claude/hooks/pre-edit.mjs`) y las reglas de denegación del entorno eran relativas al directorio actual (`./.env`); si el directorio de trabajo de Claude Code no era la raíz del repositorio, Node fallaba con código 1 (no bloqueante) y **una escritura de `.env` prosperó** (archivo de prueba, ya borrado). Ahora los cuatro hooks usan `node "$CLAUDE_PROJECT_DIR/.claude/hooks/<nombre>.mjs"` y se agregaron denegaciones `**/.env` para leer, editar y escribir. Verificado ejecutando cada comando desde una subcarpeta: `pre-edit` sale con 2 ante `.env` y con 0 ante un archivo normal. **Los cambios de hooks se aplican al reiniciar la sesión de Claude Code (o revisándolos en `/hooks`).** Para Windows se asume el intérprete de Git Bash, que expande `$CLAUDE_PROJECT_DIR`.
- **Endurecimiento de permisos y hooks (M1, 2026-11-09):** las reglas del hook de Bash viven ahora en `.claude/hooks/reglas-bash.mjs` (función pura) con 47 pruebas en `reglas-bash.test.mjs` (`pnpm test:hooks`, usa `node:test`). Cambios: bloquea la lectura/copia de `.env`, `.env.local`, `.env.*` (excepto `.env.example`) con `cat|head|tail|less|more|grep|sed|awk|bat|cp|mv|…` y por redirección; con `psql` bloquea `DELETE|UPDATE|ALTER|GRANT|REVOKE|CREATE ROLE` salvo contra `sigiso_test`; bloquea `git checkout .`, `git checkout -- .` y `git restore` (se permite `--staged`). En `settings.json`, `Bash(node:*)` pasó a `node scripts/*`, `node .claude/hooks/*` y `node --test .claude/hooks/*` (`node -e` vuelve a pedir aprobación) y se agregaron denegaciones para `git checkout .` y `git restore`. Los cambios de `settings.json` se aplican al reiniciar la sesión.
- Limitaciones: hooks no probados en Windows real; el escaneo de secretos del hook Stop es básico (gitleaks completo en 0.4); el hook de Bash evalúa el texto completo del comando, así que puede dar falsos positivos si el texto menciona un comando prohibido.

## Paso 0.4 — notas

- Pipeline: `.github/workflows/ci.yml` (lint, tipos, cobertura 80 % en dominio, build en macOS+Windows, validación de librerías) y `seguridad.yml` (gitleaks, Semgrep CE, OSV, Trivy, SBOM CycloneDX, licencias). Artefactos `evidencia-*` (90 días); ver `docs/security/evidencias/README.md`.
- **Protección de la rama principal activa:** PR obligatorio, 6 checks requeridos (`verificar` macOS/Windows, `gitleaks`, `semgrep`, `osv-scanner y licencias`, `trivy y SBOM CycloneDX`), historial lineal, sin force-push, también para administradores. Revisores requeridos: 0 (el responsable es el único revisor).
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
