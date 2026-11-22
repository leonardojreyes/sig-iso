# STRIDE — Auditoría interna (ADR 040)

Fecha: 2026-11-22. Alcance: **procesos** y sus relaciones con personas; **programa anual** de auditoría; **auditorías** con su alcance, equipo e independencia; **lista de verificación** generada de los requisitos adoptados; **evaluación** por el equipo; **hallazgos**; **informe congelado** (huella SHA-256) y su descarga en Word; **cierre** y panel del prerrequisito de la Etapa 2.

Categorías: **S** suplantación · **T** manipulación · **R** repudio · **I** divulgación de información · **D** denegación de servicio · **E** elevación de privilegios.

## Clasificación de los datos nuevos

Todo es **«Confidencial de la empresa»**, con `empresa_id` y RLS forzada (migraciones `0023` a `0025`; una prueba de aislamiento por grupo de tablas). Siguen siendo **solo datos de prueba** hasta que el asesor legal valide el ADR 028.

| Dato | Clasificación | Dónde vive | Retención |
| --- | --- | --- | --- |
| Proceso: código, nombre, descripción, importancia, frecuencia, cambio relevante | Confidencial de la empresa | `proceso` (no se borra: se retira) | Mientras exista la empresa (hipótesis; ADR 028) |
| Relación persona–proceso (dueña, participa, diseño, supervisa) | Personal, **identificador opaco** | `persona_proceso` | Con el proceso |
| Programa anual: objetivo, normas, exclusiones con su motivo | Confidencial (texto libre de la empresa) | `programa_auditoria`, `programa_norma`, `programa_exclusion` | Mientras exista la empresa |
| Auditoría: objetivo, fechas, alcance, equipo, excepción de independencia (motivo y medida) | Confidencial; el equipo es personal (identificadores) | `auditoria*` | Mientras exista la empresa |
| Lista de verificación: resultado, **nota con la evidencia**, preguntas propias | Confidencial; **la nota puede traer datos personales o secretos por descuido** | `auditoria_item`, `auditoria_pregunta` | Con la auditoría |
| Hallazgo: enunciado, evidencia, justificación de gravedad, motivo de anulación | Confidencial (texto libre) | `hallazgo` | Con la auditoría; no se borra |
| Informe emitido: copia congelada (jsonb), huella, conclusión y limitaciones | Confidencial; **inmutable** | `auditoria_informe` | Sin plazo definido (decisión de disposición diferida) |
| Archivo Word del informe | Confidencial | **No se guarda**: se genera cada vez desde la copia congelada | — |
| Hechos de bitácora (`proceso.*`, `relacion.*`, `programa.*`, `exclusion.*`, `auditoria.*`, `equipo.*`, `lista.generada`, `item.evaluado`, `pregunta.*`, `hallazgo.*`, `informe.*`) | Interno, inmutable | `bitacora` | Ver ADR 028 |

**Nunca** llegan a la bitácora: nombres de procesos, objetivos, notas, evidencias, motivos escritos, conclusiones ni nombres de personas. Solo el hecho y el objeto de **forma exacta** (por ejemplo `auditoria:AI-2027-01`), valores cerrados y, en el informe, la huella.

## Procesos y relaciones

| Cat. | Amenaza y mitigación | Riesgo que queda |
| --- | --- | --- |
| S | La empresa y la persona salen solo del token; ninguna operación recibe una empresa. Un proceso de otra empresa responde **404 indistinguible** (probado en la base, en la API y de extremo a extremo con la empresa B). Las claves foráneas son **compuestas** con `empresa_id`: una relación no puede apuntar a una persona de otra empresa. | |
| T | El código `PR-nnn` lo asigna el sistema. Cambios con **concurrencia optimista** por `version` (un cambio con versión vieja es 409). La dueña vigente no se quita: se cambia. | |
| R | Cada alta, cambio, retiro y relación deja un hecho **en la misma transacción**. | |
| I | Los nombres de personas se leen del directorio de la empresa de la sesión; no se persisten aparte. | BAJO |
| E | Escribir exige `auditoria.gestionar` (solo administrador SIG); consultar, `auditoria.ver`. Permiso antes que forma y existencia (401 → 403 → 400 → 404 → 409). | |

## Programa, auditoría e independencia

| Cat. | Amenaza y mitigación | Riesgo que queda |
| --- | --- | --- |
| S/E | **Independencia por proceso:** quien diseña, es dueña, participa o supervisa un proceso no se designa auditora de ese proceso. La **excepción** exige motivo y medida compensatoria, y **nadie la autoriza para sí**, salvo el único administrador activo (queda marcada y visible). Un colaborador no se designa auditor. | MEDIO: la relación persona–proceso la declara la empresa; el sistema no puede saber de vínculos no registrados. |
| T | Un programa por año; aprobado una vez; cambiarlo lo devuelve a «sin aprobar». Las **transiciones de estado** están cerradas (planificada → en preparación → en ejecución → informe emitido → cerrada; cancelada con motivo). Un solo líder. | |
| R | Aprobación, exclusiones, designaciones, excepciones, cambios de estado y cancelaciones dejan hecho en la misma transacción. | |
| D | Topes de alcance (normas, procesos, capítulos) y de longitud de textos; la API limita 120 peticiones por minuto por persona. | |

## Lista de verificación y hallazgos

| Cat. | Amenaza y mitigación | Riesgo que queda |
| --- | --- | --- |
| S/E | Solo el **equipo designado** evalúa, y solo con la auditoría **en ejecución** (probado: el colaborador y alguien fuera del equipo reciben 403). La lista se **genera una vez** al entrar en preparación y queda fijada a la versión de la librería. Solo el líder registra o cambia una **no conformidad mayor**. | |
| T | «No conforme», «observación», «oportunidad» y «no aplica» exigen nota con evidencia; «por evaluar» no es un valor que se pueda enviar. Cada fila evaluada se cambia con la versión que se vio. Una NC exige proceso + requisito + evidencia. **No se emite el informe** con filas por evaluar ni con una fila no conforme sin hallazgo. | |
| R | Cada evaluación, pregunta y hallazgo deja un hecho cerrado (sin la nota ni la evidencia). | |
| I | Notas y evidencias son texto libre: pueden traer datos personales por descuido; la pantalla lo advierte, sin detección automática. El diagnóstico de la fila es **solo contexto** y no se copia como resultado. | MEDIO: sin vía de supresión mientras no se decida la disposición (ADR 028). |
| D | Hasta 5 preguntas propias por fila; topes de textos. | |

## Informe, descarga y cierre

| Cat. | Amenaza y mitigación | Riesgo que queda |
| --- | --- | --- |
| T | La copia del informe se **congela** (jsonb) y es **inmutable** en la base (triggers de no actualizar ni borrar). Su **huella SHA-256** se calcula sobre el JSON **canónico** (claves ordenadas), porque jsonb reordena las claves; al exportar se **verifica** la huella y si no coincide se rechaza. | |
| R | La emisión y **cada descarga** quedan en la bitácora (`informe.emitido`, `informe.exportado`). Cerrar **no** cierra los hallazgos: siguen abiertos. | |
| I | El Word sale **siempre de la copia congelada**, como **adjunto**, con `Cache-Control: no-store` y `nosniff`; lleva el aviso de que es un informe interno y **no un certificado**. Se genera en memoria, no se guarda en disco. Una descarga de otra empresa es 404. | BAJO |
| E | Emitir lo hace el administrador o el auditor líder; **cerrar, solo el administrador SIG**. El panel del prerrequisito de la Etapa 2 **solo informa**: no decide la etapa. | |

## Protección de la web

Las escrituras van por formularios `POST` a rutas del servidor de la web con **lista cerrada de 27 acciones** (una desconocida es 404); exigen `Origin` igual al de la web (sin Origin, `null` u otro sitio: 403), no admiten `GET` (405) y no pasan el token al navegador (ADR 027). Cada campo se valida y se normaliza **antes** de llegar a la API; un valor opcional inválido **no se descarta en silencio**. Verificado de extremo a extremo con `pnpm web:verify-auditoria`.

## Riesgos aceptados

1. **Datos personales por descuido** en notas, evidencias, enunciados y motivos, sin vía de supresión (se resuelve con la disposición y el asesor legal; solo datos de prueba hasta entonces).
2. **Independencia** basada en las relaciones que la empresa declara; la repetición dentro de 12 meses es solo un aviso.
3. **Excepción del único administrador:** autoriza su propia excepción con motivo y medida, con marca visible.
4. **Informes sin plazo de conservación** definido (disposición diferida).
