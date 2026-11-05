# ADR 006 — Base de datos: PostgreSQL con Row-Level Security

- **Estado:** Aprobado (2026-11-04)
- **Fecha:** 2026-11-04
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

Multiempresa desde el día uno; el aislamiento debe garantizarlo la base de datos, no solo el código.

## Decisión

PostgreSQL con RLS por empresa (`SET LOCAL app.tenant_id` por transacción; sin empresa la consulta falla). Tabla de bitácora solo-inserción. ORM/migraciones: se decide entre Prisma, Drizzle y Kysely al iniciar el paso 0.2, con criterio de soporte de RLS y consumo de memoria.

## Alternativas consideradas

Prisma, Drizzle o Kysely (pendiente de elección dentro de este ADR).

## Estándar y licencia

- Estándar: SQL
- Licencia: PostgreSQL License

## Consecuencias

Modelo híbrido: compartida (por defecto), base dedicada y despliegue dedicado, con el mismo código. Toda funcionalidad trae prueba de aislamiento.

## Criterio de tecnología mayoritaria (P12)

Se prioriza tecnología con soporte largo y talento disponible; las excepciones se justifican arriba.
