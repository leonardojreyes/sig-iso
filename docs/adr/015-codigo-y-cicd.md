# ADR 015 — Código y CI/CD: GitHub + GitHub Actions

- **Estado:** Aprobado (2026-11-04)
- **Fecha:** 2026-11-04
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

Plataforma ya usada por el equipo; el pipeline produce evidencias para ISO 27001 y 42001.

## Decisión

GitHub con protección de `main` y GitHub Actions con matriz macOS y Windows. Análisis con herramientas abiertas (no CodeQL). Repositorio a crear con autorización del responsable (privado, ver estado.md). Revisor humano de PR: solo el responsable.

## Alternativas consideradas

Ninguna.

## Estándar y licencia

- Estándar: —
- Licencia: Servicio

## Consecuencias

Las salidas del pipeline se archivan con fecha en `docs/security/evidencias/` (P13).

## Criterio de tecnología mayoritaria (P12)

Se prioriza tecnología con soporte largo y talento disponible; las excepciones se justifican arriba.
