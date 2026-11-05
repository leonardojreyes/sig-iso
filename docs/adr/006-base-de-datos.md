# ADR 006 — Base de datos: PostgreSQL con Row-Level Security

- **Estado:** Aprobado (2026-11-04)
- **Fecha:** 2026-11-04
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

Multiempresa desde el día uno; el aislamiento debe garantizarlo la base de datos, no solo el código.

## Decisión

PostgreSQL con RLS por empresa (`SET LOCAL app.tenant_id` por transacción; sin empresa la consulta falla). Tabla de bitácora solo-inserción. ORM/migraciones: **Kysely con migraciones SQL** (ver [ADR 024](024-acceso-a-datos-kysely-y-roles.md)). El `SET LOCAL` se implementa como `set_config('app.tenant_id', …, true)`, de alcance de transacción.

## Alternativas consideradas

Prisma y Drizzle (descartados en el [ADR 024](024-acceso-a-datos-kysely-y-roles.md)).

## Estándar y licencia

- Estándar: SQL
- Licencia: PostgreSQL License

## Consecuencias

Modelo híbrido: compartida (por defecto), base dedicada y despliegue dedicado, con el mismo código. Toda funcionalidad trae prueba de aislamiento.

## Criterio de tecnología mayoritaria (P12)

Se prioriza tecnología con soporte largo y talento disponible; las excepciones se justifican arriba.
