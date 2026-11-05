# ADR 010 — Observabilidad: OpenTelemetry + Prometheus, Grafana, Loki, Tempo

- **Estado:** Aprobado (2026-11-04)
- **Fecha:** 2026-11-04
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

Todo observable desde el inicio y etiquetado por empresa, sin agotar RAM en desarrollo.

## Decisión

OpenTelemetry en la plantilla de módulo. Pila de Grafana en el perfil de Compose `obs`, apagado por defecto.

## Alternativas consideradas

Plataforma de observabilidad del cliente.

## Estándar y licencia

- Estándar: OpenTelemetry
- Licencia: Apache 2.0 / AGPL

## Consecuencias

Grafana/Loki/Tempo son AGPL: se usan sin modificar y como servicio aparte (regla de licencias 5.9).

## Criterio de tecnología mayoritaria (P12)

Se prioriza tecnología con soporte largo y talento disponible; las excepciones se justifican arriba.
