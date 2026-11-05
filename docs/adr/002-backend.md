# ADR 002 — Backend: TypeScript + NestJS sobre Node.js LTS

- **Estado:** Aprobado (2026-11-04)
- **Fecha:** 2026-11-04
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

Stack común con Orbyta; talento disponible y un solo lenguaje en backend y frontend.

## Decisión

TypeScript + NestJS sobre Node.js LTS (v22). Contrato OpenAPI 3.1 generado y publicado en `/docs`.

## Alternativas consideradas

Ninguna: decisión previa del responsable.

## Estándar y licencia

- Estándar: OpenAPI 3.1
- Licencia: MIT

## Consecuencias

NestJS se usa solo en la capa de interfaz e infraestructura; el dominio queda libre de decoradores del framework.

## Criterio de tecnología mayoritaria (P12)

Se prioriza tecnología con soporte largo y talento disponible; las excepciones se justifican arriba.
