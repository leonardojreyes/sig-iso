# Estado de la Fase 0 — sig-iso

**Léelo primero al iniciar cualquier sesión.**

- **Paso actual:** 0.4 Pipeline y calidad — **en curso**: workflows y escáneres listos y verificados en local; falta el push inicial a `main` (lo hace el responsable), protección de rama y los 2 PR de prueba.
- **Pasos cerrados:** 0.1, 0.2, 0.3 (aprobados 2026-11-04).
- **Siguiente paso:** 0.5 Look and feel.
- **Actualizado:** 2026-11-04

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
- Repo remoto privado: https://github.com/leonardojreyes/sig-iso . `GITHUB_TOKEN` del entorno es inválido: usar `env -u GITHUB_TOKEN gh ...` (la sesión del llavero sí sirve). Commit `d0c40a9` local, sin push aún.
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

- Pipeline: `.github/workflows/ci.yml` (lint, tipos, cobertura, build en macOS+Windows, validación de librerías) y `seguridad.yml` (gitleaks, Semgrep CE, OSV, Trivy, SBOM CycloneDX, licencias). Artefactos `evidencia-*` (90 días); ver `docs/security/evidencias/README.md`.
- Verificado en local: licencias (381 paquetes, 0 prohibidas), validador de librerías (rechaza YAML inválido), gitleaks (sin hallazgos en lo versionado), OSV (2 medias en `minimatch` transitivo de Nx/ESLint, ignoradas hasta 2026-12-04 en `osv-scanner.toml`).
- **No ejecutado aún:** workflows en GitHub (las acciones no están ancladas por SHA; hacerlo antes de producción), axe (sin pantallas hasta 0.5).
