# Spec — Auditoría interna

- **Estado:** **Borrador validado con `experto-iso` (sección 11), para aprobación del responsable.** Las preguntas abiertas (sección 10) traen propuesta por omisión: basta decir «apruebo con la propuesta por omisión».
- **Ruta:** Etapa A de `docs/producto/hoja-de-ruta.md` (módulo «Auditoría interna», ~2 días). Módulo 3 (Auditorías) de `docs/producto/vision.md`.
- **Depende de:** normas adoptadas y diagnóstico (M1 a M6a), personas (M7) y el directorio de personas del control documental. **No** depende de «Gestión de riesgos completa» (puede ir antes o después).
- **Fecha:** 2026-11-19
- **Para confirmar con tu NTE INEN-ISO/IEC 27001:2023** (cláusula 9.2, auditoría interna): qué debe cubrir el programa, los criterios, la objetividad e imparcialidad de quien audita, el informe y la conservación de la información documentada. El spec no copia texto de la norma.

## 1. Problema

Para pasar la Etapa 2 la empresa debe mostrar **al menos una auditoría interna completada**, hecha con un programa, por personas imparciales, con criterios claros y con sus resultados registrados. Hoy no hay dónde programarla, preparar la lista de verificación a partir de los requisitos que la empresa adoptó, anotar lo observado, dejar claro quién auditó qué y que no se auditó a sí misma, ni emitir un informe que se pueda mostrar a un auditor externo.

## 2. Usuarios y roles

| Rol                                               | Qué hace                                                                                                                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Administrador SIG                                 | Define procesos y relaciones, arma y **aprueba el programa anual**, planifica auditorías, **designa** al equipo, emite el informe y **cierra** la auditoría; ve todo |
| Auditor interno                                   | Prepara y ejecuta **las auditorías en las que está designado**: evalúa la lista de verificación y registra hallazgos; consulta el programa                           |
| Colaborador                                       | **Consulta** el programa, las auditorías y los informes cerrados; no escribe                                                                                         |
| Otros roles, persona sin cuenta o de otra empresa | No ven nada (sin permisos hasta definir los demás roles, ADR 029)                                                                                                    |

Una persona tiene **un solo rol** hoy (ADR 029): el administrador SIG también puede ser designado auditor, sujeto a las reglas de independencia.

## 3. Historias y criterios de aceptación

### H1 — Procesos y personas relacionadas

- **H1.1** El administrador **registra procesos** de la empresa: código correlativo (`PR-001`), nombre, descripción breve y **persona dueña**. Un proceso **no se borra**: se **retira**.
- **H1.2** El administrador **relaciona personas con un proceso** con un tipo de relación (lista cerrada: dueña, participa, diseñó, supervisa). Una persona puede tener varias relaciones con un proceso y con varios procesos. Quitar una relación deja rastro.
- **H1.3** La lista de procesos muestra dueña y cuántas personas están relacionadas, y avisa de los procesos **sin dueña** o **sin relaciones registradas** (la independencia solo se puede comprobar con lo registrado).

### H2 — Programa anual

- **H2.1** El administrador crea **un programa por año** con su objetivo y las normas que cubre (entre las adoptadas). Hay **un solo programa por año** y empresa.
- **H2.2** Dentro del programa se **planifican auditorías** (H3). El programa muestra una **línea de tiempo por trimestre**, el estado de cada auditoría y la **cobertura**: qué procesos y qué capítulos de cada norma están en alguna auditoría del año y cuáles no.
- **H2.3** El administrador **aprueba** el programa: queda constancia de quién y cuándo. Cambiar el objetivo o las normas de un programa aprobado lo devuelve a «sin aprobar». Agregar, **reprogramar** o **cancelar** una auditoría de un programa aprobado exige un **motivo** (lista cerrada y nota breve) y queda en la historia.
- **H2.4** Al armar el programa la pantalla muestra, por proceso y por norma, **cuándo fue la última auditoría cerrada** y cuántos **hallazgos abiertos** tiene, como ayuda para decidir qué incluir. Es informativo.

### H3 — Planificar una auditoría

- **H3.1** Una auditoría tiene: código correlativo por año (`AI-2027-01`), **objetivo**, **criterios** (una o varias normas adoptadas; con más de una es **combinada**), **alcance** (uno o varios procesos y, opcionalmente, capítulos o temas de las normas), **fechas** planificadas de inicio y fin, fecha de la **reunión de apertura** y de la **de cierre** (opcionales), **auditor líder** y, opcionalmente, más personas en el equipo.
- **H3.2** **Independencia.** Al designar a una persona para una auditoría, el sistema comprueba, **por cada proceso del alcance**, que no tenga relación con él (dueña, participa, diseñó o supervisa). Si la tiene, **no se puede designar**, y el mensaje dice por qué y con qué proceso. Un aviso adicional (no bloqueo) señala que **audita el mismo proceso por segunda auditoría seguida** (propuesta por omisión: en 12 meses).
- **H3.3** **Excepción.** Cuando de verdad no hay otra persona disponible, el administrador puede designar a una persona con conflicto **indicando un motivo**; la excepción queda **marcada y visible** en la auditoría, en el informe y en la bitácora. Un administrador **no puede aprobar su propia excepción** salvo que sea el único administrador activo (misma regla que la autoaprobación del control documental).
- **H3.4** Estados de una auditoría: **planificada → en preparación → en ejecución → informe emitido → cerrada**, y **cancelada** (con motivo). **Reprogramar** cambia fechas con motivo; no crea otra auditoría. Las transiciones solo avanzan; una cerrada es **inmutable**.
- **H3.5** Cambiar el alcance o los criterios **después de generar la lista** (H4) pide confirmación: la lista no se rehace sola; se **regenera** a propósito y avisa qué respuestas ya dadas se conservan.

### H4 — Lista de verificación

- **H4.1** Al pasar a «en preparación», el sistema **genera la lista** con **una fila por entrada** de las normas elegidas que la empresa adoptó (cláusulas y controles), limitada a los capítulos o temas indicados en el alcance; si no se indicó ninguno, todas. Cada fila lleva el **identificador de la entrada** y su título breve y guía propia (**nunca** texto de la norma).
- **H4.2** La lista **no cambia** si después se adopta otra librería o sale una versión nueva: queda fijada a la versión de librería con que se generó.
- **H4.3** El equipo puede **agregar preguntas propias** a una fila (texto breve, máximo 5 por fila), por ejemplo «solicitar el registro de capacitación».
- **H4.4** Cada fila trae, como **contexto**, el estado del diagnóstico de esa entrada y su cobertura de evidencias (M4), solo para orientar al auditor: **no** se copia como resultado.

### H5 — Ejecución y hallazgos

- **H5.1** Con la auditoría **en ejecución**, el equipo asigna a cada fila un **resultado**: conforme, no conforme, observación, oportunidad de mejora, **no aplica** (exige justificación) o **no verificado**. Un resultado distinto de «conforme» y «no verificado» **exige** una nota con la **evidencia objetiva** observada (qué se vio, dónde, qué se esperaba).
- **H5.2** Cada fila con resultado «no conforme», «observación» u «oportunidad de mejora» genera o se enlaza a un **hallazgo**. Un hallazgo tiene: tipo (**NC mayor**, **NC menor**, **observación**, **oportunidad de mejora**), **proceso** afectado, **entrada de la norma** a la que se refiere (una o varias), descripción de la evidencia y **quién lo registró**. Se puede registrar un hallazgo que **no sale de una fila** (por ejemplo, uno transversal).
- **H5.3** **Cada NC** exige proceso y entrada de la norma. Los hallazgos quedan **abiertos**; su tratamiento (causa raíz, acciones y verificación de eficacia) es del módulo «No conformidades y acciones correctivas» y **no se hace aquí**. La pantalla lo dice.
- **H5.4** Solo las personas del equipo designado pueden evaluar filas y registrar hallazgos de esa auditoría. Cambiar un resultado o un hallazgo usa **control de concurrencia** (si otra persona lo cambió antes, el cambio se rechaza). Un hallazgo no se borra: se **anula** con motivo mientras la auditoría no esté cerrada.
- **H5.5** La pantalla muestra el **avance** (filas evaluadas, por resultado) y los **hallazgos** por tipo y proceso.

### H6 — Informe y cierre

- **H6.1** Para **emitir el informe** deben estar evaluadas **todas** las filas (o marcadas «no verificado» con nota) y cada hallazgo debe tener los datos obligatorios. Quien emite es el administrador o el auditor líder.
- **H6.2** El informe **congela** una copia: objetivo, criterios, alcance, fechas, equipo con su independencia y excepciones, conteo de filas por resultado, hallazgos y cobertura; cambiar algo después no altera la versión emitida. Se exporta a **Word** con el aviso «Informe de auditoría interna; no es un certificado ni lo emite un organismo».
- **H6.3** El administrador **cierra** la auditoría: queda constancia de quién y cuándo. Cerrar **no cierra los hallazgos**: siguen abiertos hasta tratarse. Una auditoría cerrada se puede **consultar y descargar** siempre.
- **H6.4** El panel muestra, por programa, **cuántas auditorías internas están cerradas** y si la empresa **ya cumple el prerrequisito de la Etapa 2** (al menos una cerrada con informe, con cobertura del sistema de gestión del alcance). Es un dato derivado que consumirá «Certificación y mantenimiento»; **este módulo no decide** la etapa.

## 4. Reglas de negocio

1. **Un programa por año y empresa**; las auditorías cuelgan de un programa. El código de auditoría es correlativo por año y empresa y no se reutiliza.
2. **Independencia por proceso:** quien tiene una relación registrada con un proceso del alcance **no puede** auditarlo, salvo excepción con motivo (H3.3). Se evalúa **al designar y otra vez al emitir el informe** (por si cambiaron las relaciones).
3. **Un hallazgo NC lleva proceso y entrada de la norma**; la gravedad (mayor o menor) la decide el **auditor líder** y se registra con su nota.
4. **Solo se audita lo adoptado:** la lista y los criterios salen de las normas que la empresa adoptó; lo demás responde como inexistente, igual que lo de otra empresa.
5. **La lista se congela con su versión de librería** y solo cambia si se regenera a propósito.
6. **Informe emitido y auditoría cerrada son inmutables.** Un error se corrige con una **auditoría complementaria** o una nota de aclaración posterior que no altera el informe original.
7. **Una auditoría cancelada** conserva todo lo registrado y no cuenta para la cobertura ni para el prerrequisito.
8. **La cobertura** se calcula con auditorías cerradas (las demás figuran como «planificada»).
9. **Fechas** en la hora de Ecuador; la fecha de fin no es anterior a la de inicio; una auditoría no se cierra antes de su fecha de inicio.
10. **Los textos libres** (evidencia, preguntas propias, notas) no deben llevar datos personales innecesarios ni texto de las normas: la pantalla lo avisa.
11. **Un proceso o una persona dada de baja** no se pierde de las auditorías ya hechas: se conserva su identificador en la versión congelada.

## 5. Datos y clasificación

| Dato                                           | Clasificación                                                 | Observación                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Proceso (código, nombre, descripción)          | Interna                                                       | Sin datos personales                                                                                                              |
| Relación persona–proceso                       | **Datos personales (identificador + rol laboral)**            | Base: interés legítimo de la empresa en cumplir la norma; ADR 028                                                                 |
| Programa (año, objetivo, normas, aprobación)   | Interna                                                       | La aprobación guarda el identificador de la persona                                                                               |
| Auditoría (criterios, alcance, fechas, equipo) | Interna / confidencial                                        | El equipo son identificadores de persona                                                                                          |
| Fila de lista y resultado                      | Confidencial                                                  | Nota de evidencia es texto libre                                                                                                  |
| Hallazgo                                       | **Confidencial**; puede traer datos personales en texto libre | Aviso en pantalla                                                                                                                 |
| Informe emitido (copia congelada)              | **Confidencial, inmutable**                                   | Puede contener datos personales de un texto libre sin vía de rectificación (decisión del asesor legal, ADR 028; **insumo nuevo**) |

Solo datos de prueba hasta que el asesor legal valide el ADR 028.

## 6. Impacto multiempresa

- Todo dato de negocio lleva `empresa_id` y está aislado por empresa en la base; **cada tabla nueva trae su prueba de aislamiento** (intentar leer o cambiar datos de otra empresa **debe fallar**).
- Un proceso, programa, auditoría o hallazgo de otra empresa responde **404 indistinguible** de uno inexistente.
- La lista de verificación solo se genera sobre las **normas adoptadas por esa empresa**.
- Una persona con varias empresas (M6b) ve en cada empresa **solo lo que su rol en esa empresa permite**.

## 7. Impacto en bitácora

Toda creación, cambio, aprobación, cancelación, anulación y cierre queda en la bitácora inmutable, en la misma transacción, con **objetos de forma exacta y sin texto libre** (nunca nombres, descripciones, notas ni evidencias): `proceso.*`, `relacion.*`, `programa.*` (incluida la aprobación), `auditoria.*` (planificada, reprogramada, cancelada, iniciada, informe emitido, cerrada), `equipo.*` (designación y excepción de independencia con su marca), `lista.generada` (conteos), `item.evaluado` (solo el resultado) y `hallazgo.*`. La descarga o exportación del informe queda registrada con su huella **antes** de entregarse.

## 8. Impacto de IA

Ninguno en este módulo. El apoyo del asistente (resumir hallazgos, proponer redacción) queda para el módulo de IA y, cuando exista, todo lo generado se marcará «borrador generado por IA» y lo decide una persona.

## 9. Fuera de alcance

- **Auditorías externas** (Etapa 1, Etapa 2, seguimiento, recertificación) y el **organismo certificador**: módulo «Certificación y mantenimiento».
- **Tratamiento de las NC** (causa raíz, acciones, verificación de eficacia, plazos de cierre): módulo «No conformidades y acciones correctivas».
- **Auditor externo** con acceso de solo lectura limitado en el tiempo y **roles múltiples por persona** (M3): después.
- Evaluación de competencia del auditor, muestreo, entrevistas con registro, y **recordatorios o alertas** de fechas (requieren el _worker_).
- Vincular la fila con **evidencias** concretas (M4), plantillas propias de listas por proceso y listas para **9001 y 42001** más allá de lo que la empresa adoptó.
- Firma electrónica, PDF, calendario con invitaciones y **asistente de IA**.
- **Persona–proceso** más allá de las cuatro relaciones y de la dueña (matriz RACI, horarios, sedes).

## 10. Preguntas abiertas (propuesta por omisión)

1. **¿Se introduce «Proceso» como entidad mínima?** _(Decisión de producto.)_ La independencia por proceso lo exige y el modelo de dominio ya lo prevé. **Por omisión: sí**, mínimo (código, nombre, dueña, retiro) y solo para auditoría.
2. **¿La repetición del mismo proceso por el mismo auditor es bloqueo o aviso?** El modelo de dominio la menciona como regla. **Por omisión: aviso** (12 meses), porque en una empresa pequeña puede ser inevitable; el bloqueo es solo por relación con el proceso.
3. **¿Se permite la excepción de independencia con motivo?** **Por omisión: sí**, visible en el informe y la bitácora.
4. **¿«Conformidad» es un resultado de la fila o también un hallazgo?** **Por omisión: solo resultado** de la fila; hallazgo = NC mayor, NC menor, observación u oportunidad.
5. **¿Qué es «auditoría interna completada» para el prerrequisito de la Etapa 2?** **Por omisión:** una auditoría **cerrada** con informe, cuyo alcance incluye al menos las **cláusulas 4 a 10** de la norma. Confirmar con tu NTE.
6. **¿El programa se aprueba una vez al año o por cambio?** **Por omisión:** una vez, y los cambios posteriores dejan motivo.

## 11. Ajustes tras la validación de `experto-iso`

Validación del 2026-11-19 (4 ajustes bloqueantes, 6 recomendados y 4 opcionales). **Prevalecen sobre el texto de arriba.**

1. **Prerrequisito de la Etapa 2 (H6.4, pregunta 5).** «Al menos una cerrada» no basta. Se cumple cuando existe **al menos una auditoría interna cerrada con informe** y las auditorías cerradas del programa vigente cubren **todas las cláusulas 4 a 10** de cada norma elegida, **todos los procesos del alcance** y los **controles aplicables según la Declaración de Aplicabilidad aprobada**; lo aplicable que no se cubrió aparece como **brecha visible**. Este módulo calcula y muestra el dato; no decide la etapa.
2. **Cobertura real.** Las filas «no verificado» y las «no aplica» sin justificación **no cuentan como cubiertas**, ni en el informe ni en el prerrequisito (si no, se llegaría a la Etapa 2 con una lista casi sin verificar).
3. **Independencia (H3.2).** Se ofrece el proceso transversal **«Gestión del SIG»** (alta con un botón; el administrador lo crea): se incluye solo en el alcance de toda auditoría que cubra cláusulas 4 a 10. Quien lo **diseña, opera o aprueba** no puede auditar esos requisitos transversales; es el caso común de la empresa pequeña, donde el administrador SIG arma el sistema. La **repetición** del mismo auditor sobre el mismo proceso es **solo un aviso** (buena práctica: pierde frescura, no independencia); se corrige la regla 9 del modelo de dominio.
4. **Excepción de independencia (H3.3, pregunta 3).** Exige **motivo y una medida compensatoria** (por ejemplo, que otra persona revise el informe). Ambos constan en la auditoría, en el informe y en la bitácora (esta última solo con la marca, no el texto). La excepción **nunca** deja a la persona auditada como única responsable de la evidencia de su propio proceso. Contratar a una persona externa para esa auditoría es la salida habitual y queda como límite documentado (fuera de alcance).
5. **No conformidad (H5.2, H5.3, regla 3).** Campos obligatorios: **requisito incumplido** (entrada de la norma), **evidencia objetiva** y **enunciado** de la NC; si es **mayor**, además la **justificación de la gravedad** por el auditor líder. La **observación** (riesgo de incumplimiento futuro) y la **oportunidad de mejora** no son incumplimientos y no se tratan como NC; la guía de pantalla lo dice para que la observación no se use como «NC menor suave».
6. **Programa (H2).** Cada proceso lleva **importancia** (alta, media, baja) y **frecuencia prevista**. Al aprobar, cada proceso o capítulo que **no entra en el año** lleva un **motivo** (por ejemplo «auditado el año pasado sin hallazgos»). El administrador puede marcar **cambios relevantes** de un proceso (cambió, hubo un incidente) como ayuda; con los hallazgos abiertos y la última auditoría forman los criterios visibles del programa. La cobertura se ve **del año** y **en 12 meses móviles**.
7. **Orden con la revisión por la dirección.** El informe cerrado es **insumo** de la revisión por la dirección, que viene después. La cláusula **9.3** puede quedar «no verificada» con nota hasta que esa revisión exista, **sin bloquear** la auditoría ni el cierre; se cubre luego con una auditoría complementaria.
8. **Informe (H6.2).** Se añaden la **conclusión del auditor líder** (si el sistema es conforme y eficaz frente a los criterios, en palabras propias), las **limitaciones** (qué no se verificó y por qué), la **referencia al programa** y un resumen de lo conforme.
9. **Reuniones y fechas (H3.1, H3.4, regla 9).** La fecha de la **reunión de apertura** es obligatoria para pasar a «en ejecución» y la de **cierre** para emitir el informe. No se pasa a «en ejecución» antes de la fecha de inicio. Una auditoría **cancelada no se reabre**.
10. **Auditoría combinada (H3.1).** Evaluar **una sola vez** los requisitos comunes de 4 a 10 con el criterio de cada norma visible queda como **mejora posterior** si la librería no trae el mapeo común (propuesta: en esta primera versión hay una fila por entrada de cada norma).
11. **Conservación.** Programa, informes y registros se conservan según la **política de retención del control documental** (que hoy solo **marca** elegibles; sin borrado).

**Decisiones tuyas (producto), con propuesta ya incluida en los ajustes:** preguntas 1 a 4 y 6 de la sección 10 (sí a «Proceso» mínimo; repetición solo aviso; excepción con medida compensatoria; «conforme» solo como resultado de fila; programa aprobado una vez, con motivos en los cambios). La pregunta 5 es de dominio ISO y se resolvió con el ajuste 1; confírmala con tu NTE.
