# ADR 001 — Estilo: monolito modular + hexagonal (DDD)

- **Estado:** Aprobado (2026-11-04)
- **Fecha:** 2026-11-04
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

Equipo pequeño, producto con dominio complejo (ciclo de certificación ISO) y despliegue on-premise. Se requiere velocidad de cambio y límites claros sin costo operativo de microservicios.

## Decisión

Monolito modular con arquitectura hexagonal. Cada módulo en `modules/<modulo>/` con capas domain, application, infrastructure, interface. Límites forzados con `@nx/enforce-module-boundaries`.

## Alternativas consideradas

Microservicios (descartado: costo operativo y de consistencia sin necesidad actual).

## Estándar y licencia

- Estándar: —
- Licencia: —

## Consecuencias

El dominio no depende de frameworks, BD ni proveedores de IA. Un módulo puede extraerse a servicio más adelante si hay razón medible.

## Criterio de tecnología mayoritaria (P12)

Se prioriza tecnología con soporte largo y talento disponible; las excepciones se justifican arriba.
