# STRIDE — Control documental (ADR 039)

Fecha: 2026-11-19. Alcance: los flujos nuevos: crear, cambiar y retirar **documentos**; **subir** una versión con su archivo; **enviar a revisión**, **aprobar** (con su separación de funciones y la excepción del único administrador), **devolver** y **descartar**; **descargar** un archivo; definir la **distribución** y **confirmar la lectura**; **revisar sin cambios**; **vincular** con controles y entradas de las normas; la **cobertura documental**; la **retención** por tipo; y el **directorio de personas**.

Categorías: **S** suplantación · **T** manipulación · **R** repudio · **I** divulgación de información · **D** denegación de servicio · **E** elevación de privilegios.

## Clasificación de los datos nuevos

Todo es **«Confidencial de la empresa»**, con `empresa_id` y RLS forzada (7 tablas, migraciones `0021` y `0022`). Siguen siendo **solo datos de prueba** hasta que el asesor legal valide el ADR 028 (insumo 13).

| Dato | Clasificación | Dónde vive | Retención |
| --- | --- | --- | --- |
| Documento: código, tipo, título, área, clasificación, emisor y edición (externos) | Confidencial de la empresa | `documento` (no se borra: se retira) | Mientras exista la empresa (hipótesis; ADR 028) |
| Versión: archivo, huella SHA-256, nota, autor, aprobador, fechas, estado | Confidencial; **el archivo puede traer datos personales** | `documento_version` y el almacén de archivos (ADR 032) | Hasta la disposición, **diferida**: hoy no se borra nada |
| Motivo de la excepción del único administrador y nota de devolución | Confidencial (texto libre de la empresa) | `documento_version` | Con la versión |
| Responsable, autor, aprobador y destinatarios | Personal, **identificador opaco** | columnas `*_id` y `documento_destinatario` | Como el resto de identificadores de personas |
| Lectura confirmada (persona, versión, fecha y hora) | **Personal seudonimizado**; evidencia | `documento_lectura` | Sin plazo; se conserva tras la baja (insumo 13b) |
| Vínculos con entradas de normas y controles | Confidencial | `documento_entrada`, `documento_control` | Se quita con rastro |
| Retención por tipo (años y motivo) | Confidencial | `retencion_tipo` | Mientras exista la empresa |
| Hechos de bitácora (`documento.*`, `version.*`, `lectura.*`, `retencion.*`) | Interno, inmutable | `bitacora` | Ver ADR 028 |
| Directorio de personas (id, nombre, activa, puedeAprobar) | Personal (nombre) | **No se guarda aparte**: se lee de `usuario` de la empresa de la sesión | Lo de `usuario` |

**Nunca** llegan a la bitácora: títulos, áreas, notas, motivos escritos, nombres de personas ni nombres de archivo. Solo el hecho y el objeto de **forma exacta** (`documento:POL-001`, `version:POL-001.v3`, `retencion:politica`), la huella del archivo como versión del objeto y valores cerrados (`por_su_autor`, `requiere_lectura`, el motivo de devolución). Esta funcionalidad **no usa IA** y los textos libres no salen a ningún asistente.

## Documentos y versiones

| Cat. | Amenaza y mitigación | Riesgo que queda |
| --- | --- | --- |
| S | La empresa y la persona salen solo del token; ninguna operación recibe una empresa. Un documento, una versión o un archivo de otra empresa responde **404 indistinguible** (probado en la base, en la API y de extremo a extremo con la empresa B). Las claves foráneas son **compuestas con `empresa_id`**: un documento de A no se liga a un control, una persona ni una versión de B. | |
| T | El código (`POL-001`) y el estado los asigna el sistema: ningún cuerpo los admite. **Una sola versión aprobada por documento lo garantiza un índice único parcial en la base**, no solo la aplicación; aprobar deja la anterior obsoleta en la misma transacción. La aplicación **no puede cambiar** el archivo, la huella, la nota, el número ni la autoría de una versión (permiso por columnas, probado) y no puede borrar documentos ni versiones. Concurrencia optimista por versión (409). Dos subidas o dos aprobaciones a la vez: una sola prospera (probado con carreras reales; el bloqueo del documento se toma **antes** de comprobar). | BAJO: una versión aprobada se protege por permisos de columnas y no por un disparador que impida cualquier `UPDATE` de estado; un error de la aplicación podría reabrirla. |
| R | Cada creación, cambio, retiro, subida, envío, devolución, aprobación, descarte, descarga, revisión, vínculo, distribución, lectura y cambio de retención deja un hecho **en la misma transacción** (si la bitácora falla, no queda nada: probado). La descarga se registra **antes** de entregar el archivo y, si no se puede, no se entrega (falla cerrada). | Ninguno. |
| I | Títulos y notas son textos de la empresa y pueden traer datos personales por descuido: la pantalla lo advierte, sin detección automática. La **clasificación es solo informativa**: no limita quién lee (decisión del ADR 039; la pantalla lo dice). | MEDIO: un dato personal en un título, una nota o un archivo queda guardado y no hay vía de supresión (insumo 13). |
| D | Archivos: solo siete tipos decididos por el **contenido**, sin macros, SVG ni HTML; máximo 25 MB (413 antes de leer el cuerpo si lo declara); la API no lee un solo byte hasta decidir permiso, datos y documento. Topes: 1000 documentos, 500 destinatarios, 50 vínculos por documento y límite de frecuencia por persona. | BAJO: sin cuota de almacenamiento por empresa ni antivirus (igual que las evidencias). |
| E | `documentos.aprobar` y `documentos.gestionar` son solo del administrador SIG; el colaborador redacta, consulta y confirma su lectura. El permiso se decide **antes** que la forma y la existencia (401 → 403 → 400 → 404 → 409). Un cuerpo con campos de más no los cuela (lista cerrada de campos). | Ninguno. |

## Aprobación: separación de funciones

| Cat. | Amenaza y mitigación | Riesgo que queda |
| --- | --- | --- |
| S/E | Solo aprueba la persona **nombrada** al enviar, con permiso de aprobar y **distinta del autor**. Excepción: con **un solo administrador activo** puede aprobar su versión con **motivo obligatorio**; queda marcada («aprobada por su autor») y es visible en el historial de versiones. Con dos o más administradores la regla es estricta (probado). Una persona dada de baja no se nombra ni aprueba. | MEDIO: la excepción puede abusarse si la empresa deja a propósito un solo administrador; queda el rastro visible y el motivo, pero no hay segunda firma. |
| T | La versión aprobada rige desde la aprobación (**no hay vigencia futura**): no hay estado intermedio que deje un documento sin versión vigente. | |
| R | `version.aprobada` lleva solo valores cerrados (`por_su_autor`, `requiere_lectura`, `destinatarios`) y la huella; el motivo de la excepción vive en la base, no en la bitácora. | |

## Distribución y lectura confirmada

| Cat. | Amenaza y mitigación | Riesgo que queda |
| --- | --- | --- |
| S | Solo la **propia persona** confirma su lectura (sale del token); ni el administrador confirma por otra. La fecha de una lectura ya confirmada **no se reescribe** (la base solo deja actualizar `confirmada_en` y la aplicación solo la fija si estaba pendiente). | MEDIO: la confirmación es una **constancia de conocimiento** declarada por la persona; no prueba que leyó (la pantalla dice «no una capacitación»). |
| T | «Todas las personas de un rol» se resuelve **al momento** y no se guarda el rol; solo cuentan personas activas de la empresa; quien se va deja de contar como pendiente y su confirmación se conserva. | |
| I | El directorio muestra solo id, nombre, si está activa y si aprueba (sin correo ni rol), de la **empresa de la sesión**; no se persiste aparte ni va a la bitácora. | MEDIO: cualquier rol con consulta ve los nombres de las personas de su empresa (insumo 13c). |

## Retención y disposición

La eliminación de archivos (disposición) es **irreversible** y se **difirió** a decisión del responsable (ADR 039): el módulo solo **marca** una versión obsoleta como «elegible para disposición» al vencer el período del tipo (años y motivo que fija la empresa; sin valor por omisión). **No hay ninguna acción destructiva** en este módulo, así que no hay amenaza de borrado indebido; el riesgo que queda es el de conservar de más (ver insumo 13).

## Riesgos aceptados

1. **Datos personales por descuido** en títulos, notas, motivos y archivos, sin vía de supresión (se resuelve con la disposición y el asesor legal; solo datos de prueba hasta entonces).
2. **Excepción del único administrador:** aprueba su propia versión con motivo y marca visible.
3. **Lecturas** como constancia declarada y sin plazo de conservación definido.
4. **Directorio** con nombres visibles para quien consulta.
5. Sin **antivirus**, **cuota por empresa** ni **verificación de la huella al descargar** (igual que las evidencias).
6. **Clasificación informativa:** un documento «restringido» lo ve toda persona con permiso de consulta de la empresa (decisión del responsable, Q9; con datos reales habrá que revisarla).
7. **Recomendaciones de la revisión no aplicadas** (decisiones de producto ya tomadas, a retomar): pedir la lectura por omisión en versiones nuevas y crear la pendiente a quien se suma a la distribución después de aprobar; motivo obligatorio al retirar un documento; edición de la fuente por versión en documentos externos; clasificación con efecto sobre el acceso.
