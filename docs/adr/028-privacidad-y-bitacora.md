# ADR 028 — Privacidad y bitácora: identificador opaco, retención y derechos de las personas

- **Estado:** Aprobado como **provisional** (2026-11-08) por el responsable; **pendiente de validación por un asesor legal**. Lo que afirma sobre bases de tratamiento, plazos y derechos sigue siendo una hipótesis de trabajo; los puntos de «No resuelto» bloquean el uso con datos de personas reales (incluido el personal de SynapTech) y, en todo caso, al primer cliente externo.
- **Fecha:** 2026-11-05
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

La bitácora es **inmutable** (P15): nada se edita ni se borra. La Ley Orgánica de Protección de Datos Personales (LOPDP) de Ecuador reconoce a las personas derechos sobre sus datos. Se asume que entre ellos está el de supresión, pero **no se ha verificado su alcance exacto**. Ambas exigencias chocan si la bitácora guarda datos que identifican a una persona.

Este ADR fija cómo se diseña para que la tensión sea mínima y deja explícito lo que **no** está resuelto. **No es asesoría legal:** todo lo que afirma sobre bases de tratamiento, plazos, derechos y obligaciones de registro es una **hipótesis de trabajo** que debe validar un asesor legal (spec del corte 0.6, §5 y preguntas Q5, Q9, Q10 y Q11).

## Decisión

### 1. La bitácora no guarda datos que identifiquen a la persona

- Cada registro lleva: el **identificador opaco** de la cuenta (UUID del sistema de identidad), el tipo de actor, la empresa, la acción, el objeto, la versión o huella del objeto, el resultado, un **código de motivo**, un identificador de correlación y un identificador de origen (para no repetir eventos).
- Casos sin identificador de persona: un `login.fallido` de una cuenta que no existe (no hay identificador) y los hechos de plataforma o de procesos automáticos. El tipo de actor puede ser usuario, sistema, proceso de sincronización o personal de plataforma.
- **Nunca** se guardan: nombre, correo, contraseña, dirección de red (Q3), nombre de usuario tecleado ni los detalles de eventos del sistema de identidad.
- **Lista blanca de claves y de valores.** `antes` y `despues` admiten solo claves permitidas por acción, y los valores son de tipo cerrado (números, estados, identificadores o códigos), nunca texto libre. El `motivo` es un **código de una lista cerrada**, no un texto. Una clave o un valor fuera de la lista se **rechaza al escribir** (requisito para la tarea 3.4).
- La lista concreta de claves permitidas por acción se define en la tarea 3.4 y se entrega al asesor legal.
- El nombre y el correo viven únicamente en la tabla `usuario` (mutable, por empresa, con RLS).

### 2. Pseudonimización con destrucción del enlace (diseño previsto)

- El identificador opaco **pseudonimiza**; no anonimiza. Mientras exista un enlace entre el identificador y la persona sigue siendo dato personal.
- **Previsto, no existe en el corte 0.6:** al dar de baja a una persona se eliminaría su cuenta en el sistema de identidad y se anonimizaría su fila de `usuario`, conservando el identificador para la integridad referencial. Con el enlace destruido, se **pretende** que el identificador deje de identificar a alguien. Que lo logre es una hipótesis, no un hecho.
- Los valores de anonimización **no pueden ser derivables** de los datos originales (por ejemplo, un resumen criptográfico del correo permitiría reconstruir el enlace por fuerza bruta).
- **Ubicaciones donde puede subsistir el enlace** (cada una necesita una decisión antes de datos reales):

| Ubicación                                    | Qué conserva                                                       | Qué hacer (a decidir)                                            |
| -------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Almacén de usuarios del sistema de identidad | Nombre, correo, identificador                                      | Se elimina la cuenta al dar de baja                              |
| Eventos del sistema de identidad             | Identificador, y posiblemente nombre de usuario y dirección de red | Limitar su conservación; la bitácora copia solo una lista blanca |
| Tuplas de autorización                       | Identificador y rol                                                | Se eliminan al dar de baja                                       |
| `empresa_libreria.adoptada_por`              | Identificador                                                      | Queda con el enlace ya destruido                                 |
| Respaldos de la base                         | Todo lo anterior                                                   | Definir el plazo de los respaldos                                |
| Trazas técnicas                              | Sin datos personales por diseño                                    | Verificar                                                        |

- **Riesgo de reidentificación:** en una empresa con pocas personas, la combinación de empresa, fecha y acción podría identificar a alguien aunque el identificador no tenga enlace.

### 3. Bases de tratamiento (hipótesis a validar)

Se desconoce si la LOPDP prevé el «interés legítimo» como base de tratamiento y con qué requisitos (por ejemplo, una ponderación). La columna de base es una **propuesta**, no una afirmación.

| Tratamiento                                                | Base propuesta                               | Observación                                                                |
| ---------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------- |
| Cuenta, nombre y correo                                    | Relación con la empresa cliente              | Si SynapTech es **encargada**, la base la fija la empresa cliente          |
| Datos del token y cookie de sesión                         | Relación con la empresa cliente              | Solo mientras dura la sesión                                               |
| Bitácora con identificador opaco                           | Interés legítimo de seguridad y trazabilidad | P15 es un requisito del producto, **no** una obligación legal identificada |
| `antes` y `despues` de la bitácora                         | Interés legítimo de trazabilidad             | Sin datos personales por diseño                                            |
| Eventos de seguridad del sistema de identidad              | Interés legítimo de seguridad                | Solo se copian tipo, fecha, código de error e identificador                |
| Identidad del personal de plataforma que carga el catálogo | Relación laboral o contractual con SynapTech | Dato personal de personal de SynapTech                                     |
| Trazas técnicas                                            | Interés legítimo                             | Sin datos personales por diseño                                            |

El **rol de SynapTech** frente a cada empresa cliente (responsable o encargada del tratamiento) queda **por definir** y condiciona toda la tabla.

### 4. Retención (sin plazo propuesto)

No se propone un plazo para la bitácora: no existe respaldo normativo verificado y el spec lo deja «por definir» (Q5).

| Dato            | Plazo                                                                                |
| --------------- | ------------------------------------------------------------------------------------ |
| Bitácora        | **Sin plazo propuesto** (hipótesis de trabajo por validar)                           |
| Nombre y correo | Mientras la cuenta esté activa; tras la baja, por definir                            |
| Sesión          | 30 minutos de inactividad (Q4, provisional)                                          |
| Trazas técnicas | 14 días, provisional, sin dirección de red, credenciales, tokens, nombres ni correos |

**Incompatibilidad del diseño actual:** la bitácora es solo de añadir, sin borrado ni truncado, con secuencia sin huecos y encadenada por huellas. Con ese diseño **no puede cumplir ningún plazo de retención**: no hay forma de expirar registros antiguos sin romper la verificación. Cumplir un plazo exigiría un mecanismo que hoy no existe (por ejemplo, particiones con cortes de cadena y ancla). Tampoco está definido qué ocurre con los registros de una empresa que deja de ser cliente.

### 5. Derechos de las personas (asumidos, a validar)

La lista de derechos se **asume** y debe contrastarse con la ley. El spec (Q11) nombra acceso, rectificación, supresión y oposición; «suspensión» y «portabilidad» no están confirmados.

| Derecho                       | Propuesta, pendiente de dictamen                                                                                                                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acceso                        | Copia de los datos de `usuario` y de los registros de bitácora ligados a su identificador. Tras la anonimización ya no se podrá ligar a la persona con su identificador                                        |
| Rectificación y actualización | Se corrigen nombre y correo en `usuario`                                                                                                                                                                       |
| Supresión                     | Se anonimizaría `usuario` y se eliminaría la cuenta; la bitácora se conservaría con el identificador ya sin enlace, por seguridad y trazabilidad. **Si el asesor lo rechaza, no hay alternativa implementada** |
| Oposición                     | Caso por caso; no hay tratamiento automatizado con efectos sobre la persona en este corte (supuesto)                                                                                                           |
| Suspensión, portabilidad      | No confirmados; se evaluarán con el asesor                                                                                                                                                                     |

- **Verificación de identidad:** quien solicita debe acreditar su identidad antes de entregar o modificar nada; el procedimiento se define con el asesor.
- **Quién ejecuta la consulta:** el acceso a la bitácora lo hace de forma manual el responsable de plataforma con el rol dueño de la base de datos, y se registra. No hay pantalla de consulta para personas usuarias en 0.6.
- **Canal y plazo de respuesta:** por definir. No se afirma aquí un plazo legal.
- **Responsable de atenderlos:** a designar. Se debe preguntar si la ley exige a SynapTech la figura de delegado de protección de datos. Mientras no exista, el responsable del proyecto recibe las solicitudes y las escala.

### 6. Otros puntos abiertos

- **Transferencia internacional (Q9):** en el corte 0.6 el desarrollo es local y el CI usa solo datos de prueba. El despliegue, y cualquier servicio fuera de Ecuador (nube, IA externa), exigen evaluación previa. Falta decidir **dónde se guarda el ancla** de la cadena de la bitácora, porque si está en un tercero o fuera de Ecuador afecta a este punto.
- **Registro de actividades de tratamiento y notificación de brechas (Q10):** pendientes; no se afirma qué exige la ley.
- **Datos sensibles:** se asume que el producto no los trata en este corte; es un supuesto sin otro respaldo en el spec.
- **Transparencia:** falta definir cómo se informa a las personas del tratamiento de sus datos (aviso de privacidad).

## No resuelto

1. Si anonimizar `usuario` y eliminar la cuenta basta para atender la supresión cuando la bitácora conserva el identificador, considerando las copias de la tabla anterior y el riesgo de reidentificación.
2. Si conservar la bitácora tiene una base jurídica sólida (interés legítimo o una obligación legal) y por cuánto tiempo.
3. Cómo expirar registros de una bitácora inmutable y encadenada sin romper su verificación.
4. El rol de SynapTech (responsable o encargada) y quién decide cada base.
5. Plazos legales para responder a las personas y para notificar brechas.
6. Si hace falta una evaluación de impacto o consultar a la autoridad (se pregunta, no se afirma).

**Ventana barata para cambiar el esquema.** Si el asesor exige un seudónimo distinto (por ejemplo, un identificador con clave por persona, o cifrado con destrucción de la clave), conviene decidirlo **antes de escribir datos reales**: los registros ya escritos con el identificador en claro no se pueden reconvertir sin romper la cadena. Mientras la bitácora solo contenga datos de prueba o de siembra, el cambio es barato.

**Cuándo bloquean.** Estos puntos bloquean el **uso con datos de personas reales**, incluido el personal de SynapTech, y en todo caso al primer cliente externo. Hasta entonces el sistema se usa únicamente con datos de prueba.

## Insumos para el asesor legal

Preguntas que el asesor necesita poder responder, y qué se le entregará:

1. ¿Qué flujos y proveedores intervienen? Se entregará el inventario: sistema de identidad, base de datos, autorización, respaldos, ubicación y roles con acceso a la bitácora.
2. ¿Es suficiente el diseño de identificador opaco con tabla `usuario` anonimizable? Se entregará la lista de claves permitidas por acción (tarea 3.4).
3. ¿Qué base de tratamiento corresponde a cada tratamiento y quién la fija según el rol de SynapTech?
4. ¿Cuánto tiempo puede o debe conservarse la bitácora y cómo se expira?
5. ¿Qué debe informarse a las personas y cómo?
6. ¿Es obligatoria la figura del delegado, el registro de actividades y una evaluación de impacto?
7. ¿Qué plazos aplican a las solicitudes de las personas y a las brechas?

## Alternativas consideradas

- **Bitácora con nombre y correo y borrado selectivo:** rompe la inmutabilidad y la cadena de huellas. Descartada.
- **Cifrado por persona con destrucción de la clave:** hace irrecuperables los datos de una persona sin tocar la bitácora. Es más fuerte, pero añade gestión de claves; queda como opción a evaluar **antes de datos reales** (ver «Ventana barata»).
- **Bitácora sin identificador de la persona:** elimina el problema, pero pierde la trazabilidad de quién hizo qué (P15). Descartada.

## Estándar y licencia

- Marco: LOPDP de Ecuador. Referencia de buenas prácticas: ISO/IEC 27701 (solo como orientación; sin reproducir su texto).
- Licencia: no aplica (decisión de diseño).

## Consecuencias

- Las tareas de la bitácora (3.2 a 3.6) implementan la lista blanca de claves y valores, el motivo codificado y la ausencia de datos personales; el identificador es el único dato de persona que se escribe.
- Implementado (migraciones 0003 y 0004): bitácora de solo añadir con encadenado por huellas por empresa, secuencia sin huecos y anclas en una tabla aparte. **Límite:** lo borrado o reescrito entre dos anclas no se detecta, y las anclas están en la misma base de datos; falta decidir un lugar externo para copiarlas (ver «Otros puntos abiertos»).
- Falta construir la anonimización de `usuario`, la exportación de datos y un mecanismo de expiración; no entran en el corte 0.6 y quedan como pendientes registrados.
- Con el diseño actual la bitácora no cumple ningún plazo de retención; hay que decidir el mecanismo antes de usar datos reales.
- Antes de cualquier dato de personas reales hay que cerrar los puntos de «No resuelto» con un asesor legal.
- Esta decisión se revisa si cambia el rol de SynapTech o la normativa.

## Criterio de tecnología mayoritaria (P12)

Se prioriza tecnología con soporte largo y talento disponible; las excepciones se justifican arriba.
