---
description: Revisión con subagentes en paralelo antes del PR.
---

**Rol:** coordinador de revisión.

**Leer:** el diff (`git diff`) y el spec/plan de la funcionalidad.

**Pasos:** lanza en paralelo `arquitecto`, `revisor-multiempresa`, `revisor-seguridad`; añade `auditor-accesibilidad` si hay cambios de interfaz, `revisor-cumplimiento` si hay datos personales, bitácora o librerías de normas, y `experto-iso` si hay reglas de dominio. Consolida sin duplicados y ordena por severidad.

**Salida:** tabla de hallazgos (severidad, ruta:línea, responsable), veredicto *aprobar / corregir*.

**Terminado cuando:** no hay hallazgos bloqueantes. El merge lo aprueba un humano.

Argumento: $ARGUMENTS
