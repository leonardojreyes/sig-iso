# Spec — Gestión de riesgos completa

- **Estado:** **Aprobado con la propuesta por omisión (Q1–Q9) y con los 13 ajustes del plan** (`plan.md`, sección «Ajustes al spec»), que **prevalecen** sobre el texto de abajo donde se contradigan (2026-11-18): decisión «aceptar» pasa a «retener»; «transferir» siempre tiene residual; «evitar» exige la acción hecha; residual esperado/confirmado; tope contra el análisis vigente; vigencia de la aceptación ampliada; sin nivel de aceptación no se acepta; excepción con constancia y vencimiento; el plan se devuelve a borrador solo por cambios de contenido; copia congelada sin texto libre; resumen ampliado; datos del §5 ampliados.
- **Ruta:** Etapa A de `docs/producto/hoja-de-ruta.md`, segundo módulo («Gestión de riesgos completa»: activos de información, evaluación, plan de tratamiento y riesgo residual). Extiende el registro mínimo de la «Declaración justificada» (ADR 037, spec `docs/specs/declaracion-justificada/`, hecho el 2026-11-18) y quita de sus «fuera de alcance» el riesgo residual, su aceptación y los activos.
- **Depende de:** la Declaración justificada (riesgos, vínculos riesgo–control, motivos derivados, versión congelada y Word) y de los controles de la empresa (M3).
- **Fecha:** 2026-11-18
- **Para confirmar con tu ejemplar de la NTE INEN-ISO/IEC 27001:2023** (cláusulas 6.1.2, 6.1.3, 8.2 y 8.3): qué debe conservar la empresa como información documentada del análisis, del plan de tratamiento y de la aceptación del riesgo residual; quién debe aprobar el plan y aceptar el residual; y los términos exactos de las opciones de tratamiento. El spec no copia texto de la norma y se ajusta a lo que confirmes.

## 1. Problema

Hoy el producto tiene un registro **simplificado** de riesgos: una probabilidad, un impacto, un nivel inicial y una decisión de tratamiento. Un auditor de la 27001 espera además una gestión **completa y repetible**, y la Declaración exportada lo dice con avisos fijos porque falta:

- un **inventario de activos de información** al que se ligan los riesgos (qué se protege y quién responde por ello);
- una **evaluación** con criterios propios de la empresa, no solo la escala por omisión de la herramienta, y con **historia** (cuándo se evaluó y se revisó);
- un **plan de tratamiento** con acciones, responsables, fechas y estado;
- el **riesgo residual** (lo que queda tras tratar) y su **aceptación formal** por quien responde del riesgo, con fecha y quién.

Sin esto la empresa guarda esos documentos fuera del sistema y la Declaración no puede decir con respaldo qué riesgo queda y quién lo aceptó. Esta funcionalidad lo incorpora **sin que el producto decida nada por la empresa**: todo lo escribe y lo acepta una persona.

## 2. Usuarios y roles

| Rol                                                 | Qué hace                                                                                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Administrador SIG de la empresa                     | Mantiene activos, criterios, evaluaciones, planes y acciones; **registra la aceptación** del riesgo residual (Q4); aprueba la Declaración        |
| Colaborador de la empresa                           | **Consulta todo** lo anterior. Si es responsable de una acción de tratamiento, **edita solo el estado de sus acciones** (Q5); no cambia nada más |
| Otros roles, o persona sin cuenta o de otra empresa | No ven nada de esto (sin permisos hasta que se definan los demás roles, como hoy)                                                                |

## 3. Historias y criterios de aceptación

### H1 — Inventario de activos de información

- **H1.1** El administrador puede **crear un activo** con: nombre, descripción breve, **tipo** (lista cerrada propia: información, aplicación o sistema, infraestructura, persona, servicio de terceros, instalación), **clasificación** (lista cerrada propia: pública, interna, confidencial, restringida) y un **responsable** (persona de la empresa, obligatorio). El activo recibe un **código correlativo** de la empresa (por ejemplo «A-001»), que no se repite.
- **H1.2** Puedo **cambiar** un activo y **retirarlo** (no se borra: conserva su historia y deja de contarse como vigente). **Antes de confirmar el retiro**, la pantalla dice qué riesgos vigentes quedarían **sin ningún activo**.
- **H1.3** Puedo **ligar** un riesgo a uno o más activos y quitar la liga. Al mirar un riesgo veo sus activos; al mirar un activo, sus riesgos y su nivel más alto.
- **H1.4** No puedo ligar un activo retirado ni uno de otra empresa.
- **H1.5** La lista de activos admite filtrar por tipo, clasificación y responsable, y señala los que **no tienen ningún riesgo ligado** (aviso, no error).
- **H1.6** La pantalla avisa que los textos **no deben llevar datos personales ni texto de las normas**. El colaborador solo consulta.

### H2 — Criterios de evaluación de la empresa

- **H2.1** El administrador registra **una sola vez por empresa** sus **criterios de evaluación**: una descripción propia, en sus palabras, de qué significa cada valor de probabilidad (1 a 5) y de impacto (1 a 5), y el **nivel de aceptación** (hasta qué nivel de riesgo residual puede aceptarlo su responsable sin escalarlo, Q3).
- **H2.2** Mientras no estén registrados, rige la **escala por omisión** de la herramienta (ADR 037) y toda pantalla y documento lo dicen («criterios por omisión de la herramienta, no los de la empresa»).
- **H2.3** Cada cambio de criterios crea una **versión** con fecha y autor; las evaluaciones guardan **con qué versión de criterios** se hicieron, de modo que una evaluación antigua se lee como era.
- **H2.4** La **matriz de riesgo** (probabilidad contra impacto) se muestra con **palabras y números en cada celda**, no solo con color, y cuenta los riesgos vigentes por celda.

### H3 — Evaluación del riesgo y revaluación

- **H3.1** Un riesgo lleva un **escenario** breve y obligatorio (qué puede pasar y con qué consecuencia, en palabras de la empresa) y un **responsable del riesgo** obligatorio (persona de la empresa, el «dueño»). Tiene un **análisis inicial** (probabilidad e impacto de 1 a 5; el nivel se calcula, como hoy) y puede tener **revaluaciones** con fecha, autor, una nota breve y un **motivo** de lista cerrada (periódica, cambio significativo, incidente, tras el tratamiento). La evaluación vigente es la última. Una **revisión sin cambio de nivel** también se registra (quién revisó y cuándo).
- **H3.2** Cada riesgo lleva una **fecha de próxima revisión** (por omisión, un año desde la última revisión; la empresa puede cambiarla). La lista marca los riesgos **con la revisión vencida** y los que **vencen en 30 días**. Una revaluación por **cambio significativo o incidente** puede registrarse en cualquier momento y reinicia la fecha.
- **H3.3** El historial de evaluaciones de un riesgo es **de solo lectura**: se agrega una revaluación, no se edita la anterior.
- **H3.4** Los riesgos creados con la entrega anterior (probabilidad e impacto sueltos) se **conservan** y pasan a ser su evaluación inicial, con los criterios por omisión. **Ninguna versión de la Declaración ya aprobada cambia.**

### H4 — Plan de tratamiento

- **H4.1** Para un riesgo con decisión «mitigar», «transferir» o «evitar» el administrador puede registrar **acciones de tratamiento**: descripción breve, **tipo** (control nuevo, mejora de un control existente, transferencia o seguro, eliminación de la actividad, otra), **responsable** (persona de la empresa), **fecha objetivo**, **estado** (pendiente, en curso, hecha, cancelada) y, opcionalmente, el **control de la empresa** que la acción implanta (el mismo vínculo de H2 de la entrega anterior).
- **H4.2** El colaborador **responsable de una acción** puede cambiar **solo su estado** y dejar una nota (Q5). Sigue **consultando** todas las demás acciones y planes, sin poder cambiarlos.
- **H4.3** Una acción con fecha objetivo pasada y estado «pendiente» o «en curso» se muestra **vencida**, con palabras. La lista de acciones filtra por responsable, estado y vencidas.
- **H4.4** Al pasar una acción a «hecha» se registra la **fecha real** y, si tiene control vinculado, el producto **avisa** si ese control aún no figura como implementado (no lo cambia por su cuenta).
- **H4.5** Un riesgo con decisión «mitigar» y sin acciones se señala en la lista (continúa el aviso de la entrega anterior).
- **H4.6** El **plan de tratamiento** de un riesgo es el conjunto de sus acciones. La **referencia al plan** de la Declaración (entrega anterior) sigue siendo **opcional**: se puede seguir nombrando un documento externo, pero ya no hace falta para decir qué se hará.
- **H4.7** El **plan de cada riesgo** tiene su propio estado: **borrador** o **aprobado por el responsable del riesgo**. Aprobarlo registra tres datos separados: el **responsable** que lo aprueba, la persona que lo **registra** y **cómo se constató** su conformidad (acta, correo, reunión u otro, con referencia y fecha). Si el responsable y quien registra son la misma persona, se indica. Cambiar las acciones de un plan aprobado lo devuelve a **borrador**. Es **distinto** de la aceptación del riesgo residual (H5).
- **H4.8** Una acción «hecha» admite registrar la **verificación de su eficacia** (fecha y nota breve de qué se comprobó). La falta de verificación se muestra, sin bloquear.

### H5 — Riesgo residual y su aceptación

- **H5.1** Tras tratar, el administrador registra la **evaluación residual** del riesgo: probabilidad e impacto residuales (1 a 5), con fecha, autor y nota. **No pueden superar** a los de la evaluación inicial en ninguno de los dos ejes. El nivel residual se calcula igual que el inicial.
- **H5.2** El residual depende de la decisión de tratamiento:

  | Decisión   | Residual                                                                                              | Estado de aceptación |
  | ---------- | ----------------------------------------------------------------------------------------------------- | -------------------- |
  | Aceptar    | es el inicial, sin acciones; no se escribe otro                                                       | se acepta (H5.3)     |
  | Mitigar    | lo escribe una persona tras tratar (H5.1)                                                             | se acepta (H5.3)     |
  | Transferir | lo escribe una persona: lo que queda tras transferir (si queda algo)                                  | se acepta (H5.3)     |
  | Evitar     | **no hay residual** (se elimina la actividad); se registra la fecha y la nota de por qué ya no aplica | **no requiere**      |

- **H5.3** La **aceptación del riesgo residual** la registra una persona con el permiso correspondiente (Q4) y guarda **tres datos separados**: el **responsable del riesgo** que acepta, la persona que **registra** y **cómo se constató** la aceptación (acta, correo, reunión u otro, con referencia y fecha); más el **nivel residual aceptado** y una **nota de justificación obligatoria**. Si el responsable y quien registra son la misma persona, se indica. Una aceptación se **conserva** aunque después cambie el riesgo, pero deja de ser **vigente** si cambia la evaluación residual del riesgo o el **nivel de aceptación** de la empresa (H2.1); un cambio solo de textos o descripciones de los criterios **no** la invalida. Entonces hay que aceptarla de nuevo.
- **H5.4** Si el nivel residual **supera el nivel de aceptación** de la empresa (H2.1), el riesgo **no puede aceptarse** como de rutina: debe volver a tratarse (nuevas acciones o decisión «evitar» o «transferir») o registrarse una **aceptación excepcional**, que exige nombrar a la **persona de la alta dirección que la autoriza** (de la empresa), además de los datos de H5.3 y una justificación. Se marca **«excepcional»** de forma visible en la lista, en el detalle y en el Word (Q3).
- **H5.5** La lista y el detalle muestran para cada riesgo: nivel inicial, nivel residual, estado de aceptación (**sin evaluar** el residual, **sin aceptar**, **aceptado vigente**, **aceptación vencida por cambios**, **excepcional**, **no requiere**) y fecha de la próxima revisión.
- **H5.6** El colaborador ve el estado de aceptación, pero no puede registrarla.

### H6 — La Declaración y el Word con la gestión completa

- **H6.1** El resumen de la Declaración suma: riesgos vigentes **sin aceptación vigente** del residual, planes **no aprobados por su responsable** y acciones de tratamiento **vencidas**. Son **advertencias** (no bloquean la aprobación; Q6: aprobar la Declaración no es aceptar el riesgo), pero el Word las rotula como **pendientes antes de la auditoría de certificación** mientras existan.
- **H6.2** Al aprobar la Declaración, la versión **congela**, además de lo actual: la evaluación inicial y la residual de cada riesgo vigente, el estado de aceptación (quién y cuándo), el resumen del plan de tratamiento (conteo de acciones por estado), los **activos ligados** (código, nombre y clasificación) y **los criterios de evaluación** usados con su versión. Cambios posteriores no alteran una versión ya aprobada.
- **H6.3** El Word incorpora en «Tratamiento de riesgos»: activos ligados, nivel inicial y **residual**, estado de **aceptación**, resumen del plan y los **criterios** usados (o la indicación de que son los de la herramienta). Un riesgo cuya aceptación no esté vigente se marca como tal.
- **H6.4** Los **avisos fijos** del documento se **ajustan**: dejan de decir que no registra riesgo residual, su aceptación ni activos **cuando existen**; siguen diciendo, en toda versión, lo que aún falta (controles adicionales, responsable por control, que no hay riesgos de proceso ni oportunidades) y que el producto no decide por la empresa. Las versiones aprobadas **antes** conservan sus avisos y lo dicen.
- **H6.6** El módulo expone un **resumen consultable** (riesgos sin aceptación vigente, aceptaciones excepcionales, planes sin aprobar, acciones vencidas y revisiones vencidas) para que la **Revisión por la dirección** lo use como entrada. Esa pantalla no se construye aquí.
- **H6.5** Los textos de la empresa se escriben en el Word como **texto plano**, igual que en la entrega anterior.

## 4. Reglas de negocio

1. Los riesgos, activos, criterios, evaluaciones, acciones y aceptaciones son **de la empresa**. Llegan a la Declaración por los controles y vínculos que ya existen.
2. **El producto no inventa ni decide:** niveles, residual, acciones y aceptaciones los escribe una persona. El producto solo calcula el nivel, avisa y congela.
3. **Nivel** = probabilidad × impacto con los **cortes fijos** de la herramienta (bajo 1 a 4, medio 5 a 9, alto 10 a 15, crítico 16 a 25), impresos y congelados como hoy. Lo que la empresa configura es el **nivel de aceptación** y la **descripción de cada valor** (Q3).
4. Residual ≤ inicial en cada eje (H5.1). Una acción cancelada no cuenta como tratamiento.
5. Una aceptación solo es **vigente** mientras coincidan el análisis vigente, la evaluación residual (o el análisis, si la decisión es «retener»), la decisión de tratamiento, el responsable y el **nivel de aceptación** con los que se aceptó (H5.3; ajuste 5 del plan). Un cambio solo de descripciones de criterios no la invalida.
6. Un activo, riesgo, acción o control **retirado** no cuenta como vigente; su historia se conserva (no se borra nada).
7. Aprobar sigue siendo **solo del administrador SIG**; las nuevas condiciones son advertencias (Q6). La derivación del motivo «riesgo» (entrega anterior) **no cambia**.
8. La empresa **nunca** viaja en un dato que envía el cliente: sale de la sesión.
9. Una persona responsable (de un activo, riesgo o acción) debe ser **de la empresa de la sesión**; si luego deja la empresa, el dato se conserva y se muestra como «persona dada de baja».
10. Términos: «análisis» es calcular el nivel (probabilidad e impacto); «evaluación» es compararlo con el criterio de aceptación de la empresa. «Mitigar, aceptar, transferir, evitar» equivalen a lo que la norma llama modificar, **retener**, compartir y evitar el riesgo (glosario y textos de pantalla). «Aceptación» es **solo** la del riesgo residual; la conformidad del responsable con el plan se llama **aprobación del plan** (H4.7).

## 5. Datos y clasificación

| Dato                                                                | Clasificación                             | Retención                                                                                                   |
| ------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Activo: código, nombre, descripción, tipo, clasificación            | **Confidencial de la empresa**            | Mientras exista la empresa; los retirados se conservan (hipótesis a confirmar con el asesor legal, ADR 028) |
| Criterios de evaluación y sus versiones                             | Confidencial de la empresa                | Todas las versiones, porque respaldan evaluaciones y versiones aprobadas                                    |
| Evaluaciones inicial, residual y revaluaciones, con su nota         | Confidencial de la empresa                | Se conservan todas (historial)                                                                              |
| Acciones de tratamiento: descripción, tipo, fecha, estado, nota     | Confidencial de la empresa                | Se conservan; las canceladas también                                                                        |
| Aceptación del residual: quién, fecha, nivel, nota de justificación | Confidencial de la empresa; **evidencia** | Se conserva todo, aunque deje de ser vigente                                                                |
| Responsables y autores (identificador opaco de la persona)          | Personal (seudonimizado)                  | Igual que los demás identificadores de personas                                                             |
| Copia congelada en una versión aprobada (todo lo de H6.2)           | Confidencial de la empresa, **inmutable** | Igual que la versión aprobada; conserva el reparo del ADR 028 (insumo 12): sin vía de supresión a la fecha  |

Los textos libres (descripciones, notas, justificaciones) pueden traer datos personales por descuido: la pantalla lo advierte y no se envían a ningún asistente de IA ni a la bitácora. Siguen siendo **solo datos de prueba** hasta que el asesor legal valide el ADR 028.

## 6. Impacto multiempresa

- Todo lo nuevo pertenece a **una empresa**; ninguna persona ve ni cambia lo de otra.
- Cada pieza trae su **prueba de aislamiento**: con la sesión de la empresa A se intenta leer, ligar, evaluar, aceptar y cambiar activos, criterios, acciones y aceptaciones de B, y debe fallar. Un riesgo de A **no** se liga a un activo de B ni se le asigna a una persona de B.
- Los criterios son **por empresa**; no hay criterios globales que una empresa pueda ver de otra.

## 7. Impacto en bitácora

Cada creación, cambio, retiro, liga, revaluación, acción, cambio de estado, cambio de criterios y **aceptación** deja un hecho **en la misma operación**: **qué** pasó, **quién** y **sobre qué objeto** (códigos: activo `A-001`, riesgo `R-001`, acción `R-001.T1`). La aceptación registra además el **nivel residual aceptado** (valor cerrado), nunca la nota. **Nunca** se escribe en la bitácora ningún nombre, descripción, nota ni justificación. La aprobación de la Declaración suma solo **conteos** (riesgos aceptados, sin aceptación vigente, acciones vencidas).

## 8. Impacto de IA

Ninguno. No se usa asistente ni se generan textos con IA. Una ayuda futura que proponga activos, riesgos o acciones tendría que marcarlos «borrador generado por IA» y exigir que una persona los acepte; queda fuera de este spec.

## 9. Fuera de alcance

- **Riesgos secundarios** (los que nacen de un control o una acción de tratamiento) como vínculo propio: se registran como un riesgo más; la herramienta no los relaciona con la acción y el Word lo declara.
- **Riesgos de proceso, oportunidades** (6.1.1) y riesgos de los sistemas de IA (ISO/IEC 42001, etapa B).
- **Controles adicionales** (sin equivalente en el Anexo A) como filas propias de la Declaración, y **responsable por control**: siguen pendientes; el documento lo dice.
- Cortes del nivel configurables, matrices de otro tamaño, valoración cuantitativa o por activos (confidencialidad, integridad, disponibilidad) y **apetito de riesgo** más fino que un nivel de aceptación.
- Importar activos o riesgos desde una hoja de cálculo; biblioteca de amenazas y vulnerabilidades; cálculo automático de riesgos a partir de los activos.
- Subir el plan como archivo, firma electrónica y flujo de aprobación con varios pasos.
- Notificaciones por correo (los vencimientos se **muestran**, no se envían; las alertas son del módulo de Revisión por la dirección y del calendario).
- Comparar versiones de la Declaración; que el producto decida si un control debe aplicar.

## 10. Preguntas abiertas (propuesta por omisión)

| #   | Pregunta                                                                    | Propuesta por omisión                                                                                                                                                                                                                                                                                                            |
| --- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | ¿Cuánto del activo entra: lista cerrada de tipos y clasificación?           | **Sí**, listas cerradas propias de la herramienta (H1.1), sin valoración por confidencialidad, integridad y disponibilidad. Se amplía después.                                                                                                                                                                                   |
| Q2  | ¿Un riesgo puede existir sin activo?                                        | **Sí**: no es obligatorio ligarlo (hay riesgos organizativos); la lista avisa los que no tienen activo.                                                                                                                                                                                                                          |
| Q3  | ¿Qué configura la empresa y qué pasa si el residual supera su nivel?        | Configura la **descripción de cada valor** y el **nivel de aceptación**; los cortes siguen fijos. Si lo supera, no se acepta de rutina: se vuelve a tratar o se registra una **aceptación excepcional** autorizada por una persona nombrada de la alta dirección (H5.4).                                                         |
| Q4  | ¿Quién registra la aceptación del residual y la aprobación del plan?        | El **administrador SIG**, a nombre del responsable del riesgo, con permiso propio (`riesgos.aceptar`), **dejando constancia de cómo se obtuvo la conformidad** (H4.7, H5.3). Un auditor debe poder distinguir al responsable de quien registra. Todavía no hay un rol de «dueño del riesgo»; se evalúa cuando existan más roles. |
| Q5  | ¿Puede el colaborador cambiar el estado de sus acciones?                    | **Sí**, solo las acciones donde es responsable y solo el estado y una nota (permiso propio). Lo demás es solo consulta.                                                                                                                                                                                                          |
| Q6  | ¿Faltar la aceptación del residual bloquea la aprobación de la Declaración? | **No: advierte** y el documento lo declara. Las empresas empiezan por la Declaración; bloquear obligaría a cerrar toda la gestión de riesgos antes de aprobar. Si estorba o el auditor lo exige, pasa a bloqueo (nuevo ADR).                                                                                                     |
| Q7  | ¿Qué pasa con los riesgos de la entrega anterior?                           | Se **conservan** como evaluación inicial con los criterios por omisión (H3.4). Su residual queda «sin evaluar».                                                                                                                                                                                                                  |
| Q8  | ¿Periodicidad de la revisión?                                               | **Un año** por omisión, editable por riesgo.                                                                                                                                                                                                                                                                                     |
| Q9  | ¿La acción de tratamiento puede vincularse a un control que aún no existe?  | **No**: se vincula a un control **de la empresa**; para un control que aún no existe se describe la acción y se crea el control después (como hoy).                                                                                                                                                                              |
