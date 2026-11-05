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

| Rol                                  | Qué puede hacer en este corte                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| Administrador SIG de una empresa     | Iniciar sesión, cargar la librería de ejemplo para su empresa, consultar el listado. |
| Colaborador de una empresa           | Iniciar sesión y consultar el listado. No puede cargar la librería.                  |
| Persona sin cuenta o de otra empresa | No puede ver nada de la empresa A ni de la empresa B sin pertenecer a ella.          |

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

### H4 — Cargar la librería de ejemplo

_Como administrador SIG, quiero cargar la librería de ejemplo de la Estructura Armonizada para que mi empresa disponga de sus requisitos._

- **H4.1** Solo el administrador SIG ve y puede usar la acción de cargar; un colaborador no la ve y, si intenta ejecutarla por otra vía, es rechazado.
- **H4.2** La carga lee un archivo de librería y lo **valida** contra su definición de formato antes de guardar nada; si es inválido, no se guarda **ningún** registro y se muestra qué entradas fallaron y por qué.
- **H4.3** La carga **rechaza** y no guarda cualquier entrada cuya guía parezca texto copiado de una norma (control de derechos de autor): ninguna entrada guarda más que identificador, título breve, guía propia y mapeos.
- **H4.4** Cargar dos veces la misma librería y edición no duplica registros: la segunda carga informa «ya cargada» sin cambios.
- **H4.5** Una vez cargada por la empresa A, la librería aparece en A y **no** en B, hasta que B la cargue por su cuenta.
- **H4.6** Al terminar, se informa cuántas entradas se cargaron.
- **H4.7** La carga es todo o nada: si ocurre un fallo a mitad de camino, la empresa queda como estaba antes.

### H5 — Consultar el listado de requisitos

_Como persona de la empresa, quiero ver el listado de requisitos cargados y filtrarlo._

- **H5.1** El listado muestra, por entrada: capítulo, identificador de cláusula, título breve, guía propia, a qué normas y edición aplica y, cuando el identificador difiere entre normas, el identificador que usa **cada** norma.
- **H5.2** Puedo buscar por texto (identificador o título) y filtrar por capítulo (4 a 10) y por norma.
- **H5.3** Una cláusula que no aplica a una norma de las seleccionadas no aparece al filtrar por esa norma.
- **H5.4** Si la empresa aún no cargó la librería, veo un estado vacío que explica cómo cargarla (administrador) o a quién pedirlo (colaborador).
- **H5.5** La pantalla indica claramente que es una **librería de ejemplo con guías propias de SynapTech**, no el texto de la norma, y que la referencia oficial es el ejemplar adquirido por la empresa.
- **H5.6** El listado es solo de consulta: no muestra estados de cumplimiento, hallazgos ni evidencias (eso pertenece a la evaluación de cada empresa, no a la librería).
- **H5.7** Cada entrada indica si su contenido de fondo es común a las normas, parcial o específico de alguna, para que nadie asuma que dos normas piden lo mismo por compartir un número.
- **H5.8** La pantalla cumple accesibilidad WCAG 2.2 AA y todos sus textos están en español de Ecuador.

### H6 — Bitácora inmutable

_Como responsable de cumplimiento, quiero que los hechos relevantes queden registrados sin posibilidad de alterarse._

- **H6.1** Cada inicio de sesión exitoso genera un registro con: quién, empresa, cuándo, qué ocurrió.
- **H6.2** Cada intento fallido de inicio de sesión genera un registro **sin guardar la contraseña ni datos que permitan reconstruirla**.
- **H6.3** Cada cierre de sesión genera un registro.
- **H6.4** Cada carga de librería genera un registro con quién, empresa, cuándo, librería y edición, y cuántas entradas se cargaron o por qué se rechazó. Una carga rechazada también se registra.
- **H6.5** Cada acceso denegado por falta de permiso (por ejemplo, un colaborador intentando cargar) genera un registro.
- **H6.6** Un registro de la bitácora **no se puede modificar ni borrar** por ninguna persona ni función de la aplicación, ni siquiera por un administrador; una prueba automatizada lo intenta y debe fallar.
- **H6.7** Los registros de una empresa no son visibles para otra empresa.
- **H6.8** Si no se puede escribir en la bitácora, la acción que debía registrarse **no se completa**.

## 4. Reglas de negocio

1. Toda persona pertenece a **exactamente una** empresa; la pertenencia la define su cuenta.
2. Toda entidad de negocio lleva su empresa; las librerías globales de normas son de solo lectura para las empresas.
3. Ninguna entrada guarda texto de una norma (regla 3 del proyecto): solo identificador, título breve, guía propia y mapeos.
4. Una librería se identifica por norma(s) y edición; la misma librería no se carga dos veces en una empresa.
5. Una cláusula declara a qué norma(s) y edición(es) aplica y con qué identificador en cada una; el listado nunca la atribuye a una norma a la que no aplica ni supone que un mismo número significa lo mismo en todas.
6. La reutilización de evidencias entre normas se decide por el mapeo entre control y requisito, no por coincidir el número de cláusula (se construye en un módulo posterior).
7. La librería de ejemplo es **global y de solo lectura**: «cargar» significa que la empresa la adopta y se crean sus propios registros (estado de carga y bitácora).
8. La bitácora es solo de añadir: sin edición ni borrado.
9. Ante duda sobre la empresa de una solicitud, se deniega.

## 5. Datos y clasificación

| Dato                                                                | Clasificación            | Observaciones                                                           |
| ------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------- |
| Nombre y correo de las personas                                     | **Personal** (LOPDP)     | Se guardan solo los necesarios para identificar y mostrar a la persona. |
| Identificador de la persona, empresa, fecha y acción en la bitácora | **Personal** + auditoría | Se conserva según la política de retención (pregunta Q5).               |
| Dirección de red desde donde se ingresa                             | **Personal**             | Solo si se decide registrar (pregunta Q3).                              |
| Contraseñas                                                         | **Secreto**              | Nunca se guardan en el producto ni en la bitácora.                      |
| Marca de la empresa (nombre, color, logo)                           | Interno                  |                                                                         |
| Librería de ejemplo (cláusulas, títulos breves, guías propias)      | Público de SynapTech     | Contenido original; sin texto de normas.                                |

## 6. Impacto multiempresa

Es el corazón de este corte.

- Toda entrada cargada, toda configuración de marca y todo registro de bitácora pertenece a una empresa.
- Prueba obligatoria de aislamiento con dos empresas (H2.5), incluida la lectura directa por identificador, la dirección web alterada y las consultas sin empresa.
- La marca y la información de una empresa no viajan al navegador de otra, ni siquiera como estilos o archivos que el usuario no usa.

## 7. Impacto en la bitácora (P15)

Esta funcionalidad **crea** la bitácora. Eventos del corte: inicio de sesión (éxito y fallo), cierre de sesión, carga de librería (éxito y rechazo), acceso denegado. Cada evento lleva quién, empresa, cuándo, qué y resultado; los de cambio de datos llevan también estado anterior y posterior cuando existan.

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
- Móvil y funcionamiento sin conexión.

## 10. Preguntas abiertas

| #   | Pregunta                                                                                                                                  | Supuesto usado en este spec                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Q1  | ¿La librería de ejemplo es global (una sola copia) y «cargar» significa que cada empresa la **adopta**, o se carga una copia por empresa? | Se adopta por empresa (da datos propios de la empresa y permite probar el aislamiento).                       |
| Q2  | ¿Qué debe ver cada empresa de prueba: los mismos requisitos o conjuntos distintos para que el aislamiento sea evidente a simple vista?    | Misma librería; la diferencia visible son los datos de empresa, la marca y el estado «cargada / no cargada».  |
| Q3  | ¿Se registra la dirección de red en la bitácora? Ayuda a seguridad pero es dato personal.                                                 | No se registra en este corte.                                                                                 |
| Q4  | ¿Cuál es el tiempo máximo de inactividad de una sesión?                                                                                   | 30 minutos, a confirmar.                                                                                      |
| Q5  | ¿Cuánto tiempo se conserva la bitácora y qué se hace con los datos personales al dar de baja a una persona?                               | Sin borrado en este corte; la política se define con `revisor-cumplimiento` antes del primer cliente externo. |
| Q6  | ¿El administrador SIG de una empresa puede ver las cargas de su empresa, o es una función solo de plataforma de SynapTech?                | Solo se verifica por prueba automatizada (fuera de alcance como pantalla).                                    |
| Q7  | ¿Quién verifica la numeración de cada norma contra los ejemplares adquiridos antes de fijar la librería? `experto-iso` lo señala sobre todo en el capítulo 10. | El responsable la verifica con sus ejemplares; mientras tanto el capítulo 10 se modela por tema (ver sección 11). |
| Q8  | ¿Se ajusta la definición de «Estructura Armonizada» del glosario para aclarar que lo compartido es el esqueleto y gran parte de los apartados, no todos los subapartados ni su contenido? | Sí; se propone como cambio de documentación aparte. |

## 11. Contenido de la librería de ejemplo

Validado por `experto-iso`. Las numeraciones salen de su conocimiento de las normas y **deben verificarse contra los ejemplares vigentes antes de fijarlas** (Q7).

**Principios**
- Es una librería **sintética de ejemplo**, no una edición oficial de ninguna norma. Se identifica como «Ejemplo de Estructura Armonizada» y declara a qué normas y ediciones hace referencia: ISO 9001, ISO/IEC 27001:2022 e ISO/IEC 42001:2023.
- Solo primer nivel de cláusula. Quedan fuera los subapartados, el contenido específico del capítulo 8 más allá de 8.1, el Anexo A de 27001 y los anexos de 42001.
- Los títulos son descriptivos y propios; las guías tienen como máximo dos frases con palabras de SynapTech.

**Entradas previstas (21)**

| Capítulo | Cláusulas / temas |
| --- | --- |
| 4 Contexto | 4.1, 4.2, 4.3, 4.4 |
| 5 Liderazgo | 5.1, 5.2, 5.3 |
| 6 Planificación | 6.1, 6.2, 6.3 |
| 7 Apoyo | 7.1, 7.2, 7.3, 7.4, 7.5 |
| 8 Operación | 8.1 (el contenido posterior difiere por norma) |
| 9 Evaluación del desempeño | 9.1, 9.2, 9.3 |
| 10 Mejora | Dos temas: «Mejora» y «No conformidad y acción correctiva», cada uno con el identificador que le da **cada** norma (el orden de 10.1 a 10.3 difiere entre ellas) |

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
