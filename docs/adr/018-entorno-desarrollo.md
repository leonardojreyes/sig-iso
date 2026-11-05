# ADR 018 — Entorno de desarrollo: nativo + servicios en Docker; Dev Container opcional

- **Estado:** Aprobado (2026-11-04)
- **Fecha:** 2026-11-04
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

Mac M1 con 8 GB de RAM; el equipo también usa Windows.

## Decisión

Node LTS + pnpm nativos; PostgreSQL, Valkey y demás servicios en Docker. Dev Container disponible para quien lo prefiera. Scripts en Node (no bash), `.gitattributes` con finales de línea normalizados, hooks probados en ambos sistemas.

## Alternativas consideradas

Solo Dev Containers (pesado en 8 GB).

## Estándar y licencia

- Estándar: Dev Container spec
- Licencia: —

## Consecuencias

Arranque ligero y progreso visible pronto.

## Criterio de tecnología mayoritaria (P12)

Se prioriza tecnología con soporte largo y talento disponible; las excepciones se justifican arriba.
