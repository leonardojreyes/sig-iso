# ADR 005 — Móvil: diferido; v1 web responsiva/PWA

- **Estado:** Aprobado (2026-11-04)
- **Fecha:** 2026-11-04
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

Caso probable: auditor en sitio con evidencias fotográficas sin conexión. Aún sin validar.

## Decisión

No construir app nativa en la v1. Si se aprueba después: React Native + Expo, con OWASP MASVS.

## Alternativas consideradas

Flutter.

## Estándar y licencia

- Estándar: OWASP MASVS
- Licencia: MIT

## Consecuencias

Se evalúa la PWA con almacenamiento sin conexión antes de decidir app nativa. Decisión a revisar tras la v1.

## Criterio de tecnología mayoritaria (P12)

Se prioriza tecnología con soporte largo y talento disponible; las excepciones se justifican arriba.
