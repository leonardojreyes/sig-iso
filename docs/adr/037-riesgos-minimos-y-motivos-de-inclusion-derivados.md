# ADR 037 — Riesgos mínimos y motivos de inclusión derivados

- **Estado:** Propuesto (2026-11-17). Se aprueba junto con el PR del hito; implementa el spec `docs/specs/declaracion-justificada/` (aprobado el 2026-11-17). Completa el ADR 033 (Declaración y exportación Word) y no lo contradice.
- **Fecha:** 2026-11-17
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

La Declaración de Aplicabilidad del MVP dice si cada control del Anexo A aplica y cómo está implementado, pero no **por qué** se incluyó ni de qué riesgo viene (hueco 1 del M6). El producto no tiene gestión de riesgos y no debe convertirse en un gestor completo. Hace falta un registro **mínimo** que dé trazabilidad sin inventar nada y que diga con claridad lo que no cubre.

Restricciones: reglas 2 (multiempresa), 3 (sin texto de normas), 4 (bitácora) y 5 (IA solo por puerto; aquí no se usa); versiones aprobadas inmutables (ADR 033); las entradas de las normas se referencian por `(código de librería, id estable)` sin clave foránea (M2).

## Decisión

1. **El motivo «riesgo» siempre se deriva, nunca se escribe.** Un control del Anexo A tiene motivo «riesgo» si algún riesgo **vigente** se trata con él: (a) por un **control vigente de la empresa** que lo cubre mediante los mapeos de M3, o (b) por un **vínculo directo** riesgo–control del Anexo A, el **tratamiento previsto**, para quien empieza por los riesgos y aún no tiene el control. El (b) se muestra **distinguido** («tratamiento previsto, sin control de la empresa») y no cuenta como implementado. Así no hay dos formas de decir lo mismo ni vínculos que se desfasan.
2. **Los demás motivos se registran**, de una lista cerrada: requisito legal, requisito contractual, necesidad del negocio y otro. **La nota breve es obligatoria** en los cuatro (a qué requisito responde, o por qué).
3. **Riesgo mínimo:** título, descripción, probabilidad y impacto (1 a 5), decisión de tratamiento (mitigar, aceptar, transferir, evitar) y responsable, **obligatorio al aceptar**. Código correlativo por empresa (`R-001`), sin reutilizar; se retira, no se borra. Las decisiones equivalen a las que la norma llama modificar, retener, evitar y compartir el riesgo (se anota en el glosario).
4. **Nivel inicial calculado**, no escrito: probabilidad × impacto; bajo 1 a 4, medio 5 a 9, alto 10 a 15, crítico 16 a 25. Se muestra **con palabras**. La escala y los cortes son **fijos hoy**, se **imprimen en el documento** y se **congelan en cada versión aprobada**; el documento dice que son el método por omisión de la herramienta, no el criterio de aceptación de la empresa. Hacerlos configurables queda para después.
5. **Aprobar se bloquea** si un control que aplica no tiene motivo (409 con motivo cerrado). Es la propuesta Q1 del spec; si estorba en la práctica, pasa a advertencia y la versión se marca «con reservas» (nuevo ADR).
6. **Referencia al tratamiento** por Declaración (una por norma): análisis de riesgos y plan de tratamiento, cada uno con título, versión, fecha y ubicación. Solo se **nombran**; el producto no los guarda ni los gestiona. Son opcionales; si hay riesgos «mitigar» y falta el plan, se advierte sin bloquear.
7. **Congelado e inmutable:** al aprobar se copian motivos con notas, riesgos (código, título, nivel y decisión tal como estaban), referencias y la escala. Tablas de copia **sin `update` ni `delete`** para la aplicación. Las versiones anteriores se leen como estaban y lo dicen.
8. **Lo que el documento declara siempre, también aprobado:** registro simplificado; **sin riesgo residual ni su aceptación**; **sin controles adicionales** fuera del Anexo A; sin activos de información; y la falta del plan si corresponde. La Declaración **no se presenta como lista para un auditor** mientras falten controles adicionales y responsable por control.
9. **Datos y bitácora:** todo con `empresa_id`, RLS forzada y prueba de aislamiento. La bitácora (misma transacción) registra qué, quién y el código del objeto; **nunca** título, descripción, notas ni datos de las referencias. Los textos libres pueden traer datos personales por descuido: advertencia fija en pantalla, sin detección automática ni envío a IA. Siguen siendo **solo datos de prueba** hasta que el asesor legal valide el ADR 028.
10. **Permisos:** `riesgos.ver` (administrador y colaborador) y `riesgos.gestionar` (solo administrador SIG); aprobar sigue siendo del administrador SIG.

## Alternativas

- **Escribir el motivo «riesgo» a mano.** Más simple, pero se desfasa de los vínculos reales y permite decir «riesgo» sin riesgo. Se descarta.
- **Exigir siempre un control de la empresa para justificar por riesgo.** Obliga a crear controles vacíos. Se evita con el tratamiento previsto.
- **Gestión de riesgos completa (residual, activos, matriz, aceptación formal).** Fuera del MVP; sería otro producto. Se declara lo que falta.
- **Solo advertir si falta el motivo.** Permite aprobar una Declaración sin justificar. Se prefiere bloquear (Q1).
- **Referencias como archivos subidos.** Agrega superficie (M4) sin necesidad; se nombran.

## Estándar y licencia

Sin dependencias nuevas. No incluye texto de normas: solo identificadores de control y guía propia. Pendiente de confirmar con el ejemplar de la NTE INEN-ISO/IEC 27001:2023 qué pide exactamente la cláusula 6.1.3 y el papel de la aceptación del riesgo residual.

## Consecuencias

- La Declaración gana trazabilidad hasta el tratamiento de riesgos, pero **sigue incompleta** frente a un auditor (sin residual, sin controles adicionales, sin responsable por control); el documento lo dice.
- Aprobar exige trabajo previo: cada control que aplica necesita motivo registrado o riesgo vinculado.
- Retirar un riesgo puede dejar controles sin motivo: se avisa **antes** de confirmar.
- Una versión aprobada no cambia aunque cambien después los riesgos; la escala congelada permite releerla aunque los cortes evolucionen.
- Se agregan a los insumos del asesor legal (ADR 028) los riesgos, las notas y las referencias como datos confidenciales de la empresa.
- Lo siguiente en prioridad: riesgo residual y su aceptación, controles adicionales, responsable por control.
