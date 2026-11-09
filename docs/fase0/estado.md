# Estado de la Fase 0 — sig-iso

**Léelo primero al iniciar cualquier sesión.**

- **Paso actual:** 0.6 Plataforma transversal y corte vertical — en curso (ingreso por empresa, aislamiento multiempresa, librería de ejemplo y bitácora inmutable).
- **Pasos cerrados:** 0.1, 0.2, 0.3, 0.4 (integrado en #1 y #3), 0.5 (integrado en #4).
- **Rama y PR:** `feature/paso-0-6-plataforma`, PR #5 abierto (los controles del CI de cada envío se revisan en la rama).
- **Corte 0.6: 60 de 68 tareas hechas** (2 más quedan pospuestas por el ADR 029). Plan en `docs/specs/corte-vertical-0-6/` (`tasks.md` tiene el detalle y las notas de cada tarea).

## Corte 0.6 — qué está terminado

- **Catálogo:** `pnpm libraries:load` (4.5) carga las librerías con el rol del catálogo, de forma idempotente, todo o nada, con la huella de cada versión y un hecho de plataforma por carga.
- **Base de datos y aislamiento:** PostgreSQL 16 con RLS, roles `sigiso_*`, migraciones 0001–0005, prueba de aislamiento entre empresas (fases 1 y 2).
- **Bitácora inmutable** encadenada por huellas, con intentos fallidos y mantenimiento (fase 3). ADR 028 de privacidad **aprobado como provisional** (2026-11-08), pendiente del asesor legal.
- **Librerías de normas:** esquema v2, validador con control de texto en el CI, borrador `0.1.0` de la librería de ejemplo (4.1 a 4.3 y 4.6).
- **Dominio y casos de uso** de empresas y normas: marca, catálogo, adopción, listado y consulta con 404 indistinguible (fase 5).
- **API completa** (fase 6): contrato OpenAPI, verificación de tokens, guardia, filtro de 403/404 cruzado, controladores, límite de frecuencia, conformidad del contrato.
- **Autorización por rol desde la base** (ADR 029, tarea 9.4): `usuario.rol` y matriz en código. OpenFGA 1.22.1 instalado pero **pospuesto**.
- **Keycloak 26.8.2 local** (fase 8): realm sin secretos, arranque en 127.0.0.1, ingreso real verificado, mensaje genérico de credenciales inválidas, clientes integrados deshabilitados.
- **Listado de requisitos real** (10.6): las entradas de las librerías adoptadas con filtros, rótulo de ejemplo y estados vacíos por rol; la cabecera muestra a la persona real.
- **Web, hasta la 10.5:** ingreso OIDC con PKCE, sesión (cookie sellada, renovación, cierre), proxy que protege `/e/<empresa>/…` (404 idéntico a otra empresa, sin caché) y **marca real de la empresa**. Verificado de extremo a extremo con `pnpm web:verify-login` (36 comprobaciones).
- **Siembra** de dos empresas y cuatro cuentas de prueba, `pnpm ram:report`, trazas mínimas y un flag de OpenFeature.

## Corte 0.6 — qué falta (8 tareas)

- **4.4 (tuya, no bloquea):** verificar numeraciones y guías con tus ejemplares y decidir sobre los títulos (`docs/specs/corte-vertical-0-6/verificacion-numeraciones.md`). Mientras tanto la librería de ejemplo `0.1.0` ya está **cargada en la base local** (4.5 hecha, `pnpm libraries:load`), marcada «borrador, numeraciones sin verificar»; al verificar se publica la versión siguiente.
- **10.7 y 10.8 (web):** botón de adoptar solo para el administrador SIG (verificando `Origin`); pantalla de ingreso real (hoy es una maqueta y la portada `/` sigue siendo la de demostración).
- **11.1 a 11.3 (worker):** registro de los intentos fallidos de ingreso leyendo los eventos de Keycloak. No hace falta para ver el sistema.
- **12.3 y 12.4:** guía de ejecución con la medición final de memoria, y la prueba de aislamiento de extremo a extremo con revisión completa (`/review`).

## Pendiente del responsable

- Verificar numeraciones y títulos de la librería de ejemplo (4.4) (`docs/specs/corte-vertical-0-6/verificacion-numeraciones.md`). El ADR 026 quedó **aprobado** el 2026-11-08.
- **Asesor legal para el ADR 028** (aprobado como provisional el 2026-11-08): validar bases de tratamiento, retención, derechos de las personas y el rol de SynapTech (`docs/adr/028-privacidad-y-bitacora.md`, «No resuelto» e «Insumos para el asesor legal»). **Bloquea el uso con datos de personas reales**, incluido el personal de SynapTech, y en todo caso al primer cliente externo.
- Integrar el PR #5 y agregar `integracion` como check obligatorio (`docs/security/ci-integracion.md`).
- Corregir o quitar el `GITHUB_TOKEN` inválido de `~/.zshrc` (usar `env -u GITHUB_TOKEN` mientras tanto).
- Cerrar el proceso `node` viejo que ocupa el puerto 3001 (una API de una sesión anterior).
- Para más adelante: integrar OpenFGA cuando haya permisos por objeto (ADR 029); decidir si `acceso.cruzado` se registra también para el catálogo global.
- Base local lista: `pnpm db:init` y `pnpm db:migrate` dejaron los roles y las bases `sigiso`, `sigiso_test` y `openfga`; las claves están en `.env.local` (ignorado).
- **Actualizado:** 2026-11-08

## Respuestas de arranque (`/fase0-inicio`)

| # | Pregunta | Respuesta |
| --- | --- | --- |
| 1 | Nombre de código | `sig-iso` (se mantiene) |
| 2 | Destino del primer despliegue | Solo local por ahora (0.8 deja Helm/OpenTofu validados, sin clúster) |
| 3 | Revisores humanos de PR | Solo el responsable |
| 4 | Repositorio GitHub | Autorizada su creación (se hará en 0.2; visibilidad privada por defecto) |
| 5 | Ollama | Modelo pequeño (~3B), local; tamaño a informar antes de descargar (0.7) |

## Decisiones

ADR 001–022 redactados en `docs/adr/` (estado: Aprobado). Índice: `docs/adr/README.md`.

## Pendientes

- ORM/migraciones (ADR 006): se decide en 0.6, cuando se use la BD por primera vez (el esqueleto 0.2 no la usa).
- Sin Docker (ADR 022): PostgreSQL 16 nativo (Homebrew, corriendo). Falta crear rol/base `sigiso` (script en 0.6) e instalar Valkey (`brew install valkey`) cuando se construya la cola.
- Repo remoto **público** (decisión del responsable, para habilitar protección de ramas sin plan de pago): https://github.com/leonardojreyes/sig-iso . `GITHUB_TOKEN` del entorno es inválido: usar `env -u GITHUB_TOKEN gh ...` y `env -u GITHUB_TOKEN git push ...`.
- TypeScript fijado en 5.9 (la v7 nativa rompe typescript-eslint).
- Elegir librería de PDF/DOCX (ADR 021) cuando se construya el primer reporte.
- Look and feel completo se pregunta en 0.5.
- Revisión de `experto-iso`: los subagentes se crean en 0.3; hasta entonces el responsable valida el glosario y el modelo de dominio.
- Nota: `CLAUDE.md` global prefiere npm; el monorepo usa pnpm (ADR 003).

## Próximos pasos

0.4 → 0.5 → 0.6 → 0.7 → 0.8 → 0.9

## Paso 0.3 — notas

- Creados: `CLAUDE.md` raíz (56 líneas) y por carpeta (`apps/`, `modules/`, `docs/`, `libraries/`), `.claude/settings.json`, hooks Node en `.claude/hooks/`, 8 subagentes y 8 comandos.
- Los subagentes y comandos nuevos se cargan al **reiniciar la sesión de Claude Code**; la demostración se revisó manualmente con sus listas de control.
- Hooks probados: bloquean `.env*` (también rutas Windows), borrado recursivo forzado, `push` a `main`; permiten `.env.example`, `pnpm test`, push a `feature/*`.
- **Skills creados (2026-11-08):** `.claude/skills/{modulo-hexagonal,migracion-rls,libreria-normas,endpoint-contrato}/SKILL.md`, cada uno con cuándo usarlo, pasos, ejemplo y criterio de terminado, basados en la estructura real del repositorio (`modules/empresas` y `modules/normas`, `platform/db/migrations`, `packages/normas-schema`, `packages/contracts`, `apps/api`) y en los ADR 001, 010, 024, 025, 026, 027 y 029. Con esto existen los 8 subagentes, 4 skills, 8 comandos y 4 hooks, todos en git (solo `settings.local.json` está ignorado).
- **Defecto encontrado y corregido en los hooks (2026-11-08):** `settings.json` los invocaba con ruta relativa (`node .claude/hooks/pre-edit.mjs`) y las reglas de denegación del entorno eran relativas al directorio actual (`./.env`); si el directorio de trabajo de Claude Code no era la raíz del repositorio, Node fallaba con código 1 (no bloqueante) y **una escritura de `.env` prosperó** (archivo de prueba, ya borrado). Ahora los cuatro hooks usan `node "$CLAUDE_PROJECT_DIR/.claude/hooks/<nombre>.mjs"` y se agregaron denegaciones `**/.env` para leer, editar y escribir. Verificado ejecutando cada comando desde una subcarpeta: `pre-edit` sale con 2 ante `.env` y con 0 ante un archivo normal. **Los cambios de hooks se aplican al reiniciar la sesión de Claude Code (o revisándolos en `/hooks`).** Para Windows se asume el intérprete de Git Bash, que expande `$CLAUDE_PROJECT_DIR`.
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
