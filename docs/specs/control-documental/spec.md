# Spec — Control documental

- **Estado:** **Borrador, validado con `experto-iso` (sección 11), para aprobación del responsable.** Las preguntas abiertas (sección 10) traen propuesta por omisión: basta decir «apruebo con la propuesta por omisión».
- **Ruta:** Etapa A de `docs/producto/hoja-de-ruta.md` (módulo «Control documental», ~2 días). Módulo 2 de `docs/producto/vision.md`.
- **Depende de:** M4 (almacén de archivos, ADR 032), M3 (controles de la empresa), M7 (personas) y las normas adoptadas (M6a). **No** depende de «Gestión de riesgos completa» (su spec y tareas están en la rama `feature/gestion-riesgos-completa`).
- **Fecha:** 2026-11-18
- **Para confirmar con tu NTE INEN-ISO/IEC 27001:2023** (cláusula 7.5, información documentada): qué debe cubrir la creación, actualización y control (identificación, revisión y aprobación; distribución, acceso, conservación y disposición; documentos de origen externo). El spec no copia texto de la norma y se ajusta a lo que confirmes.

## 1. Problema

Un auditor de certificación pide ver que las políticas y procedimientos de la empresa **existen, están aprobados, están vigentes, los conoce quien debe conocerlos y se revisan**. Hoy la empresa los guarda en carpetas compartidas sin forma de saber cuál versión rige, quién la aprobó, quién la leyó ni cuándo vence su revisión. El producto ya guarda **evidencias** (registros que demuestran algo); falta el **documento controlado**: el texto que la empresa decide y que debe gobernarse con versiones, aprobación y distribución.

## 2. Usuarios y roles

| Rol                                               | Qué hace                                                                                                                            |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Administrador SIG                                 | Crea y mantiene documentos, **aprueba** versiones, define distribución y retención, ve todo                                         |
| Colaborador                                       | **Redacta borradores** y los envía a revisión; **consulta** los documentos vigentes; **confirma su lectura** cuando es destinatario |
| Otros roles, persona sin cuenta o de otra empresa | No ven nada (sin permisos hasta definir los demás roles, ADR 029)                                                                   |

## 3. Historias y criterios de aceptación

### H1 — Registrar un documento

- **H1.1** El administrador o el colaborador puede **crear un documento** con: título, **tipo** (lista cerrada: política, procedimiento, instructivo, formato, manual, otro), **responsable** (persona de la empresa), **clasificación** (pública, interna, confidencial, restringida) y, opcionalmente, **qué requisitos o controles** de las normas adoptadas respalda (H5). Recibe un **código correlativo por tipo** de la empresa («POL-001», «PRO-004»), que no se reutiliza.
- **H1.2** Un documento **no se borra**: se **retira** (queda como «obsoleto» sin versión vigente), conserva su historia y su código.
- **H1.3** La lista filtra por tipo, estado, responsable y norma; señala los documentos **sin versión vigente**, **con revisión vencida** y **con lecturas pendientes**.
- **H1.4** La pantalla avisa que el contenido **no debe llevar datos personales innecesarios ni texto de las normas**.

### H2 — Versiones y su flujo

- **H2.1** Cada documento tiene **versiones** numeradas (1, 2, 3…). Una versión contiene **un archivo** (mismos tipos y límites que las evidencias, ADR 032; decidido por el contenido, con su huella de integridad) y una **nota de cambios obligatoria** (qué cambió y por qué; la primera dice «versión inicial»).
- **H2.2** Estados de una versión: **borrador → en revisión → aprobada → obsoleta**. Solo una versión de un documento puede estar **aprobada (vigente)**; al aprobar una nueva, la anterior pasa a **obsoleta** en el mismo acto. Un borrador se puede **descartar** (queda registrado, no se borra).
- **H2.3** El **autor** envía el borrador a revisión nombrando **quién la aprueba** (persona de la empresa con permiso de aprobar). El **aprobador no puede ser el autor** de esa versión. El aprobador puede **aprobar** o **devolver a borrador con un motivo** (lista cerrada y nota breve).
- **H2.4** Una versión **aprobada o obsoleta es inmutable**: no se reemplaza su archivo ni su nota; un cambio exige una versión nueva. La pantalla muestra **qué versión rige hoy** y el historial completo (quién redactó, quién aprobó, cuándo, huella).
- **H2.5** Al aprobar se fija la **fecha de vigencia** (hoy, o una fecha futura indicada) y la **próxima revisión** (por omisión, un año; editable al aprobar). La versión aprobada con vigencia futura **no rige** hasta esa fecha.
- **H2.6** Descargar un archivo exige permiso, **queda en la bitácora antes de entregarse** y la versión se rotula con su estado: una versión **obsoleta** o **en borrador** se descarga con la leyenda **«no vigente»** visible en la pantalla (el archivo no se altera).

### H3 — Distribución y lectura confirmada

- **H3.1** Al enviar a revisión o al aprobar, el administrador define los **destinatarios** del documento: **personas** de la empresa o **todas las personas con un rol dado**. La distribución es del **documento** (se conserva entre versiones) y puede editarse.
- **H3.2** Al **aprobar** una versión, cada destinatario tiene una **lectura pendiente** de esa versión. Cada destinatario puede **confirmar** que la leyó (fecha y hora); no puede confirmar por otra persona. La pantalla de cada persona muestra **sus lecturas pendientes**.
- **H3.3** Una versión nueva aprobada reabre la lectura **solo si el aprobador marca «requiere nueva lectura»**; si no, la lectura confirmada de la versión anterior se conserva y se muestra «leyó la versión N».
- **H3.4** El administrador ve **quién confirmó y quién no** por versión, con un porcentaje en palabras y números. Una persona que **deja de pertenecer** a la empresa deja de contar como pendiente; su confirmación previa se conserva.
- **H3.5** El sistema **no envía correos ni recordatorios**: las pendientes se muestran (calendario y notificaciones quedan para otra etapa).

### H4 — Revisión periódica y retención

- **H4.1** Cada documento vigente tiene **fecha de próxima revisión**; la lista marca **vencidos** y **por vencer en 30 días**. **Revisar sin cambios** se registra (quién y cuándo, con nota breve) y reinicia la fecha, sin crear versión nueva.
- **H4.2** Cada tipo de documento tiene un **período de conservación** de las versiones obsoletas (en años; por omisión, el que fije la empresa, sin valor mágico: si no lo definió, se muestra «retención no definida»). Pasado ese período, la versión obsoleta se marca **«elegible para disposición»**; el sistema **no borra nada solo**.
- **H4.3** **Disponer** de una versión obsoleta elegible (eliminar su archivo) es una acción **explícita y aparte**, solo del administrador, con una confirmación previa que dice qué se pierde y con **nota obligatoria**; deja un registro permanente (de qué versión, quién, cuándo y huella del archivo eliminado) y conserva la fila y su historia. **Una versión vigente o la inmediata anterior no se puede disponer.** _(Acción irreversible: ver Q5.)_

### H5 — Vínculo con las normas y la cobertura documental

- **H5.1** Un documento puede ligarse a **requisitos o controles** de las librerías **adoptadas** (por código de librería e id estable) y a **controles de la empresa**. Un documento **sin versión vigente** no cuenta como respaldo.
- **H5.2** Una vista de **cobertura documental** lista las entradas de las normas adoptadas **sin ningún documento vigente ligado**, con filtros por norma y tema. Es **informativa** (no bloquea nada) y distinta de la cobertura de evidencias.
- **H5.3** Los documentos pueden ligarse a una **evidencia** existente como respaldo («este registro prueba que se cumple el procedimiento»); la evidencia sigue gobernada por su propio módulo.

## 4. Reglas de negocio

1. Los documentos, versiones, distribuciones y lecturas son **de la empresa** (regla 2).
2. **Documento ≠ evidencia.** El documento es lo que la empresa **decide**; la evidencia es el **registro** de que se hizo. Comparten el almacén de archivos, no el flujo.
3. **Una sola versión vigente** por documento. Aprobar es **solo del administrador SIG**, **nunca el autor** de esa versión (separación de funciones).
4. Versiones aprobadas y obsoletas son **inmutables**; nada se borra salvo la **disposición** explícita de H4.3.
5. **Vigente** = aprobada y con fecha de vigencia alcanzada y sin otra versión posterior ya vigente.
6. La **lectura confirmada** la hace la propia persona; el administrador **no** confirma por otra.
7. La **empresa** nunca viaja en un dato del cliente; sale de la sesión. Un archivo o documento de otra empresa responde como inexistente (404 indistinguible).
8. Las personas citadas (responsable, autor, aprobador, destinatario) deben ser **de la empresa de la sesión**; si luego se dan de baja se muestran como «persona dada de baja» y se conservan los datos.
9. La retención y la disposición **nunca son automáticas**; solo se marcan y se avisan.
10. **Sin texto de normas:** el producto no incluye plantillas con texto de normas; las guías son propias.

## 5. Datos y clasificación

| Dato                                                                         | Clasificación                                                           | Retención                                                      |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------- |
| Documento: código, título, tipo, clasificación, responsable                  | Confidencial de la empresa                                              | Mientras exista la empresa                                     |
| Versión: archivo, huella, nota de cambios, estado, fechas, autor y aprobador | **Confidencial de la empresa**; el archivo puede traer datos personales | Hasta la disposición (H4.3); la fila se conserva siempre       |
| Distribución y lecturas confirmadas (persona, versión, fecha)                | **Personal (seudonimizado)**; evidencia                                 | Conforme a ADR 028 (hipótesis a confirmar con el asesor legal) |
| Período de conservación por tipo                                             | Confidencial de la empresa                                              | Mientras exista la empresa                                     |
| Registro de disposición (versión, huella, quién, cuándo, nota)               | Evidencia de la empresa                                                 | **Permanente**                                                 |

Los textos libres (título, notas) pueden traer datos personales por descuido: la pantalla lo advierte y no van a la bitácora ni a ningún asistente de IA. Siguen siendo **solo datos de prueba** hasta que el asesor legal valide el ADR 028.

## 6. Impacto multiempresa

- Todo lo nuevo pertenece a **una empresa**. Cada pieza trae su **prueba de aislamiento**: con la sesión de A se intenta **leer, descargar, aprobar, confirmar lectura y disponer** de lo de B y debe fallar; los archivos de B no se alcanzan por ninguna ruta.
- Un documento de A **no** se liga a una entrada de librería no adoptada por A ni a un control o evidencia de B.

## 7. Impacto en bitácora

Cada **creación, cambio, retiro, nueva versión, envío a revisión, aprobación, devolución, descarte, revisión sin cambios, cambio de distribución, confirmación de lectura, descarga, cambio de retención y disposición** deja un hecho **en la misma operación**: qué, quién, sobre qué objeto (`documento:POL-001`, `documento:POL-001.v3`), con solo estados, números y huellas. **Nunca** títulos, notas ni nombres. La descarga se registra **antes** de entregar el archivo.

## 8. Impacto de IA

Ninguno ahora. Una ayuda futura que **redacte borradores** de políticas debería marcarlos «borrador generado por IA» y entrar por el flujo normal de revisión y aprobación humanas; queda fuera de este spec.

## 9. Fuera de alcance

- **Editor de texto en línea**, plantillas, comparación de versiones («diff»), firma electrónica y vista previa del archivo.
- **Documentos de origen externo** (normas, reglamentos) con control propio; **registros** distintos de las evidencias.
- **Flujos de aprobación de varios pasos** o por proceso; revisores obligatorios además del aprobador.
- Correos, recordatorios y calendario; **disposición automática** y cuota por empresa; antivirus.
- Mapa de procesos como estructura del documento; **capacitación** formal (la lectura confirmada es solo constancia de conocimiento).
- Importación masiva desde carpetas o Excel.

## 10. Preguntas abiertas (propuesta por omisión)

| #   | Pregunta                                                             | Propuesta por omisión                                                                                                                                                                                     |
| --- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | ¿El contenido es un archivo o se redacta en el sistema?              | **Archivo** (los siete tipos de M4), sin editor; el editor es una etapa posterior.                                                                                                                        |
| Q2  | ¿Quién puede aprobar?                                                | Solo el **administrador SIG**, distinto del autor. Si el administrador es el único que redacta, **no puede aprobar su propia versión**: otro administrador debe hacerlo.                                  |
| Q3  | ¿Revisor además del aprobador?                                       | **No**: un solo paso (aprobador). Varios pasos quedan fuera.                                                                                                                                              |
| Q4  | ¿La lectura se reabre al aprobar una versión nueva?                  | **Solo si el aprobador lo marca** («requiere nueva lectura», H3.3).                                                                                                                                       |
| Q5  | ¿Se puede eliminar el archivo de una versión obsoleta (disposición)? | **Sí, acción explícita** (H4.3), con nota, confirmación y registro permanente; no automática. Es **irreversible**: se confirma contigo antes de construirla, y si la prefieres fuera del MVP, se difiere. |
| Q6  | ¿Retención por tipo o por documento?                                 | **Por tipo** (años, definidos por la empresa); sin valor por omisión.                                                                                                                                     |
| Q7  | ¿Los destinatarios pueden ser todos los de un rol?                   | **Sí**, personas o rol (H3.1); el rol se resuelve al aprobar y se **congela** la lista de esa versión.                                                                                                    |
| Q8  | ¿La vista de cobertura documental es parte de este módulo?           | **Sí**, informativa (H5.2).                                                                                                                                                                               |

## 11. Ajustes tras la validación de `experto-iso` (2026-11-18; prevalecen sobre el texto de arriba)

La validación encontró **2 bloqueantes** (huecos de alcance sobre 7.5, no errores de diseño) y recomendó recortar para caber en ~25 tareas. Se incorporan así:

1. **Origen externo (bloqueante 1).** Se agrega el tipo de documento **«externo»** (norma, reglamento, contrato, manual de proveedor) con campos opcionales de **emisor** y **edición o fecha de la fuente**; pasa por el mismo flujo de versión y aprobación (aprobar = «lo identifiqué y lo controlo»), con revisión periódica y distribución. Sale de la sección 9.
2. **Vigencia sin huecos (bloqueante 2).** Se **elimina la vigencia futura** (H2.5): la versión aprobada **rige desde su aprobación**; al aprobar una nueva, la anterior pasa a obsoleta en el mismo acto, siempre con **una sola vigente**. Se registran la **fecha de aprobación** y la de **próxima revisión** (un año por omisión, editable) y la aprobación se muestra en el encabezado de la versión.
3. **Disposición diferida (H4.3 y Q5).** Se **difiere** la eliminación de archivos: el MVP solo marca la versión obsoleta como **«elegible para disposición»** al vencer su período. No hay acción destructiva en este módulo. La retención por tipo lleva un **motivo breve** (ley o política de la empresa) además de los años.
4. **Distribución (Q7 y H3.1).** La **distribución** es configuración editable del documento (personas; la acción «agregar a todas las personas de este rol» **resuelve la lista en ese momento**, sin congelar el rol). Al **aprobar**, la lista de destinatarios de esa versión es un **registro propio de lecturas pendientes**; quien entra después a un rol no recibe lectura pendiente de versiones ya aprobadas.
5. **Clasificación (decisión de producto, ver Q9).** Es **solo informativa**: no limita quién lee. Se dice así en la pantalla. Todo documento vigente lo ve quien tiene el permiso de consulta.
6. **Revisión periódica.** El **responsable del documento**, además del administrador, puede registrar «revisado sin cambios»; con **motivo** opcional de lista cerrada (periódica, auditoría, cambio de contexto).
7. **Identificación.** Se agrega **área o proceso** como texto libre (filtro de la lista). Se conserva la frase «constancia de conocimiento, no capacitación» en la interfaz.
8. **Recortes:** sale el **vínculo documento–evidencia** (H5.3); la **cobertura documental** (H5.2) pasa a ser un **filtro «entradas sin documento vigente»** en la pantalla de documentos, no una pantalla aparte; el porcentaje de lectura se muestra solo como conteo («12 de 15»).
9. **Aprobador único (Q2).** Se propone una **excepción registrada**: si la empresa tiene **un solo administrador**, puede aprobar su propia versión con **motivo obligatorio**, y el historial la marca «aprobada por su autor (único administrador)». Si hay dos o más administradores, la separación de funciones es estricta.
10. **Aclaración Q1:** los **siete tipos de archivo** son los de M4 (PDF, PNG, JPEG, TXT, DOCX, XLSX, PPTX); los **tipos de documento** son siete con «externo» (política, procedimiento, instructivo, formato, manual, externo, otro).

### Preguntas que quedan para ti (producto)

| # | Pregunta | Propuesta por omisión |
| --- | --- | --- |
| Q5 | ¿Diferir la disposición irreversible (borrar el archivo)? | **Sí, diferida**; solo se marca «elegible». |
| Q9 | ¿La clasificación gobierna el acceso o es informativa? | **Informativa** en el MVP. |
| Q2 | ¿Se permite la excepción del único administrador (ajuste 9)? | **Sí**, con motivo obligatorio y marca visible. |
