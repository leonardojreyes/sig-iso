# ADR 017 — Archivos (evidencias): almacenamiento compatible S3 con hash SHA-256

- **Estado:** Aprobado (2026-11-04)
- **Fecha:** 2026-11-04
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

Evidencias con integridad verificable, separadas por empresa.

## Decisión

API S3; SeaweedFS en desarrollo por su bajo consumo; hash SHA-256 por archivo; prefijo/bucket por empresa.

## Alternativas consideradas

Ceph (demasiado pesado para desarrollo).

## Estándar y licencia

- Estándar: API S3
- Licencia: Apache 2.0

## Consecuencias

Una misma evidencia se reutiliza para varios requisitos mapeados.

## Criterio de tecnología mayoritaria (P12)

Se prioriza tecnología con soporte largo y talento disponible; las excepciones se justifican arriba.
