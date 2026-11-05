# ADR 008 — Autorización: RBAC + atributos con OpenFGA

- **Estado:** Aprobado (2026-11-04)
- **Fecha:** 2026-11-04
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

Roles del dominio con permisos por objeto (proyecto, auditoría) y acceso temporal del auditor externo.

## Decisión

OpenFGA. Roles: administrador SIG, dueño de proceso, auditor interno, auditor externo temporal, colaborador, alta dirección.

## Alternativas consideradas

Cerbos.

## Estándar y licencia

- Estándar: Zanzibar
- Licencia: Apache 2.0

## Consecuencias

El auditor externo recibe acceso de solo lectura limitado en el tiempo. Consultor multiempresa con cambio explícito de empresa.

## Criterio de tecnología mayoritaria (P12)

Se prioriza tecnología con soporte largo y talento disponible; las excepciones se justifican arriba.
