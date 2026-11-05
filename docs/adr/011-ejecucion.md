# ADR 011 — Ejecución: Docker Compose en desarrollo; Kubernetes + Helm en servidores

- **Estado:** Aprobado (2026-11-04)
- **Fecha:** 2026-11-04
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

Despliegue on-premise o nube privada, portable. Aún no existe el servidor destino.

## Decisión

Docker Compose en desarrollo; Kubernetes conforme a CNCF con Helm en servidores. En Fase 0 basta Compose + chart Helm validado.

## Alternativas consideradas

Ninguna.

## Estándar y licencia

- Estándar: OCI
- Licencia: Apache 2.0

## Consecuencias

Servicios pesados en perfiles de Compose (`obs`, `ai`, `design`). Presupuesto diario: ~4 GB de RAM en contenedores.

## Criterio de tecnología mayoritaria (P12)

Se prioriza tecnología con soporte largo y talento disponible; las excepciones se justifican arriba.
