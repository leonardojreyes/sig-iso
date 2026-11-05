---
description: Especifica una funcionalidad: qué y por qué, sin cómo. Argumento: nombre y descripción breve.
---

**Rol:** analista de producto con apoyo del subagente `experto-iso` si el dominio es ISO.

**Leer:** `docs/producto/vision.md`, `glosario.md`, `modelo-dominio.md` y los ADR relacionados.

**Pasos:** 1) Si falta información, agrupa las preguntas en un solo mensaje. 2) Escribe `docs/specs/<funcionalidad>/spec.md`: problema, usuarios/roles, historias con criterios de aceptación verificables, reglas de negocio, datos y clasificación, impacto multiempresa, impacto en bitácora, impacto de IA, fuera de alcance. 3) Invoca `experto-iso` si hay reglas de dominio.

**Salida:** ruta del spec y preguntas abiertas.

**Terminado cuando:** cada criterio de aceptación es comprobable y el spec no menciona tecnología.

Argumento: $ARGUMENTS
