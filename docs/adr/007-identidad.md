# ADR 007 — Identidad: Keycloak autogestionado

- **Estado:** Aprobado (2026-11-04)
- **Fecha:** 2026-11-04
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

Se necesita SSO empresarial y federación por cliente, on-premise.

## Decisión

Keycloak autogestionado con OIDC, OAuth2, SAML y SCIM. La empresa se resuelve desde el token, subdominio o encabezado, en un solo lugar.

> **Matiz (ADR 027, aprobado):** en el corte 0.6 la empresa se resuelve **solo desde el token verificado**; el subdominio y el encabezado no se usan para decidir la empresa.

## Alternativas consideradas

Ninguna: decisión previa.

## Estándar y licencia

- Estándar: OIDC, OAuth2, SAML, SCIM
- Licencia: Apache 2.0

## Consecuencias

Consume memoria apreciable: en desarrollo se enciende desde el paso 0.6 y se mide dentro del presupuesto de ~4 GB.

## Criterio de tecnología mayoritaria (P12)

Se prioriza tecnología con soporte largo y talento disponible; las excepciones se justifican arriba.
