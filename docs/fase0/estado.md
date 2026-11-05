# Estado de la Fase 0 — sig-iso

**Léelo primero al iniciar cualquier sesión.**

- **Paso actual:** 0.6 Plataforma transversal y corte vertical — en curso.
- **Pasos cerrados:** 0.1, 0.2, 0.3, 0.4 (integrado en #1 y #3), 0.5 (integrado en #4).
- **Siguiente paso:** fase 3 del corte vertical 0.6 (bitácora inmutable, tarea 3.5: adaptador de la bitácora y servicio de verificación (3.6 `RegistrarIntentoFallido` puede ir en paralelo); dominio y puerto de `platform/auditoria` hechos; migraciones 0003 y 0004 (bitácora con encadenado por huellas y anclas) hechas; ADR 028 de privacidad redactado y propuesto, pendiente de tu aprobación y de un asesor legal). Spec, plan y tareas en `docs/specs/corte-vertical-0-6/` (17 de 68 hechas). Rama `feature/paso-0-6-plataforma`, PR #5 abierto con los 7 checks en verde.
- **Pendiente del responsable:** integrar el PR #5 y agregar `integracion` como check obligatorio (`docs/security/ci-integracion.md`). Base local lista: `pnpm db:init` y `pnpm db:migrate` dejaron los roles `sigiso_*` y las bases `sigiso`, `sigiso_test` y `openfga` con el esquema migrado; las claves están en `.env.local` (ignorado).
- **Actualizado:** 2026-11-05

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
