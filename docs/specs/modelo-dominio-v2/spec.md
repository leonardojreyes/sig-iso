# Spec — Modelo de dominio v2 y esquema de librerías v3

- **Estado:** Aprobado por el responsable el 2026-11-09 (validado por `experto-iso`; Q1 a Q10 con la propuesta por omisión)
- **Origen:** hallazgos A2, M3 y M4 de la revisión de calidad del 2026-11-08 (`docs/revisiones/2026-11-08-revision-calidad-fase0.md`); prerrequisito de la Fase 1 (ruta MVP, ADR 031).
- **Fecha:** 2026-11-09

## 1. Problema

El producto prometió «normas como datos» y gestionar el ciclo completo de certificación, pero el modelo actual tiene tres límites que impiden llegar al valor principal:

1. **No cabe el Anexo A.** Las librerías de normas solo admiten cláusulas del 4 al 10, en dos niveles. Los controles del Anexo A de ISO/IEC 27001:2022 (agrupados en cuatro temas) y del Anexo A de ISO/IEC 42001:2023 (agrupados en objetivos de control) no se pueden cargar, y sin ellos no hay Declaración de Aplicabilidad.
2. **Una persona, un rol.** En la práctica una persona es a la vez dueña de un proceso y auditora interna, y la norma exige que quien audita sea **objetivo e imparcial**: no puede auditar su propio trabajo. Además, quien audita desde fuera debe tener un acceso **limitado en el tiempo**.
3. **Faltan cosas de la certificación real:** el certificado, el alcance con sus sedes y exclusiones justificadas, el inventario de activos de información, la evaluación de impacto de los sistemas de IA, otros orígenes de las no conformidades y la clasificación de los hallazgos externos con sus plazos.

Este spec define **qué** debe poder representar el modelo y marca, entidad por entidad, si el MVP lo necesita («MVP») o puede esperar («después»), para no construir de más. No define pantallas ni procesos de negocio completos: esos son de los specs de cada módulo.

## 2. Usuarios y roles

| Rol                               | Qué le aporta este cambio                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Administrador SIG de una empresa  | Cargar y adoptar librerías con Anexo A; definir el alcance; (después) asignar varios roles a una persona |
| Colaborador de una empresa        | Ver los controles y requisitos de las librerías adoptadas                                                |
| Auditor interno y auditor externo | (Después) trabajar con independencia verificable y, el externo, con acceso temporal                      |
| Plataforma (SynapTech)            | Publicar librerías nuevas y versiones                                                                    |

## 3. Historias y criterios de aceptación

### A2 — Librerías que admiten el Anexo A (MVP)

- **H1** Una librería puede contener entradas de **tres tipos**: **cláusula**, **control** y **agrupador**. Un agrupador es lo que reúne a otras entradas y lleva un **subtipo**: *tema* (los cuatro de 27001:2022), *objetivo de control* (los de 42001:2023) o *capítulo* (el agrupamiento de la Estructura Armonizada). El tipo y el subtipo son obligatorios y visibles en el listado.
- **H2** Una entrada puede tener un **padre**, con profundidad variable (hasta cuatro niveles; hay subapartados de tres y cuatro niveles en las cláusulas y el Anexo A necesita dos o tres). Un control de 27001 cuelga de su tema; un control de 42001, de su objetivo de control; una cláusula, de su capítulo o de otra cláusula. Una entrada sin padre es de primer nivel.
- **H3** El agrupamiento «capítulo del 4 al 10» deja de ser obligatorio y pasa a ser **un subtipo de agrupador** más. La entrada deja de llevar un capítulo suelto: se agrupa por su padre. Los temas y objetivos de control son agrupadores de una lista cerrada por librería, no texto libre.
- **H4** Cada entrada lleva, además de su identificador estable, título breve y guía propia, el **identificador que usa cada norma** (por ejemplo «A.5.1» en 27001:2022) y a qué norma y edición aplica. La **edición** puede expresar una enmienda (por ejemplo «2022 con Enmienda 1»; el contenido exacto de las enmiendas, por verificar). Si el mismo tema existe en dos normas con identificadores distintos, se declara una **equivalencia** explícita con relación común, parcial o específica, una nota propia, quién la verificó y cuándo; por omisión es **parcial y sin verificar**.
- **H5** Una entrada puede llevar **atributos** opcionales de vocabulario cerrado por norma. Los atributos de la guía de implementación **ISO/IEC 27002:2022** (tipo de control, propiedades de seguridad de la información, conceptos de ciberseguridad, capacidades operativas, dominios de seguridad) no son del Anexo A de 27001 sino de 27002, que 27001 referencia: quedan opcionales y **después** (Q7). El tema de un control **no** es un atributo: es su padre (H2).
- **H6** Se puede cargar una librería de prueba con **controles de Anexo A de ambas normas** y verla en el listado, filtrable por norma, por tipo y por tema u objetivo, sin que ninguna entrada contenga texto de la norma (regla 3: solo identificador, título breve y guía propia).
- **H7** La carga rechaza, con un mensaje claro y sin repetir el texto revisado: un tipo desconocido, un padre inexistente o de otra librería, un ciclo en la jerarquía, un identificador repetido dentro de la misma norma y edición, y cualquier entrada que incumpla las reglas de contenido (guía breve, sin tono normativo, sin citas largas).
- **H8** Las librerías ya cargadas (esquema actual) **siguen funcionando** durante la transición: se pueden consultar y adoptar. La librería de ejemplo se republica en el esquema nuevo como versión posterior, con las mismas entradas y sin cambiar sus identificadores (Q5).
- **H9** Las versiones cargadas siguen siendo inmutables y con huella de contenido; una versión nueva no altera lo que las empresas ya adoptaron.

### M4 — Entidades de la certificación real

- **H10 (MVP) Alcance.** Cada empresa puede definir, **por norma y edición**, el alcance de su sistema: descripción, **sedes**, **interfaces y dependencias** (27001 y 42001) y, en 42001, los **sistemas de IA incluidos** y el **rol de la organización** (por ejemplo, desarrolladora o usuaria de sistemas de IA). El alcance puede registrar **exclusiones solo de requisitos de tipo cláusula que la norma permita no aplicar** (en 9001, del capítulo 8); cada una referencia el requisito y exige una **justificación** escrita, y no puede afectar la conformidad del sistema; sin justificación no se guarda. Las cláusulas 4 a 10 de 27001 y 42001 no se excluyen. **La exclusión de controles del Anexo A no se registra en el alcance: se justifica en la Declaración de Aplicabilidad** (spec del MVP), para que haya una sola fuente de verdad. El alcance se puede cambiar con historial.
- **H11 (después) Certificado.** Número, organismo certificador, norma y edición (con la **fecha límite de transición** a una edición nueva), alcance certificado, **sedes certificadas** (multisitio), **fecha de la decisión de certificación** (de ahí corre el ciclo de tres años), fecha de emisión y de vencimiento, fechas de **seguimiento 1** (a más tardar 12 meses desde la decisión) y **seguimiento 2**, fecha límite de **recertificación**, y estado: vigente, suspendido, **alcance reducido**, **vencido** o retirado. Se **vincula al certificado anterior** (ciclo n) y, en auditorías combinadas, hay un certificado por norma. No existe un certificado sin organismo ni sin alcance. *Limitación:* sin certificado el producto no puede calcular la fecha límite del seguimiento 1.
- **H12 (después) Activo de información.** Inventario por empresa: nombre, tipo, responsable, ubicación, clasificación y relación con los procesos. Base del análisis de riesgos de 27001.
- **H13 (después) Evaluación de impacto de sistemas de IA (42001).** Entidad propia, distinta del riesgo de la empresa: sistema de IA evaluado, fecha, responsable, personas o grupos afectados, impactos, medidas y revisión periódica. El asistente del propio producto es el primer sistema evaluable.
- **H14 (después) Origen de una no conformidad.** Auditoría interna, auditoría externa, indicador, queja, incidente (de seguridad o de IA), revisión por la dirección, riesgo y proveedor externo. Toda no conformidad tiene exactamente un origen.
- **H15 (después) Clasificación, plazos y seguimiento de los hallazgos.** NC mayor, NC menor, observación y oportunidad de mejora, también para los **hallazgos internos**. Cada hallazgo guarda su **etapa de origen** (Etapa 1, Etapa 2, seguimiento, recertificación), el requisito al que se refiere, su estado (abierto, plan propuesto, plan aceptado, verificado, cerrado) y la **fecha límite de cierre que fija el organismo certificador** (el sistema la registra; no impone plazos por omisión). Una NC mayor abierta **condiciona el certificado**. La causa raíz, la corrección, la acción correctiva y la verificación de eficacia pertenecen al módulo de no conformidades.

### M3 — Varios roles por persona (después; antes de las auditorías)

- **H16** Una persona puede tener **varios roles a la vez** en su empresa. Su permiso es la unión de sus roles vigentes.
- **H17** Cada asignación de rol tiene fecha de inicio y, opcionalmente, de fin. Un rol vencido no concede nada. El rol de **auditor externo** exige fecha de fin.
- **H18** Cambiar, asignar o revocar un rol queda en la bitácora con el antes y el después.
- **H19** Se registra la relación **persona–proceso**: dueña del proceso, **participa** (ejecuta actividades del proceso), **diseñó o implementó** el proceso, y **supervisa** a la dueña (jefatura). Se registra también cuándo una persona **auditó su propio trabajo** recientemente (ventana por definir).
- **H20** Una persona **no puede ser asignada como auditora de un proceso con el que tiene una de esas relaciones** (dueña, participa, diseñó o implementó, supervisa) **ni de uno que ella misma auditó recientemente**: el sistema lo rechaza al programar y lo avisa si la relación aparece después. La verificación se hace por auditoría y por proceso, e incluye las auditorías de sistema (por ejemplo, la revisión por la dirección). Cada auditoría registra una **declaración de conflicto de interés**; para un auditor externo, además, no haber prestado consultoría a la empresa en un periodo reciente (periodo por verificar). Una **empresa pequeña** puede, con una **excepción documentada y aprobada por la dirección**, asignar a una persona vinculada, y queda registrada.
- **H21** Una persona sin ningún rol vigente no puede ingresar al producto (como hoy).

### Modelo de dominio y glosario

- **H22** `docs/producto/modelo-dominio.md` se actualiza con las entidades nuevas, marcando cuáles son MVP y cuáles posteriores, y con las relaciones con las entidades existentes.
- **H23** El glosario distingue **control de la norma** (cada entrada de tipo control del Anexo A de una librería: una medida de referencia) de **control de la empresa** (la medida interna que la empresa mantiene, que se mapea con controles y requisitos de la norma y que puede ser **adicional**, de otra fuente y sin equivalente en el Anexo A). La Declaración de Aplicabilidad se arma **por control de la norma** (de 27001 **y** de 42001): si aplica, justificación de inclusión, estado de implementación, justificación de exclusión y enlace a los controles de la empresa. Hoy el glosario usa «control» solo en el segundo sentido y dice que 42001 tiene «su equivalente» de la Declaración: ambos se corrigen.

## 4. Marcas MVP / después

| Cambio                                                                          | Marca                             | Por qué                                                                     |
| ------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| A2: tipos de entrada, jerarquía, identificador por norma, librerías con Anexo A | **MVP**                           | Sin esto no hay Declaración de Aplicabilidad                                |
| A2: atributos de ISO/IEC 27002:2022 referenciados desde 27001 | después | No bloquean el MVP |
| M4: Alcance con sedes y exclusiones                                             | **MVP**                           | El proyecto de certificación y la Declaración de Aplicabilidad lo necesitan |
| M4: Certificado                                                                 | después                           | Es la etapa final del proyecto                                              |
| M4: Activo de información                                                       | después                           | Llega con riesgos (Fase 2)                                                  |
| M4: Evaluación de impacto de IA                                                 | después                           | Gobierno de IA (Fase 4)                                                     |
| M4: Origen de la no conformidad, clasificación y plazos de hallazgos            | después                           | Auditorías y certificación externa (Fases 3 y 4)                            |
| M3: varios roles con vigencia y persona–proceso | después (**antes de la primera auditoría interna**) | El MVP funciona con los roles actuales; la auditoría interna es prerrequisito de la Etapa 2 (Q1) |

## 5. Reglas de negocio

1. Una entrada de librería es **solo de referencia**: identificador, título breve, guía propia, tipo, jerarquía y atributos. **Nunca** el texto de la norma.
2. El identificador de una entrada es único dentro de su norma y edición. Un mismo tema puede tener identificadores distintos en normas distintas; esa equivalencia es explícita y declara su alcance (común, parcial, específico).
3. Cada entrada, sea cláusula, control o agrupador, pertenece a una sola jerarquía por norma; un ciclo en la jerarquía es inválido.
4. Las librerías son **globales y de solo lectura** para las empresas (como hoy); cada empresa **adopta** las que usa.
5. El alcance solo excluye requisitos de tipo cláusula que la norma permita no aplicar, con justificación y sin afectar la conformidad; las exclusiones de controles del Anexo A viven en la Declaración de Aplicabilidad.
6. Una asignación de rol vencida no concede permisos; una persona sin roles vigentes no accede.
7. La independencia del auditor se evalúa **por proceso auditado**.
8. Toda creación, cambio, aprobación y eliminación de lo anterior queda en la bitácora inmutable (P15).

## 6. Datos y clasificación

Las bases de tratamiento y los plazos son hipótesis a confirmar por un asesor legal (ADR 028).

| Dato                                                                                          | Clasificación                                                                |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Librerías con Anexo A (id, título breve, guía propia, jerarquía)                              | Público de SynapTech                                                         |
| Alcance, sedes, exclusiones, activos de información, evaluación de impacto de IA, certificado | **Confidencial de la empresa** (primeros datos de este nivel en el producto) |
| Asignación de roles, vigencia, relación persona–proceso                                       | Personal (seudonimizada por identificador opaco)                             |
| Clasificación y plazos de hallazgos                                                           | Confidencial de la empresa                                                   |

## 7. Impacto multiempresa

- Todo lo nuevo que pertenece a una empresa (alcance, sedes, exclusiones, certificado, activos, evaluaciones, roles, relación persona–proceso, orígenes de no conformidad) lleva la empresa y se aísla como el resto de los datos de negocio. Las librerías con Anexo A son globales.
- Debe existir, para cada dato de empresa nuevo, una prueba que intente leer o escribir el de otra empresa y **falle**.
- Una asignación de rol, una exclusión o una relación persona–proceso no pueden referenciar a una persona, un proceso o un requisito de otra empresa.

## 8. Impacto en la bitácora (P15)

Eventos nuevos o ampliados (códigos cerrados, sin texto libre ni datos personales): definición y cambio de alcance (con sus sedes y exclusiones), alta, cambio de estado y retiro de un certificado, asignación y revocación de roles (ampliación del evento actual de cambio de rol, con vigencia), alta y baja de la relación persona–proceso, rechazo por independencia, y la carga de una librería con Anexo A (como las cargas actuales).

## 9. Impacto de IA

Ninguno en el comportamiento del asistente. La evaluación de impacto de sistemas de IA (H13) describe sistemas de IA, entre ellos el asistente del producto, y se completa después; la ficha del asistente (ADR 030 y política de IA) será su primer contenido.

## 10. Impacto en lo existente (insumo del plan)

- **Librerías y catálogo:** el esquema actual y su cargador quedan como **legado** aceptado durante la transición; el esquema nuevo es un superconjunto. La librería de ejemplo se republica (H8).
- **Adopción y listado de requisitos:** hoy muestran capítulo y nivel y filtran por capítulo; pasan a mostrar tipo y agrupar por tema u objetivo.
- **Contrato público de la API y sus tipos generados**, las validaciones y las pruebas de contrato y de listado cambian en consecuencia.
- **Autorización, identidad y sesión:** hoy asumen **un solo rol**; con M3 la identidad y la matriz de permisos pasan a una unión de roles vigentes.
- **Pruebas existentes** que se rompen y hay que migrar: las de la librería de ejemplo, las del validador y del dominio de entradas, las de aislamiento del catálogo, las de la carga del catálogo y la siembra, las de adopción, las de identidad y autorización, y las de pantalla del listado.
- **Siembra y datos de prueba:** las cuentas y empresas de prueba se actualizan al modelo de roles nuevo.
- El detalle por archivo, la migración de datos y el orden de trabajo van en el **plan**.

## 11. Fuera de alcance

- Pantallas y procesos completos de certificado, activos, evaluación de impacto de IA, no conformidades y auditorías (specs de cada módulo).
- El **diagnóstico de brechas**, los **controles y evidencias de la empresa** y la **Declaración de Aplicabilidad**: son del spec del MVP.
- Librerías de otras normas y de **ISO/IEC 27001:2013** (el Anexo A cambió de estructura en 2022; solo se cubre la edición 2022).
- Los atributos de la guía de implementación de 27001 (H5, después).
- Verificar la numeración y los títulos del Anexo A contra los ejemplares: lo hace el responsable (ver riesgos).

## 12. Riesgos

- **Numeración y títulos del Anexo A sin verificar.** Salen de la memoria de `experto-iso`: 27001:2022 con 93 controles en cuatro temas (organizacionales A.5, personas A.6, físicos A.7, tecnológicos A.8); 42001:2023 con nueve objetivos de control (A.2 a A.10) cuyo **total de controles (38) y distribución por grupo están por verificar**. **Deben comprobarse con los ejemplares vigentes**, como la tarea 4.4 del corte 0.6 (`docs/specs/corte-vertical-0-6/verificacion-numeraciones.md`). Una librería con Anexo A queda marcada «borrador, numeraciones sin verificar» hasta entonces.
- **Los títulos de los controles pueden coincidir con el nombre oficial.** Es la misma decisión pendiente del corte 0.6 (Q8): usar títulos propios más breves o los usuales con la aprobación del responsable (Q3). Regla 3.
- **Cambio que rompe pruebas** (esquema de librerías, roles): por eso es un spec propio y se hace por fases en el plan.
- **Equivalencias entre 27001 y 42001.** En las cláusulas 4 a 10 (Estructura Armonizada) la equivalencia es fuerte, con diferencias propias de cada norma (por ejemplo, las exigencias de impacto de 42001, numeración por verificar). En los **controles** solo hay coincidencia **temática parcial** (políticas, terceros, incidentes) y no se conoce una tabla oficial: se declaran como parciales y sin verificar hasta que `experto-iso` y el responsable las confirmen (H4).

## 13. Preguntas abiertas

Cada una trae una propuesta; si no hay objeción, se toma la propuesta.

| #   | Pregunta                                                                    | Propuesta                                                                                                   |
| --- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Q1 | ¿M3 (varios roles, vigencia, persona–proceso) entra al MVP? | No: queda «después», pero **antes de la primera auditoría interna**. El MVP usa los roles actuales. |
| Q2  | ¿El Certificado entra al MVP?                                               | No: «después».                                                                                              |
| Q3  | ¿Títulos de los controles del Anexo A: propios y más breves, o los usuales? | Propios y breves donde se pueda; los usuales solo con tu aprobación expresa (regla 3).                      |
| Q4  | ¿Qué ediciones se cubren?                                                   | Solo 27001:2022 y 42001:2023.                                                                               |
| Q5  | ¿Qué pasa con el esquema actual?                                            | Se acepta como legado mientras dure la transición; la librería de ejemplo se republica en el esquema nuevo. |
| Q6 | ¿Cuántos niveles de profundidad? | Hasta cuatro (hay subapartados de tres y cuatro niveles; el Anexo A necesita dos o tres). |
| Q7 | ¿Entran los atributos de ISO/IEC 27002:2022? | Opcionales y «después». |
| Q8  | ¿Qué relaciones persona–proceso hay?                                        | Dueña del proceso y participa en el proceso.                                                                |
| Q9  | ¿Plazos de cierre de hallazgos?                                             | Los fija el organismo; el sistema registra la fecha límite de cada hallazgo, sin valores por omisión.       |
| Q10 | ¿Fecha de fin obligatoria para el auditor externo?                          | Sí.                                                                                                         |
