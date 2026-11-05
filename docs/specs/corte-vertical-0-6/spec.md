# Spec — Corte vertical mínimo: ingreso por empresa y librería de ejemplo

- **Estado:** Borrador (revisado por `experto-iso`; pendiente de revisión del responsable)
- **Paso:** 0.6 de la Fase 0
- **Fecha:** 2026-11-04

## 1. Problema

Hoy el producto solo tiene pantallas de demostración con datos de ejemplo escritos a mano: nadie inicia sesión, no existe el concepto real de «empresa» y nada queda registrado. Antes de construir cualquier módulo de negocio hay que demostrar, con un caso pequeño pero real, que:

1. una persona entra con su identidad y queda asociada a **una** empresa;
2. esa persona ve **solo** la información y la marca de su empresa, y nunca la de otra;
3. una librería de normas se puede **cargar como datos** y consultarse;
4. cada hecho relevante queda en una **bitácora que no se puede alterar** (principio P15).

Es el cimiento del resto del producto. Si falla el aislamiento entre empresas, no hay producto vendible.

## 2. Usuarios y roles

| Rol                                  | Qué puede hacer en este corte                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| Administrador SIG de una empresa     | Iniciar sesión, adoptar la librería de ejemplo para su empresa, consultar el listado. |
| Colaborador de una empresa           | Iniciar sesión y consultar el listado. No puede adoptar la librería.                  |
| Persona sin cuenta o de otra empresa | No puede ver nada de la empresa A ni de la empresa B sin pertenecer a ella.           |

Los demás roles del producto (dueño de proceso, auditor interno, auditor externo temporal, alta dirección) existen en el modelo, pero **no tienen funcionalidad propia en este corte**.

Empresas de prueba: **A** (SynapTech Ecuador) y **B** (Andes Logística S.A.), cada una con al menos un administrador SIG y un colaborador.

## 3. Historias y criterios de aceptación

### H1 — Iniciar y cerrar sesión

_Como persona con cuenta, quiero iniciar sesión con mi identidad corporativa para acceder solo a mi empresa._

- **H1.1** Si inicio sesión con credenciales válidas, llego a la pantalla de inicio **de mi empresa**, con su nombre visible.
- **H1.2** Si las credenciales son inválidas, no accedo y veo un mensaje de error en español que **no revela** si el usuario existe.
- **H1.3** Si intento abrir una pantalla interna sin sesión, soy llevado al inicio de sesión y, tras ingresar, vuelvo a la pantalla que pedí.
- **H1.4** Al cerrar sesión, ya no puedo abrir pantallas internas ni con el botón «atrás» del navegador sin volver a ingresar.
- **H1.5** Una sesión inactiva más allá del tiempo definido (ver pregunta Q4) deja de ser válida y se pide ingresar de nuevo.
- **H1.6** La empresa a la que pertenezco la determina mi cuenta; no puedo elegirla ni cambiarla desde la dirección web ni desde ningún dato que yo envíe.

### H2 — Ver solo lo de mi empresa

_Como persona de la empresa A, quiero ver únicamente la información de la empresa A._

- **H2.1** Con sesión de la empresa A, el listado de la librería muestra solo los registros de A.
- **H2.2** Con sesión de la empresa A, si pido directamente un registro de B (por su identificador o por una dirección web alterada), la respuesta es «no encontrado», **indistinguible** de un registro que no existe.
- **H2.3** Con sesión de la empresa A, si pido la pantalla de la empresa B en la dirección web, no veo datos ni marca de B.
- **H2.4** Una consulta que llega sin empresa determinada **falla**; nunca devuelve datos de todas las empresas.
- **H2.5** Existe una prueba automatizada que, con una sesión de A, intenta leer datos de B por todas las vías del corte (listado, detalle, configuración de marca) y **debe fallar**; la prueba se ejecuta en cada cambio y bloquea su integración si no pasa.
- **H2.6** El aislamiento se cumple aunque la aplicación tenga un error: la garantía está en los datos, no solo en las pantallas.

### H3 — Ver la marca de mi empresa

_Como persona de una empresa, quiero ver el logo y los colores de mi empresa._

- **H3.1** Tras iniciar sesión, la interfaz usa el color primario y el logo (o monograma) **de mi empresa**; los de la otra empresa no aparecen en ninguna parte de lo que recibo.
- **H3.2** Si el color de la empresa no cumple el contraste mínimo de accesibilidad, se ajusta automáticamente y el administrador SIG ve un aviso.
- **H3.3** Un logo que no sea una imagen permitida se descarta y se muestra el monograma.
- **H3.4** En este corte la configuración de marca es **solo de lectura**; se carga como dato inicial de cada empresa de prueba.

### H4 — Cargar el catálogo y adoptar la librería de ejemplo

_Como administrador SIG, quiero adoptar la librería de ejemplo de la Estructura Armonizada para que mi empresa disponga de sus requisitos._

La librería es **global y de solo lectura**: SynapTech la incorpora al catálogo (carga de plataforma) y cada empresa la **adopta**.

**Carga del catálogo (operación de plataforma, no de las empresas)**

- **H4.1** La carga lee un archivo de librería y lo **valida** contra su definición de formato antes de guardar nada; si es inválido, no se guarda **ningún** registro y se informa qué entradas fallaron (por su identificador) y el código del motivo, **sin repetir el contenido rechazado**.
- **H4.2** Control de derechos de autor, con criterios objetivos: cada entrada guarda solo identificador, título breve (máximo 80 caracteres), guía propia (máximo **280 caracteres y 2 frases**) y mapeos (cada mapeo, solo norma e identificador). La carga **rechaza** toda entrada que exceda esos límites o que coincida con las heurísticas de tono normativo definidas en el plan, comprobadas con casos de prueba sintéticos. Como la heurística no puede garantizar por sí sola que no haya texto copiado, **toda librería requiere revisión humana (`revisor-cumplimiento`) antes de publicarse en el catálogo**. El control corre también en la verificación automática de cada cambio.
- **H4.3** Cargar dos veces la misma librería y versión no duplica registros; la misma versión con contenido distinto se **rechaza** (el catálogo no se modifica una vez publicado).
- **H4.4** La carga es todo o nada: si ocurre un fallo a mitad de camino, el catálogo queda como estaba.
- **H4.5** Cada carga, aceptada o rechazada, queda en la bitácora como hecho de plataforma. Una carga rechazada registra solo los identificadores de las entradas y los códigos de motivo, **nunca el contenido** (la bitácora no se puede borrar).

**Adopción por la empresa**

- **H4.6** Solo el administrador SIG ve y puede usar la acción de adoptar; un colaborador no la ve y, si intenta ejecutarla por otra vía, es rechazado.
- **H4.7** La adopción solo puede ser rechazada por falta de permiso o por librería inexistente. Adoptar una librería **ya adoptada** no es un rechazo: no duplica nada, informa «ya adoptada» y termina **sin cambios**. Por cada intento rechazado por falta de permiso se genera **un solo** evento (acceso denegado).
- **H4.8** Una vez adoptada por la empresa A, la librería aparece en A y **no** en B, hasta que B la adopte por su cuenta; sus entradas no son visibles para B.
- **H4.9** Al terminar, se informa cuántas entradas quedaron disponibles.
- **H4.10** La adopción es todo o nada: si algo falla a mitad de camino, la empresa queda como estaba antes.

### H5 — Consultar el listado de requisitos

_Como persona de la empresa, quiero ver el listado de requisitos cargados y filtrarlo._

- **H5.1** El listado muestra, por entrada: capítulo, identificador de cláusula, título breve, guía propia, a qué normas y edición aplica y, cuando el identificador difiere entre normas, el identificador que usa **cada** norma.
- **H5.2** Puedo buscar por texto (identificador o título) y filtrar por capítulo (4 a 10) y por norma.
- **H5.3** Una cláusula que no aplica a una norma de las seleccionadas no aparece al filtrar por esa norma.
- **H5.4** Si la empresa aún no adoptó la librería, veo un estado vacío que explica cómo adoptarla (administrador) o a quién pedirlo (colaborador).
- **H5.5** La pantalla indica claramente que es una **librería de ejemplo con guías propias de SynapTech**, no el texto de la norma, y que la referencia oficial es el ejemplar adquirido por la empresa.
- **H5.6** El listado es solo de consulta: no muestra estados de cumplimiento, hallazgos ni evidencias (eso pertenece a la evaluación de cada empresa, no a la librería).
- **H5.7** Cada entrada indica si su contenido de fondo es común a las normas, parcial o específico de alguna, para que nadie asuma que dos normas piden lo mismo por compartir un número.
- **H5.8** La pantalla cumple accesibilidad WCAG 2.2 AA y todos sus textos están en español de Ecuador.

### H6 — Bitácora inmutable

_Como responsable de cumplimiento, quiero que los hechos relevantes queden registrados sin posibilidad de alterarse._

- **H6.1** Cada inicio de sesión exitoso genera un registro con: quién, empresa, cuándo, qué ocurrió.
- **H6.2** Cada intento fallido de inicio de sesión genera un registro **sin guardar la contraseña, el nombre de usuario escrito ni la dirección de red**. Si no se puede determinar la empresa, el registro queda como hecho de **plataforma**.
- **H6.3** Cada cierre de sesión genera un registro.
- **H6.4** Cada adopción de librería genera un registro con quién, empresa, cuándo, librería y versión, y el resultado («adoptada», «ya adoptada, sin cambios» o el motivo del rechazo). Cada carga del catálogo se registra como hecho de plataforma (H4.5).
- **H6.5** Cada acceso denegado por falta de permiso (por ejemplo, un colaborador intentando adoptar) genera un registro.
- **H6.6** Un registro de la bitácora **no se puede modificar ni borrar** por ninguna persona ni función de la aplicación ni de sus roles de ejecución, ni siquiera por un administrador de la aplicación; una prueba automatizada lo intenta y debe fallar. Si alguien con acceso directo al almacenamiento alterara un registro, la alteración es **detectable** mediante una verificación de integridad con estos criterios: (a) la secuencia de registros no tiene huecos; (b) cada registro enlaza con el anterior por una huella; (c) el último valor de la cadena se **ancla periódicamente fuera de la tabla**, de modo que borrar los últimos registros o toda la cadena también se detecta. Se ejecuta de forma periódica y bajo demanda; si falla, genera un evento de plataforma y una alerta. Pruebas automatizadas: alterar un registro, borrar el último y truncar la tabla deben ser detectados.
- **H6.7** Los registros de una empresa no son visibles para otra empresa.
- **H6.8** Si no se puede escribir en la bitácora, la acción que debía registrarse **no se completa**. Esto prevalece sobre «no encontrado»: si falla el registro de un acceso cruzado, la solicitud falla con error en lugar de responder «no encontrado».
- **H6.9** Una sesión que termina por inactividad genera un registro de sesión expirada.
- **H6.10** Un intento de acceder a un objeto de otra empresa genera un registro de acceso cruzado; la persona recibe «no encontrado», indistinguible de un objeto inexistente.
- **H6.11** Una solicitud con credencial vencida, alterada o sin empresa genera un registro de credencial inválida y es rechazada.
- **H6.12** Los cambios de rol, altas y bajas de personas generan un registro, **incluso cuando se hacen fuera de la aplicación** (en el sistema de identidad o en los permisos): el producto los incorpora periódicamente desde esos sistemas, con el retraso máximo de segundos que el plan documente.
- **H6.13** La carga de datos iniciales de prueba (empresas y personas) y cada ejecución de la verificación de integridad generan un registro de plataforma.

## 4. Reglas de negocio

1. Toda persona pertenece a **exactamente una** empresa; la pertenencia la define su cuenta.
2. Toda entidad de negocio lleva su empresa; las librerías globales de normas son de solo lectura para las empresas.
3. Ninguna entrada guarda texto de una norma (regla 3 del proyecto): solo identificador, título breve, guía propia y mapeos, con los límites de H4.2.
4. Una librería se identifica por norma(s), edición y versión; una empresa no la adopta dos veces.
5. Una cláusula declara a qué norma(s) y edición(es) aplica y con qué identificador en cada una; el listado nunca la atribuye a una norma a la que no aplica ni supone que un mismo número significa lo mismo en todas.
6. La reutilización de evidencias entre normas se decide por el mapeo entre control y requisito, no por coincidir el número de cláusula (se construye en un módulo posterior).
7. La librería de ejemplo es **global y de solo lectura**: la empresa la **adopta** y se crean sus propios registros (estado de adopción y bitácora); la carga al catálogo es una operación de plataforma.
8. La bitácora es solo de añadir: sin edición ni borrado.
9. Ante duda sobre la empresa de una solicitud, se deniega.

## 5. Datos y clasificación

Todo lo de esta sección sobre bases de tratamiento, finalidades y plazos son **hipótesis a confirmar por un asesor legal y por el responsable** antes del primer cliente externo; `revisor-cumplimiento` es un control interno, no sustituye ese criterio. Rol de SynapTech frente a la empresa cliente (responsable o encargada del tratamiento): **por confirmar**; si es encargada, las bases las fija la empresa cliente. Quedan abiertos los temas de Q9 a Q11.

| Dato                                                                                         | Clasificación                             | Base (hipótesis)                                                                                                      | Finalidad                                           | Retención (provisional)                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nombre y correo de las personas                                                              | **Personal** (LOPDP)                      | Relación con la empresa cliente (a definir según el rol de SynapTech)                                                 | Identificar a la persona y mostrarla en el producto | Mientras la cuenta esté activa; tras la baja, **política por definir (Q5)**                                                                                                                                                                                                                  |
| Identificador opaco de la persona, empresa, fecha y acción en la bitácora                    | **Personal** (pseudonimizado) + auditoría | Interés legítimo de seguridad y trazabilidad (P15 es un requisito del producto, no una obligación legal identificada) | Demostrar quién hizo qué y cuándo                   | Plazo por definir (Q5). Mientras exista un enlace entre el identificador y la persona sigue siendo dato personal; si al dar de baja se destruye ese enlace, el registro deja de identificar. La compatibilidad entre bitácora inmutable y derecho de supresión **se somete al asesor legal** |
| Datos de identidad que viajan en el token de sesión (identificador, empresa, nombre, correo) | **Personal**                              | Relación con la empresa cliente                                                                                       | Autenticar y asociar la sesión a una empresa        | Solo mientras dura la sesión                                                                                                                                                                                                                                                                 |
| Cookie de sesión                                                                             | **Personal**                              | Relación con la empresa cliente                                                                                       | Mantener la sesión                                  | 30 minutos de inactividad (provisional, Q4)                                                                                                                                                                                                                                                  |
| Eventos del sistema de identidad (intentos fallidos, cambios de rol)                         | **Personal**                              | Interés legítimo de seguridad                                                                                         | Detectar abuso y registrar cambios de acceso        | A la bitácora solo van tipo, fecha, código de error e identificador si existe; **nunca** dirección de red, nombre escrito ni detalles                                                                                                                                                        |
| Estado de adopción de librerías por empresa                                                  | Interno                                   | Relación con la empresa cliente                                                                                       | Saber qué librerías usa la empresa                  | Mientras la empresa sea cliente                                                                                                                                                                                                                                                              |
| Estado anterior y posterior en la bitácora                                                   | Interno (**sin datos personales**)        | Interés legítimo de trazabilidad                                                                                      | Reconstruir el cambio                               | Igual que la bitácora; solo campos permitidos por acción                                                                                                                                                                                                                                     |
| Identidad de quien opera la plataforma y carga el catálogo                                   | **Personal** (personal de SynapTech)      | Relación laboral o contractual con SynapTech                                                                          | Trazabilidad de las cargas                          | Igual que la bitácora                                                                                                                                                                                                                                                                        |
| Trazas técnicas de la aplicación                                                             | Interno                                   | Interés legítimo                                                                                                      | Diagnóstico                                         | 14 días (provisional); **sin dirección de red, sin credenciales ni tokens, sin nombres ni correos**                                                                                                                                                                                          |
| Dirección de red desde donde se ingresa                                                      | **Personal**                              | —                                                                                                                     | —                                                   | **No se registra** en este corte (Q3)                                                                                                                                                                                                                                                        |
| Contraseñas                                                                                  | **Secreto**                               | —                                                                                                                     | —                                                   | Nunca se guardan en el producto ni en la bitácora                                                                                                                                                                                                                                            |
| Marca de la empresa (nombre, color, logo)                                                    | Interno                                   | Relación con la empresa cliente                                                                                       | Personalizar la interfaz                            | Mientras la empresa sea cliente                                                                                                                                                                                                                                                              |
| Librería de ejemplo (cláusulas, títulos breves, guías propias)                               | Público de SynapTech                      | —                                                                                                                     | —                                                   | Versionada; no se borra una versión publicada                                                                                                                                                                                                                                                |

## 6. Impacto multiempresa

Es el corazón de este corte.

- El catálogo de librerías es **global y de solo lectura**. Pertenecen a una empresa su adopción de librerías, su marca, su visibilidad de las entradas y sus registros de bitácora; solo los hechos de plataforma (carga de catálogo, intentos fallidos sin empresa conocida) no tienen empresa.
- Prueba obligatoria de aislamiento con dos empresas (H2.5), incluida la lectura directa por identificador, la dirección web alterada y las consultas sin empresa.
- La marca y la información de una empresa no viajan al navegador de otra, ni siquiera como estilos o archivos que el usuario no usa.

## 7. Impacto en la bitácora (P15)

Esta funcionalidad **crea** la bitácora. Cada evento lleva: quién (tipo de actor e identificador opaco), empresa (o «plataforma» si no aplica), cuándo (fijado por el sistema, no por quien actúa), qué, sobre qué objeto, resultado y motivo, y un identificador de correlación. Los que cambian datos llevan también estado anterior y posterior, solo con campos permitidos y **sin datos personales**.

| Evento                                | Cuándo se registra                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Inicio de sesión                      | Ingreso exitoso                                                                                      |
| Intento fallido de inicio de sesión   | Credenciales inválidas (sin contraseña, sin nombre tecleado, sin dirección de red)                   |
| Cierre de sesión                      | Cierre voluntario                                                                                    |
| Sesión expirada                       | Fin por inactividad                                                                                  |
| Librería adoptada                     | Adopción exitosa, o «ya adoptada» sin cambios                                                        |
| Acceso denegado                       | Falta de permiso para una acción (único evento por intento)                                          |
| Acceso cruzado                        | Intento de acceder a un objeto de otra empresa (la persona recibe «no encontrado»)                   |
| Credencial o token inválido           | Solicitud con credencial vencida, alterada o sin empresa                                             |
| Catálogo cargado / rechazado          | Carga de plataforma de una librería                                                                  |
| Cambio de rol, alta o baja de persona | Cambios de acceso, incluidos los hechos fuera de la aplicación (se incorporan periódicamente, H6.12) |
| Datos iniciales cargados              | Siembra de empresas y personas de prueba                                                             |
| Verificación de integridad            | Cada ejecución y, si falla, la alerta                                                                |

Reglas: no hay «desadopción» en este corte, por eso no existe evento de eliminación. La acción y su registro ocurren juntos (si no se puede registrar, la acción no se completa); si falla el registro de un rechazo, la solicitud falla con error y no se oculta.

## 8. Impacto de IA

Ninguno. No hay contenido generado por IA en este corte. El caso de uso de IA sobre esta librería llega en el paso 0.7.

## 9. Fuera de alcance

- Edición de la marca por la propia empresa.
- Evaluar el cumplimiento de cada requisito (cumple / parcial / no cumple), controles, evidencias y mapeos entre normas.
- Pantalla de consulta de la bitácora para personas usuarias (se verifica por prueba automatizada).
- Roles distintos de administrador SIG y colaborador; permisos por objeto; acceso temporal de auditor externo.
- Alta de empresas y de usuarios desde la interfaz (en el corte son datos iniciales de prueba).
- Recuperación de contraseña, doble factor, federación con proveedores externos de cada cliente.
- Importación de librerías por parte de la empresa desde su propio archivo, y librerías propias por empresa.
- Desadopción de una librería (por eso no hay evento de eliminación).
- Móvil y funcionamiento sin conexión.

## 10. Preguntas abiertas

| #   | Pregunta                                                                                                                                                                                  | Supuesto usado en este spec                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Q1  | ~~¿Global con adopción por empresa, o una copia por empresa?~~ **Resuelta:** global y de solo lectura; cada empresa la adopta.                                                            | Resuelta por el plan (2026-11-04).                                                                                           |
| Q2  | ¿Qué debe ver cada empresa de prueba: los mismos requisitos o conjuntos distintos para que el aislamiento sea evidente a simple vista?                                                    | Misma librería; la diferencia visible son los datos de empresa, la marca y el estado «cargada / no cargada».                 |
| Q3  | ¿Se registra la dirección de red en la bitácora? Ayuda a seguridad pero es dato personal.                                                                                                 | No se registra en este corte.                                                                                                |
| Q4  | ¿Cuál es el tiempo máximo de inactividad de una sesión?                                                                                                                                   | 30 minutos, a confirmar.                                                                                                     |
| Q5  | ¿Cuánto tiempo se conserva la bitácora y qué se hace con los datos personales al dar de baja a una persona?                                                                               | Sin borrado en este corte; la política se define con asesor legal y `revisor-cumplimiento` antes del primer cliente externo. |
| Q6  | ¿El administrador SIG de una empresa puede ver las cargas de su empresa, o es una función solo de plataforma de SynapTech?                                                                | Solo se verifica por prueba automatizada (fuera de alcance como pantalla).                                                   |
| Q7  | ¿Quién verifica la numeración de cada norma contra los ejemplares adquiridos antes de fijar la librería? `experto-iso` lo señala sobre todo en el capítulo 10.                            | El responsable la verifica con sus ejemplares; mientras tanto el capítulo 10 se modela por tema (ver sección 11).            |
| Q8  | ¿Se ajusta la definición de «Estructura Armonizada» del glosario para aclarar que lo compartido es el esqueleto y gran parte de los apartados, no todos los subapartados ni su contenido? | Sí; se propone como cambio de documentación aparte.                                                                          |
| Q9  | ¿Hay transferencia internacional de datos personales (alojamiento o servicios fuera de Ecuador) y qué exige la LOPDP?                                                                     | Sin transferencias en este corte (todo local); validar con asesor legal.                                                     |
| Q10 | ¿Se necesita registro de actividades de tratamiento y procedimiento de notificación de brechas, y a cargo de quién?                                                                       | Pendiente; se resuelve con el asesor legal y el delegado de protección de datos antes del primer cliente externo.            |
| Q11 | ¿Cuál es el procedimiento y quién atiende los derechos de las personas titulares (acceso, rectificación, supresión, oposición)?                                                           | Pendiente; ver ADR de privacidad (tarea 3.1).                                                                                |

## 11. Contenido de la librería de ejemplo

Validado por `experto-iso`. Las numeraciones salen de su conocimiento de las normas y **deben verificarse contra los ejemplares vigentes antes de fijarlas** (Q7).

**Principios**

- Es una librería **sintética de ejemplo**, no una edición oficial de ninguna norma. Se identifica como «Ejemplo de Estructura Armonizada» y declara a qué normas y ediciones hace referencia: ISO 9001, ISO/IEC 27001:2022 e ISO/IEC 42001:2023.
- Solo primer nivel de cláusula. Quedan fuera los subapartados, el contenido específico del capítulo 8 más allá de 8.1, el Anexo A de 27001 y los anexos de 42001.
- Los títulos son descriptivos y propios; las guías tienen como máximo **dos frases y 280 caracteres**, con palabras de SynapTech.

**Entradas previstas (21)**

| Capítulo                   | Cláusulas / temas                                                                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4 Contexto                 | 4.1, 4.2, 4.3, 4.4                                                                                                                                               |
| 5 Liderazgo                | 5.1, 5.2, 5.3                                                                                                                                                    |
| 6 Planificación            | 6.1, 6.2, 6.3                                                                                                                                                    |
| 7 Apoyo                    | 7.1, 7.2, 7.3, 7.4, 7.5                                                                                                                                          |
| 8 Operación                | 8.1 (el contenido posterior difiere por norma)                                                                                                                   |
| 9 Evaluación del desempeño | 9.1, 9.2, 9.3                                                                                                                                                    |
| 10 Mejora                  | Dos temas: «Mejora» y «No conformidad y acción correctiva», cada uno con el identificador que le da **cada** norma (el orden de 10.1 a 10.3 difiere entre ellas) |

**Datos mínimos por entrada**

- Identificador estable propio de la librería (no depende de la numeración de una norma).
- Capítulo y nivel.
- Título breve y guía propia.
- Para cada norma a la que aplica: norma, edición e identificador de cláusula en esa norma.
- Alcance común: común, parcial o específico.

**Datos mínimos de la librería**

- Nombre, versión, y marca de ejemplo.
- Alcance global (no pertenece a una empresa).
- Fuente: elaboración propia de SynapTech.

**Observaciones de dominio que este spec respeta**

- El ejemplo no debe presentarse como el texto ni los requisitos oficiales (H5.5).
- Una cláusula puede contener varios requisitos evaluables; en este corte cada entrada es un apartado, y su posible descomposición queda para el módulo de normas y requisitos.
- 9.2 y 9.3 son prerrequisitos de la auditoría de Etapa 2, pero este corte **no** implementa esa regla.
- La verificación final de los títulos la hace `revisor-cumplimiento` en `/plan` y `/review`.
