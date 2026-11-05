# ADR 020 — Librerías de normas: formato abierto propio (YAML con esquema JSON)

- **Estado:** Aprobado (2026-11-04)
- **Fecha:** 2026-11-04
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

Agregar una norma debe ser cargar datos, no cambiar código. El texto de las normas ISO tiene derechos de autor.

## Decisión

Librería YAML con esquema JSON validado en CI: norma, edición, cláusulas/controles, título breve, guía redactada por SynapTech con palabras propias y mapeos. **Sin texto de las normas.** Librerías globales (solo lectura) y propias por empresa. Verificación del subagente `revisor-cumplimiento`.

## Alternativas consideradas

Importar librerías de terceros (requiere revisar licencia y ADR; CISO Assistant es AGPLv3: solo inspirarse, no copiar código).

## Estándar y licencia

- Estándar: JSON Schema
- Licencia: Propia

## Consecuencias

Normas v1: ISO 9001, ISO/IEC 27001:2022, ISO/IEC 42001:2023. Debe admitir 14001, 45001, 20000-1, 22301, 37001, 27701, etc.

## Criterio de tecnología mayoritaria (P12)

Se prioriza tecnología con soporte largo y talento disponible; las excepciones se justifican arriba.
