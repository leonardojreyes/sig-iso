# Spec — Declaración de Aplicabilidad justificada

- **Estado:** Borrador, por aprobar (2026-11-17). Validado por `experto-iso` el mismo día («aprobar con correcciones», todas incorporadas). Preguntas Q1 a Q9 con una propuesta por omisión (sección 10).
- **Ruta:** continúa el MVP (`docs/specs/mvp-certificacion/spec.md`, historias H8 y H9) y cierra el hueco 1 de «Decisiones que son del responsable» del hito M6 en `docs/fase0/estado.md`, **salvo** los controles adicionales y el responsable por control (sección 9).
- **Depende de:** el MVP ya hecho (M1 a M7): controles de la empresa, mapeos, evidencias, Declaración con versión congelada y exportación a Word; y de `docs/producto/modelo-dominio.md` (un riesgo «se trata con» controles).
- **Fecha:** 2026-11-17
- **Para confirmar con tu ejemplar de la NTE INEN-ISO/IEC 27001:2023:** qué pide exactamente la cláusula 6.1.3 para la Declaración, el papel de la aceptación del riesgo residual (6.1.3 y 8.3) y si las fuentes para elegir controles están acotadas. El spec se apoya en la práctica habitual; yo no puedo comprobar el texto oficial.

## 1. Problema

La Declaración de Aplicabilidad (DdA) que hoy genera el producto dice, por cada control del Anexo A de ISO/IEC 27001, **si aplica y cómo está implementado**. Un auditor espera además **por qué** se incluyó cada control y que esa decisión se pueda **rastrear hasta el tratamiento de riesgos** de la empresa (cláusula 6.1.3, por su identificador). Hoy el producto no puede mostrar nada de eso:

- no guarda el **motivo** de incluir un control (riesgo, requisito legal, requisito contractual, necesidad del negocio u otra fuente);
- no tiene un **registro de riesgos**, así que ningún control puede decir «existe para tratar este riesgo»;
- el documento exportado solo lleva una nota fija («los controles salen del tratamiento de riesgos, que se gestiona fuera del sistema»), sin decir **cuál** es ese documento.

Por eso la DdA se presenta como **preliminar** y no sirve todavía para una revisión de certificación. Esta funcionalidad le da trazabilidad y justificación con un registro de riesgos **mínimo**, sin convertir el producto en un gestor completo de riesgos, y **dice con claridad lo que todavía no cubre**.

## 2. Usuarios y roles

| Rol                                                 | Qué hace                                                                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Administrador SIG de la empresa                     | Crea, cambia y retira riesgos; los vincula; registra los motivos de inclusión y las referencias al tratamiento; **aprueba** la Declaración |
| Colaborador de la empresa                           | **Consulta** los riesgos, los motivos y la Declaración; no cambia nada de esto                                                             |
| Otros roles, o persona sin cuenta o de otra empresa | No ven nada de esto (los demás roles siguen sin permisos hasta que se definan, como hoy)                                                   |

## 3. Historias y criterios de aceptación

### H1 — Registro básico de riesgos

- **H1.1** El administrador puede **crear un riesgo** con: título breve, descripción, **probabilidad** (1 a 5), **impacto** (1 a 5), una **decisión de tratamiento** (mitigar, aceptar, transferir o evitar) y un responsable (una persona de la empresa). El responsable es **obligatorio cuando la decisión es «aceptar»** (alguien responde por lo que se acepta) y opcional en los demás casos.
- **H1.2** El **nivel inicial** del riesgo (bajo, medio, alto o crítico) se **calcula** de la probabilidad y el impacto y se muestra **con palabras**, no solo con color; la persona no lo escribe.
- **H1.3** Cada riesgo recibe un **código** propio y correlativo de la empresa (por ejemplo «R-001»), que no se repite ni se reutiliza.
- **H1.4** Puedo **cambiar** un riesgo y **retirarlo**. Retirar no borra: el riesgo conserva su historia y deja de contarse como vigente. **Antes de confirmar el retiro**, la pantalla dice qué controles del Anexo A quedarían **sin motivo** por ese retiro. Si dos personas lo cambian a la vez, la segunda recibe el aviso «otra persona lo cambió antes» y no pisa el cambio.
- **H1.5** La pantalla avisa que los textos **no deben llevar datos personales ni texto de las normas**.
- **H1.6** El colaborador ve la lista y el detalle, pero no ve ninguna acción de cambio. Quien no tiene permiso ve «sin acceso» y no se entera de qué existe.

### H2 — Vincular riesgos con controles

- **H2.1** Puedo **vincular** un riesgo a uno o más **controles de la empresa** (los mismos de M3) y quitar el vínculo; un control puede tratar varios riesgos.
- **H2.2** No puedo vincular un riesgo retirado ni un control retirado, ni a un control o riesgo de otra empresa. Retirar un control deja **avisados** los vínculos afectados y no los borra.
- **H2.3** Cuando una empresa empieza por los riesgos y **aún no tiene el control**, puedo vincular el riesgo **directamente a un control del Anexo A** como **«tratamiento previsto»**. Ese vínculo cuenta como motivo «riesgo», pero la Declaración lo muestra **distinguido**: «tratamiento previsto, sin control de la empresa». Cuando después se crea y mapea el control de la empresa, el vínculo directo se puede quitar.
- **H2.4** Al mirar un riesgo veo **qué controles lo tratan** (de la empresa y del Anexo A previstos); al mirar un control, **qué riesgos trata**.
- **H2.5** La lista de riesgos señala los que tienen decisión «mitigar» y **ningún control ni tratamiento previsto**.

### H3 — Motivo de inclusión por control del Anexo A

- **H3.1** Para cada control del Anexo A que **aplica**, la empresa puede registrar uno o más **motivos de inclusión** de una lista cerrada: **requisito legal**, **requisito contractual**, **necesidad del negocio** u **otro** (una política propia, un marco adoptado, la adopción íntegra del Anexo A). **Todo motivo registrado lleva una nota breve obligatoria** en sus propias palabras: en el legal y el contractual, **a qué requisito responde**; en el negocio y el «otro», **por qué**. Así la elección es consciente y no un clic en bloque.
- **H3.2** El motivo **riesgo** no se escribe: se **deriva**. Un control del Anexo A tiene el motivo «riesgo» si algún riesgo vigente se trata con él: por un **control vigente de la empresa** que lo cubre, o por un **vínculo directo de tratamiento previsto** (H2.3). La fila muestra **qué riesgos** (código, título y nivel inicial) y de qué manera.
- **H3.3** Un control del Anexo A que aplica **tiene motivo** si tiene al menos un riesgo derivado o al menos un motivo registrado. Si no, el borrador lo marca «sin motivo».
- **H3.4** Para los controles que **no** aplican sigue valiendo la justificación de exclusión que ya existe; no se les pide motivo de inclusión.
- **H3.5** Cambiar los motivos de un control deja rastro de quién y cuándo, y respeta el aviso de «otra persona lo cambió antes».

### H4 — Referencia al tratamiento de riesgos

- **H4.1** El administrador registra, **por Declaración**, la **referencia al documento de análisis de riesgos** y al **plan de tratamiento** de la empresa: título, versión, fecha y **dónde o con qué código se conserva** (son documentos que la empresa guarda donde prefiera; el producto solo los nombra).
- **H4.2** Las dos referencias son opcionales. Si hay riesgos con decisión «mitigar» y no hay referencia al plan de tratamiento, el borrador **advierte** sin bloquear, y la **misma advertencia figura en el documento exportado** (H6.3).
- **H4.3** Cambiar una referencia deja rastro de quién y cuándo.

### H5 — El borrador y la aprobación

- **H5.1** El borrador de la Declaración muestra, en cada fila que aplica, sus **motivos** (los derivados y los registrados) y sus **riesgos**, y en el resumen cuántos controles que aplican **tienen** y **no tienen** motivo, y cuántos riesgos vigentes **no tienen control ni tratamiento previsto**.
- **H5.2** **No se puede aprobar** mientras haya un control que aplica **sin motivo** (además de las condiciones que ya existen). El aviso dice cuáles son (Q1).
- **H5.3** Al aprobar, la versión **congela** también los motivos con sus notas, los riesgos que los justifican (código, título, nivel inicial y decisión **tal como estaban**), las referencias al tratamiento y **la escala y los cortes del nivel** usados. Cambios posteriores a un riesgo o a un motivo **no alteran** una versión ya aprobada.
- **H5.4** Las versiones aprobadas **antes** de esta funcionalidad se siguen viendo y exportando como estaban, sin motivos ni riesgos, y lo dicen.
- **H5.5** Mientras no esté aprobada, todo lo que se muestre o exporte sigue llevando el rótulo de **borrador / preliminar**.

### H6 — El documento Word

- **H6.1** Cada fila que aplica lleva, además de lo actual, el **motivo de inclusión** (con su nota) y los **códigos de los riesgos** relacionados, distinguiendo el «tratamiento previsto».
- **H6.2** El documento incluye una sección **«Tratamiento de riesgos»** con un resumen de los riesgos vigentes (código, título, nivel inicial, decisión de tratamiento, responsable y controles que lo tratan) y las **referencias** al análisis y al plan, con su título, versión, fecha y ubicación. Imprime **la escala y los cortes** usados y dice que son **el método por omisión de la herramienta, no el criterio de aceptación de la empresa**.
- **H6.3** **Avisos fijos, también en las versiones aprobadas** (un documento aprobado no debe parecer completo si no lo es). Dicen siempre, en esa sección: que el registro de riesgos es **simplificado**; que **no registra el riesgo residual ni su aceptación** por los responsables, que la empresa debe conservar aparte; que **no incluye controles adicionales** fuera del Anexo A (los que el tratamiento de riesgos haya determinado y no estén en el Anexo A); y que no contempla activos de información. Si hay riesgos con decisión «mitigar» y no hay referencia al plan de tratamiento, lo dice. Si la empresa no tiene riesgos ni referencias, dice que **no hay registro de riesgos en el sistema** y mantiene la nota actual de que los riesgos se gestionan fuera.
- **H6.4** Una versión aprobada se exporta **siempre desde su copia congelada**; el borrador, con el rótulo de preliminar. Cada exportación queda registrada con su huella, como hoy.
- **H6.5** Los textos que escribe la empresa se escriben como **texto plano**: sin fórmulas, enlaces ni macros, y con longitud acotada.

## 4. Reglas de negocio

1. Los riesgos son **de la empresa**, no de una norma. La Declaración sigue siendo **una por norma** (hoy, ISO/IEC 27001); los riesgos llegan a ella **a través de los controles de la empresa y sus mapeos**, que ya existen, o de un **tratamiento previsto** directo.
2. El motivo «riesgo» **siempre se deriva**; los demás se registran, con nota. Así no hay dos formas de decir lo mismo ni vínculos que se desfasan.
3. **Nivel inicial** = probabilidad × impacto. Bajo: 1 a 4. Medio: 5 a 9. Alto: 10 a 15. Crítico: 16 a 25 (Q3).
4. Decisión «aceptar», «transferir» o «evitar»: **no** exige control vinculado. Decisión «mitigar» sin control ni tratamiento previsto: **advertencia**, no bloqueo. Decisión «aceptar» sin responsable: **no se guarda** (H1.1).
5. Un riesgo o un control **retirado** no cuenta como vigente para derivar motivos; su historia se conserva.
6. La derivación es **en vivo** mientras la Declaración es borrador; al aprobar, se **congela** (H5.3).
7. Aprobar sigue siendo **solo del administrador SIG**; el borrador no se aprueba con controles que aplican sin motivo.
8. **El producto no inventa riesgos ni motivos:** todo lo escribe una persona de la empresa. La Declaración sigue marcada como **preliminar** hasta aprobada; aun aprobada, el documento **dice lo que no cubre** (H6.3) y no declara que el análisis de riesgos sea completo ni correcto.
9. La empresa **nunca** viaja en un dato que envía el cliente: sale de la sesión.
10. Términos: en este spec «control del Anexo A» es lo que el glosario llama **control de la norma**; «motivo de inclusión» es la **justificación de inclusión** del glosario. Las decisiones «mitigar, aceptar, transferir, evitar» equivalen a las que la norma llama modificar, retener, evitar y compartir el riesgo (se anotará en el glosario).

## 5. Datos y clasificación

| Dato                                                                              | Clasificación                             | Retención                                                                                                   |
| --------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Riesgo: título, descripción, probabilidad, impacto, decisión, nivel inicial       | **Confidencial de la empresa**            | Mientras exista la empresa; los retirados se conservan (hipótesis a confirmar con el asesor legal, ADR 028) |
| Responsable de un riesgo (identificador opaco de la persona)                      | Personal (seudonimizado)                  | Igual que los demás identificadores de personas                                                             |
| Vínculo riesgo–control (de la empresa o del Anexo A)                              | Confidencial de la empresa                | Se conserva con su historia                                                                                 |
| Motivos de inclusión y su nota                                                    | Confidencial de la empresa                | Los de una versión aprobada, como la versión; los demás, mientras exista la empresa                         |
| Referencias al análisis y al plan de tratamiento                                  | Confidencial de la empresa                | Las de una versión aprobada, como la versión                                                                |
| Copia congelada de motivos, riesgos, referencias y escala en una versión aprobada | Confidencial de la empresa, **inmutable** | Igual que la versión aprobada                                                                               |

Los textos libres (descripción, notas) pueden traer datos personales por descuido: la pantalla lo advierte (H1.5) y no se envían a ningún asistente de IA ni a la bitácora. Siguen siendo **solo datos de prueba** hasta que el asesor legal valide el ADR 028.

## 6. Impacto multiempresa

- Todo lo nuevo (riesgos, vínculos, motivos, referencias y su copia congelada) pertenece a **una empresa** y ninguna persona ve ni cambia lo de otra.
- Cada pieza trae su **prueba de aislamiento**: con la sesión de la empresa A se intenta leer, vincular y cambiar riesgos y motivos de B, y debe fallar. Un riesgo de A **no** se puede vincular a un control de B.
- La derivación y la exportación usan **solo** datos de la empresa de la sesión. Una versión de otra empresa responde igual que una que no existe.

## 7. Impacto en bitácora

Cada creación, cambio, retiro, vínculo, desvínculo, cambio de motivos y cambio de referencias deja un hecho **en la misma operación**: **qué** pasó, **quién** y **sobre qué objeto** (el código del riesgo o del control). **Nunca** el título, la descripción, las notas ni los datos de las referencias. La aprobación de la Declaración suma al hecho actual solo **conteos** (controles con y sin motivo, riesgos congelados). Las exportaciones siguen registrándose con su huella antes de entregar el archivo.

## 8. Impacto de IA

Ninguno. Esta funcionalidad no usa asistente ni genera textos con IA. Una ayuda futura que proponga motivos o riesgos tendría que marcarlos «borrador generado por IA» y exigir que una persona los acepte; queda fuera de este spec.

## 9. Fuera de alcance

- Metodología de riesgos configurable, matriz de calor, apetito de riesgo, **riesgo residual** y su **aceptación formal** por los responsables y la dirección (Q4): por eso el documento lo declara siempre (H6.3).
- Activos de información y su relación con los riesgos; riesgos de proceso; oportunidades.
- Evaluación de impacto de los sistemas de IA (ISO/IEC 42001) y Declaraciones de ISO 9001 o 42001.
- **Controles adicionales** (de otra fuente, sin equivalente en el Anexo A) como filas propias de la Declaración, y la columna de **responsable por control**: quedan para otra entrega (hueco 1 del M6, partes 2 y 4). **Mientras no existan, la Declaración no debe presentarse como lista para un auditor**: el documento lo dice (H6.3).
- Subir el plan de tratamiento como archivo o gestionarlo en el producto: solo se **nombra**.
- Importar riesgos desde una hoja de cálculo; comparar versiones de la Declaración; firma electrónica.
- Que el producto decida por la empresa si un control debe aplicar: sigue siendo decisión manual (diagnóstico y administrador SIG).

## 10. Preguntas abiertas (propuesta por omisión)

| #   | Pregunta                                                                                     | Propuesta por omisión                                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | ¿Falta de motivo bloquea la aprobación o solo advierte?                                      | **Bloquea** (H5.2). Con la lista de motivos más amplia (incluye «otro») y la nota obligatoria, no obliga a inventar. Si estorba, pasar a advertencia y marcar la versión «con reservas». |
| Q2  | ¿Qué lista cerrada de motivos?                                                               | Riesgo (derivado), requisito legal, requisito contractual, necesidad del negocio y otro; nota obligatoria en los cuatro que se registran.                                                |
| Q3  | ¿Escala y umbrales del nivel?                                                                | 1 a 5 por 1 a 5; bajo 1 a 4, medio 5 a 9, alto 10 a 15, crítico 16 a 25. Fijos hoy, pero **impresos en el documento y congelados** en la versión; configurables después.                 |
| Q4  | ¿Entra el riesgo residual y su aceptación?                                                   | **No**: solo nivel inicial, decisión de tratamiento y responsable (obligatorio al aceptar). El documento dice siempre que no lo registra. Es lo primero que se pediría después.          |
| Q5  | ¿Las referencias al tratamiento van por empresa o por Declaración?                           | **Por Declaración** (una por norma), igual que el alcance.                                                                                                                               |
| Q6  | ¿Puede el colaborador ver los riesgos?                                                       | **Sí, solo consultar**, como el resto del marco de controles.                                                                                                                            |
| Q7  | ¿Se detectan datos personales en las descripciones?                                          | **No automáticamente**: advertencia fija en la pantalla; la detección es parte del trabajo con el asesor legal.                                                                          |
| Q8  | ¿El código de riesgo lo escribe la persona o es correlativo?                                 | **Correlativo automático** por empresa («R-001»).                                                                                                                                        |
| Q9  | ¿Se permite vincular un riesgo directamente a un control del Anexo A (tratamiento previsto)? | **Sí** (H2.3): evita crear controles vacíos solo para justificar. Se muestra distinguido y no cuenta como implementado.                                                                  |
