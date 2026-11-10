# ADR 022 — Desarrollo local sin Docker: PostgreSQL nativo

- **Estado:** Aprobado (2026-11-04)
- **Fecha:** 2026-11-04
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

La Mac de desarrollo (8 GB de RAM) ya tiene PostgreSQL 16 instalado con Homebrew y el responsable decidió **no instalar Docker**. Esto modifica los ADR 011 y 018 solo para el entorno local de esta máquina.

## Decisión

- En esta máquina, PostgreSQL corre nativo (16.x, Homebrew). El proyecto usa bases y roles propios (cinco roles `sigiso_*` y las bases `sigiso`, `sigiso_test` y `openfga`, ver [ADR 024](024-acceso-a-datos-kysely-y-roles.md)), creados con un script Node (`scripts/db-init.mjs`, ya disponible como `pnpm db:init`); la aplicación nunca usa el superusuario.
- `infra/compose/docker-compose.yml` se conserva para quienes sí usen Docker (Windows, CI, otros equipos) y para el paso 0.8.
- Valkey (ADR 009) se instalará con `brew install valkey` cuando se construya la cola de tareas.
- Servicios pesados previstos como perfiles de Compose (Keycloak, observabilidad, Ollama/LiteLLM, SeaweedFS) deberán evaluarse uno a uno en su paso: nativos con Homebrew o ejecutados en otro equipo. Se registrará un ADR por cada excepción.
- El CI y el despliegue siguen usando contenedores; el código no debe depender de cómo corre PostgreSQL (solo de las `DATABASE_URL_*`; `DATABASE_URL` queda para Docker Compose).

## Consecuencias

- Paridad de versión: PostgreSQL 16 local vs 17 en Compose. Se fija 16 como versión mínima soportada y el Compose se baja a `postgres:16-alpine`.
- `pnpm infra:up` (paso 0.8) deberá soportar el modo sin Docker o documentarlo como "no disponible en esta máquina". **Nota (ADR 031, 2026-11-09):** el paso 0.8 se difiere hasta tener servidor; `infra:up/down` queda sin uso y se resuelve al retomarlo.
- Las reglas de permisos de `.claude/settings.json` no incluyen `docker compose` como obligatorias.
