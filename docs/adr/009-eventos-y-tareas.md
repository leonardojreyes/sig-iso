# ADR 009 — Eventos y tareas: outbox en PostgreSQL + cola sobre Valkey

- **Estado:** Aprobado (2026-11-04)
- **Fecha:** 2026-11-04
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

Alertas de vencimiento de evidencias, recordatorios de auditorías y de seguimientos.

## Decisión

Patrón outbox en PostgreSQL para eventos de dominio; cola de tareas sobre Valkey; eventos con formato CloudEvents.

## Alternativas consideradas

NATS, Kafka (demasiado pesados para 8 GB).

## Estándar y licencia

- Estándar: AsyncAPI, CloudEvents
- Licencia: BSD / Apache 2.0

## Consecuencias

Empresa viaja en el contexto de cada evento y tarea.

## Criterio de tecnología mayoritaria (P12)

Se prioriza tecnología con soporte largo y talento disponible; las excepciones se justifican arriba.
