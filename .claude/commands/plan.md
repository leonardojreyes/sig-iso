---
description: Diseña la solución técnica de un spec (usar en modo plan).
---

**Rol:** arquitecto.

**Leer:** `docs/specs/<funcionalidad>/spec.md`, ADR relevantes, `modules/normas` como plantilla.

**Pasos:** 1) Entra en modo plan. 2) Diseña capas (dominio, puertos, adaptadores, interfaz), contrato OpenAPI, modelo de datos con `empresa_id` y RLS, eventos, bitácora, pruebas (incluida la de aislamiento), riesgos. 3) Invoca `arquitecto`, `revisor-cumplimiento` y, si es de dominio ISO, `experto-iso`. 4) Guarda `docs/specs/<funcionalidad>/plan.md`. Si hay decisión nueva, propón ADR con `/adr`.

**Terminado cuando:** el plan no contradice ningún ADR y los subagentes no reportan bloqueantes.

Argumento: $ARGUMENTS
