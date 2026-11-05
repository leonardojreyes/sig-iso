# ADR 016 — Secretos: OpenBao; en desarrollo `.env` fuera de git

- **Estado:** Aprobado (2026-11-04)
- **Fecha:** 2026-11-04
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

Ningún secreto en el código; licencia abierta.

## Decisión

OpenBao en servidores. En desarrollo: `.env` ignorado por git y `.env.example` como plantilla. Hook que bloquea la edición de `.env*`.

## Alternativas consideradas

HashiCorp Vault (BSL, descartado).

## Estándar y licencia

- Estándar: —
- Licencia: MPL 2.0

## Consecuencias

gitleaks en cada PR.

## Criterio de tecnología mayoritaria (P12)

Se prioriza tecnología con soporte largo y talento disponible; las excepciones se justifican arriba.
