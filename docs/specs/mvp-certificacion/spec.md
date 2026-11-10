# Spec — MVP: de las normas a la Declaración de Aplicabilidad

- **Estado:** Borrador (pendiente de `experto-iso` y de revisión del responsable)
- **Ruta:** MVP para uso interno de SynapTech (ADR 031); fases 1 y 2 de `docs/producto/vision.md`.
- **Depende de:** `docs/specs/modelo-dominio-v2/spec.md` (librerías con Anexo A, alcance con sedes y exclusiones).
- **Fecha:** 2026-11-09

## 1. Problema

El producto hoy sabe quién es cada empresa, aislarla y mostrar una librería de ejemplo, pero **no ayuda todavía a prepararse para una certificación**. Una empresa que va por ISO 9001, ISO/IEC 27001 o ISO/IEC 42001 necesita, en orden: saber qué pide cada norma y qué le falta (**diagnóstico**), organizar lo que ya hace (**controles con evidencias** reutilizables entre normas) y declarar qué controles del Anexo A aplica y por qué (**Declaración de Aplicabilidad**), todo dentro de un **proyecto de certificación** con su alcance. Sin esto no hay valor que mostrar a un auditor ni a un cliente.

El MVP cubre ese camino completo, de principio a fin, para que SynapTech lo use primero con su propio sistema de gestión. Lo demás del ciclo (auditorías, no conformidades, riesgos, certificado, seguimiento) queda fuera.

## 2. Usuarios y roles

| Rol                                  | Qué hace en el MVP                                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Administrador SIG de una empresa     | Adopta librerías, crea el proyecto, aprueba el alcance, evalúa, administra controles y evidencias, y **aprueba** la Declaración de Aplicabilidad |
| Colaborador de una empresa           | Consulta; registra y actualiza evidencias y controles que se le asignan; propone evaluaciones del diagnóstico                                    |
| Persona sin cuenta o de otra empresa | No ve nada de la empresa                                                                                                                         |

Los roles múltiples por persona y el auditor son «después». Una persona sigue teniendo un solo rol.

## 3. Historias y criterios de aceptación

### H1 — Adoptar las librerías con Anexo A

_Como administrador SIG, quiero adoptar las librerías de las normas que voy a trabajar para ver lo que cada una pide._

- **H1.1** Existen tres librerías globales: ISO 9001:2015, ISO/IEC 27001:2022 (cláusulas y controles del Anexo A) e ISO/IEC 42001:2023 (cláusulas y controles del Anexo A). Se adoptan una por una; adoptar es un hecho registrado y no se deshace.
- **H1.2** Cada entrada muestra su tipo (cláusula, control o agrupador), su identificador en la norma, título breve y guía propia; se puede filtrar por norma, tipo y agrupador.
- **H1.3** Mientras la numeración de una librería no esté verificada, se indica en cada pantalla que es un **borrador sin verificar** y que la referencia oficial es el ejemplar de la norma de la empresa.
- **H1.4** Ninguna entrada contiene texto de las normas (regla 3).

### H2 — Proyecto de certificación

- **H2.1** Puedo crear un proyecto para una norma o una combinación de las normas adoptadas (nombre, normas y ediciones, responsable) y tengo uno o varios por empresa.
- **H2.2** El proyecto muestra las etapas E0 a E8 del ciclo con su estado. **En el MVP solo funcionan E0 (alcance), E1 (diagnóstico), E3 (Declaración de Aplicabilidad) y E4 (controles y evidencias)**; las demás aparecen indicadas como «no disponible en esta versión», sin acciones.
- **H2.3** Un proyecto solo puede incluir normas que la empresa adoptó.

### H3 — Alcance del proyecto

- **H3.1** Para cada norma y edición del proyecto defino el **alcance** según el spec de dominio v2 (descripción, sedes, interfaces y dependencias y, en 42001, sistemas de IA incluidos y rol de la organización).
- **H3.2** Puedo registrar exclusiones **solo de cláusulas que la norma permite no aplicar**: en ISO 9001, requisitos del capítulo 8 con justificación y sin afectar la conformidad; en ISO/IEC 27001 y 42001 **las cláusulas 4 a 10 no se excluyen** (solo se delimita el alcance). No se guardan sin justificación. La exclusión de controles del Anexo A **no** se registra aquí sino en la Declaración (H8).
- **H3.3** El administrador **aprueba** el alcance: queda una versión con fecha y persona. Cambiarlo después crea una versión nueva y avisa que el diagnóstico y la Declaración vigentes pueden verse afectados.
- **H3.4** **Sin alcance aprobado no se puede crear un diagnóstico ni una Declaración de Aplicabilidad** del proyecto para esa norma.

### H4 — Diagnóstico de brechas

- **H4.1** Puedo crear un **diagnóstico** del proyecto, que es una instantánea fechada: la empresa puede repetirlo más adelante sin perder el anterior.
- **H4.2** El diagnóstico presenta, para cada **cláusula** y cada **control de la norma** del alcance, un estado: cumple, cumple parcialmente, no cumple, no aplica o **sin evaluar**.
- **H4.3** Cada evaluación admite un comentario breve y la referencia a la **evidencia existente** (H6). **«No aplica» exige justificación** y solo se admite: en un **control de la norma** (esa decisión alimenta la Declaración, H8) o en una **cláusula de ISO 9001** excluida de forma justificada en el alcance. En las cláusulas 4 a 10 de 27001 y 42001 no se admite «no aplica». «No aplica» del diagnóstico no es lo mismo que la exclusión de la Declaración, aunque la segunda parte de la primera.
- **H4.4** Veo la **madurez de la autoevaluación** por cláusula, por agrupador y por norma, **siempre junto al desglose de conteos** (cuántas cumplen, parciales, no cumplen, no aplican y sin evaluar); las «sin evaluar» se muestran aparte y no cuentan como cumplidas. Las cláusulas 4 a 10 tienen un **indicador propio** (un «no cumple» ahí es crítico aunque el promedio sea alto). Se rotula «madurez de la autoevaluación»: **no es una probabilidad de certificarse**. La fórmula se fija en el plan (Q3).
- **H4.5** Cada cambio de estado queda registrado con quién, cuándo, el estado anterior y el nuevo.
- **H4.6** Dos personas que editan la misma evaluación a la vez no se pisan: la segunda es avisada y debe revisar.
- **H4.7** La evaluación de un control de la norma en el diagnóstico es el **punto de partida de su fila en la Declaración** (H8): no se evalúa dos veces.
- **H4.8** Una evaluación «no cumple» o «cumple parcialmente» admite un **responsable** y una **fecha objetivo** simples, para que la brecha tenga un destino. El plan de implementación completo (etapa E2) es «después».

### H5 — Controles de la empresa

- **H5.1** Puedo crear, editar y retirar **controles de la empresa**: nombre, descripción breve, responsable (una persona de la empresa) y estado (planificado, implementado, operando, retirado). Un control puede ser **adicional**, sin equivalente en el Anexo A.
- **H5.2** Puedo **mapear** un control a varias cláusulas y controles de la norma, de una o varias normas (muchos a muchos). No puedo mapear a una entrada de una librería que la empresa no adoptó, ni a un control de otra empresa.
- **H5.3** Retirar un control conserva su historia y deja avisadas las entradas de norma que quedan sin cobertura.

### H6 — Evidencias

- **H6.1** A un control puedo asociar **evidencias**: título, descripción breve, responsable, **tipo** (documento que se mantiene o registro que se conserva: lo que las normas llaman «información documentada»), **fecha del hecho evidenciado**, fecha de registro, **vigencia** (fecha hasta la cual sirve), versión y aprobación del documento cuando es un documento, y el archivo adjunto con su huella de integridad (Q2).
- **H6.2** Una evidencia vigente respalda a **todas** las entradas de norma mapeadas al control: se registra una vez y se reutiliza entre normas.
- **H6.3** Una evidencia **vencida** deja de contar como cobertura y genera una alerta visible; se avisa antes del vencimiento (Q10).
- **H6.4** No se puede borrar el archivo de una evidencia que respalda una Declaración aprobada; se puede **reemplazar** por una versión nueva, y la anterior queda en el historial.
- **H6.5** El archivo solo lo descarga una persona con sesión de la empresa dueña de la evidencia; un enlace no sirve fuera de esa sesión ni para otra empresa.

### H7 — Cobertura

- **H7.1** Veo por norma, por agrupador y por cláusula o control de la norma cuántas entradas están **cubiertas** (mapeadas a al menos un control operando con al menos una evidencia vigente), cuántas con brecha y cuántas con evidencia vencida.
- **H7.2** Desde una entrada de norma llego a sus controles y evidencias; desde una evidencia, a todo lo que respalda.

### H8 — Declaración de Aplicabilidad

- **H8.1** Para ISO/IEC 27001 y para ISO/IEC 42001 puedo **generar un borrador** de la Declaración de Aplicabilidad. Tiene una fila por **cada control del Anexo A** (la comparación con el Anexo A completo se cumple porque no falta ninguna fila) y filas **adicionales** para los controles de la empresa de otras fuentes. Cada fila lleva: si **aplica**, la **justificación** (de inclusión o de exclusión), el **estado de implementación**, los **controles de la empresa** vinculados y, cuando aplica y no está implementado, una **referencia opcional al plan de tratamiento** (texto o enlace externo).
- **H8.2** El borrador se **deriva** de los controles y mapeos reales: el estado de implementación sale del control vinculado; un control de la norma que aplica y no tiene control vinculado figura como **no implementado**.
- **H8.3** No se puede aprobar mientras haya un control **sin decisión** (aplica o no), **excluido sin justificación**, o alguna justificación que **siga marcada como «generada por IA»** (la persona debe revisarla y aceptarla). Si hay controles que aplican, no están implementados y no tienen referencia a un plan, se **advierte** sin bloquear.
- **H8.4** El administrador **aprueba** la Declaración: queda una **versión inmutable** numerada, con fecha y persona. Cualquier cambio posterior crea un borrador nuevo; las versiones aprobadas no se editan ni se borran y se puede ver su historial.
- **H8.5** Mientras no esté aprobada, todo lo que se muestre o exporte lleva el rótulo **borrador**.
- **H8.6** Hay una Declaración por norma (Q5).
- **H8.7** **Limitación de dominio:** el producto aún no tiene gestión de riesgos, de donde 27001 y 42001 derivan los controles necesarios (y 42001, además, de la evaluación de impacto de los sistemas de IA). La Declaración del MVP es **una decisión manual del administrador SIG** y se marca como **preliminar**. Admite la **referencia al análisis de riesgos externo** de la empresa (título, versión y fecha), y el documento exportado lleva la nota «Los riesgos se gestionan fuera del sistema». No se presenta como lista para un auditor.

### H9 — Exportar la Declaración

- **H9.1** Puedo **exportar** la versión aprobada, o el borrador marcado como tal, como documento (Q1) con la empresa, la norma y su edición, la versión, la fecha, quién la aprobó, el alcance y la tabla de controles.
- **H9.2** El documento no contiene texto de las normas: solo identificador, título breve y lo escrito por la empresa.
- **H9.3** Cada exportación queda registrada.

### H10 — Ayuda del asistente (borrador)

- **H10.1** En una justificación de la Declaración (inclusión o exclusión) puedo pedir al asistente una **propuesta** que yo reviso, edito y guardo. La propuesta es una **redacción general** y **no afirma hechos de la empresa**. Nunca se guarda ni se aprueba sola y lleva el rótulo «borrador generado por IA» hasta que la persona la acepte (Q7); mientras lo lleve, bloquea la aprobación (H8.3).
- **H10.2** El asistente solo usa un **modelo local**; a un modelo externo no se envía nada de la empresa. Se le envía lo mínimo necesario (el control de la norma y su estado), no los comentarios libres ni las evidencias.
- **H10.3** Cada consulta queda registrada sin guardar lo preguntado ni lo respondido (política de IA).
- **H10.4** Antes de implementar esta historia se hace una **evaluación propia del caso de uso** (la clasificación de datos exige una para datos confidenciales).

## 4. Reglas de negocio

1. **Un requisito común, una evidencia, varias normas:** la evidencia cuelga del control de la empresa y respalda todo lo mapeado.
2. **Cubierto** significa control operando con evidencia vigente; un control planificado, retirado o con evidencia vencida no cubre.
3. **Control de la norma frente a control de la empresa** (glosario): la Declaración se arma por control de la norma; el control de la empresa puede ser adicional.
4. **Nada se aprueba solo:** el alcance y la Declaración los aprueba una persona (administrador SIG); la IA solo propone.
5. **Las versiones aprobadas son inmutables** y mantienen su historial.
6. Todo es de una empresa; nada se comparte entre empresas, salvo las librerías de normas, que son globales y de solo lectura.
7. Las librerías de las que depende un diagnóstico, un mapeo o una Declaración no se pueden desadoptar (no hay desadopción en el producto).
8. Sin texto de las normas en ningún dato, pantalla ni documento (regla 3).
9. Sin alcance aprobado no hay diagnóstico ni Declaración de Aplicabilidad de esa norma.
10. La Declaración del MVP es preliminar: no está respaldada por un análisis de riesgos del producto.

## 5. Datos y clasificación

Los plazos y bases de tratamiento son hipótesis a confirmar con el asesor legal (ADR 028). Estos son los **primeros datos «Confidenciales de la empresa»** del producto (`docs/security/clasificacion-datos.md`): hace falta definir su retención y su borrado antes del primer cliente externo.

| Dato                                                                                        | Clasificación                                                                                                            |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Librerías con Anexo A                                                                       | Público de SynapTech                                                                                                     |
| Proyecto, alcance, diagnóstico, comentarios, controles, mapeos, Declaración y sus versiones | **Confidencial de la empresa**                                                                                           |
| Archivos de evidencias                                                                      | **Confidencial de la empresa** (pueden contener datos personales y secretos de la empresa: solo los ve la empresa dueña) |
| Responsable de un control o de una evidencia; quién evaluó o aprobó                         | Personal (identificador opaco de la cuenta)                                                                              |
| Registro de las consultas al asistente                                                      | Personal (seudonimizado)                                                                                                 |

## 6. Impacto multiempresa

- Todo lo anterior lleva la empresa y se aísla igual que el resto de los datos de negocio, **incluidos los archivos de evidencia**.
- Para cada dato nuevo debe haber una prueba que intente leer o escribir lo de otra empresa y **falle**; en particular, la descarga de un archivo de otra empresa.
- Un mapeo, un vínculo de la Declaración o una evidencia no pueden referenciar a un control, una persona o un proyecto de otra empresa.
- La reutilización de evidencia entre normas es **dentro de la misma empresa**.

## 7. Impacto en la bitácora (P15)

Se registran (códigos cerrados, sin texto libre ni datos personales): creación, cambio y cierre de un proyecto; aprobación y cambio de alcance; creación de un diagnóstico y **cada cambio de estado** de una evaluación; creación, cambio y retiro de un control; alta y baja de un mapeo; alta, reemplazo y eliminación de una evidencia y su **vencimiento** (hecho del sistema); generación, aprobación y exportación de la Declaración; y las consultas al asistente. La acción y su registro ocurren juntas; si no se puede registrar, la acción no se completa.

## 8. Impacto de IA

- El asistente solo propone borradores de justificaciones de la Declaración (H10), con modelo local, datos mínimos y supervisión humana; ver `docs/security/politica-ia.md`.
- Los datos de la empresa son **Confidenciales**: este caso de uso necesita su **evaluación propia** antes de implementarse (H10.4) y la política de IA debe ampliarse para cubrirlo. Hasta entonces no se envía nada de la empresa a ningún modelo.
- La ficha del asistente y la muestra de calidad firmada (ADR 030) siguen pendientes y son condición previa.

## 9. Fuera de alcance

- Auditorías internas y externas, no conformidades y acciones correctivas, hallazgos y su cierre.
- **Etapa 2 de certificación:** el MVP **no la habilita**: falta política, objetivos, auditoría interna y revisión por la dirección, prerrequisitos de la Etapa 2. El MVP tampoco gestiona riesgos, de modo que rompe la dependencia de la Declaración con el análisis de riesgos (H8.7).
- Riesgos, activos de información, evaluación de impacto de sistemas de IA.
- Certificado, seguimientos y recertificación; etapas E2, E5, E6, E7 y E8.
- Contexto de la organización y partes interesadas (parte de E0), plan de implementación (E2), política integrada y objetivos (parte de E3).
- Indicadores, revisión por la dirección y módulo de documentos.
- Roles múltiples, auditor, vigencia de roles y relación persona–proceso.
- Librerías de otras normas y de 27001:2013; verificación de la numeración (la hace el responsable).
- Alertas por correo, notificaciones externas e integraciones.
- Comparación entre diagnósticos, tableros avanzados y exportación de otros documentos.

## 10. Preguntas abiertas

Cada una trae una propuesta; si no hay objeción, se toma la propuesta.

| #   | Pregunta                                                                        | Propuesta                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | ¿En qué formato se exporta la Declaración?                                      | Documento **editable** (la empresa lo ajusta, firma y archiva); la versión imprimible llega después. Se decide en el plan (librería pendiente, ADR 021).    |
| Q2  | ¿Las evidencias son archivos adjuntos o solo referencias a dónde viven?         | Archivo adjunto con huella y tamaño limitado; si el plan lo encarece mucho, se parte con solo referencia y se añade el archivo después.                     |
| Q3 | ¿Cómo se calcula la madurez? | Cumple = 100, parcial = 50, no cumple = 0, no aplica fuera del cálculo, sin evaluar aparte; promedio por cláusula, agrupador y norma, siempre con el desglose de conteos y un indicador propio para las cláusulas 4 a 10. |
| Q4  | ¿Entran el plan de implementación (E2) y el contexto y partes interesadas (E0)? | No: «después».                                                                                                                                              |
| Q5  | ¿Una Declaración por norma o combinada 27001 + 42001?                           | Una por norma; la vista combinada llega después.                                                                                                            |
| Q6  | ¿Quién aprueba el alcance y la Declaración?                                     | Solo el administrador SIG.                                                                                                                                  |
| Q7  | ¿Entra la ayuda del asistente en el MVP?                                        | Solo en las justificaciones de la Declaración, con evaluación propia previa; si retrasa, sale del MVP sin afectar lo demás.                                 |
| Q8  | ¿Qué librerías se publican?                                                     | Tres (9001, 27001 con Anexo A, 42001 con Anexo A), marcadas **borrador sin verificar** hasta que el responsable compruebe la numeración con sus ejemplares. |
| Q9  | ¿Tamaño máximo de un archivo de evidencia?                                      | 25 MB por archivo.                                                                                                                                          |
| Q10 | ¿Cuándo y cómo se avisa un vencimiento?                                         | 30 días antes y al vencer, dentro del producto (por correo, después).                                                                                       |
| Q11 | ¿El diagnóstico se repite?                                                      | Sí, como instantáneas fechadas; comparar entre ellas es «después».                                                                                          |
