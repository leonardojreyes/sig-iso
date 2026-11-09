# Spec — Puerto de IA: explicar la evidencia típica de un requisito con el modelo que la empresa permite

- **Estado:** Aprobado por el responsable el 2026-11-09 (revisado por `experto-iso`; Q1 a Q12 con la propuesta por omisión)
- **Paso:** 0.7 de la Fase 0
- **Fecha:** 2026-11-09

## 1. Problema

El producto promete un asistente de IA «local, elegible por empresa y por persona, y siempre como borrador que aprueba un humano», pero hoy no existe ninguna pieza de IA. Antes de construir asistentes sobre riesgos, hallazgos o documentos hay que demostrar, con un caso pequeño y de bajo riesgo, que:

1. la IA se consume por **una sola puerta** y el modelo se puede cambiar **sin tocar el caso de uso**;
2. cada empresa decide **qué modelos se permiten** y, por omisión, **nada sale de la infraestructura**;
3. cada consulta queda **medida y registrada** sin guardar lo que se preguntó ni lo que se respondió;
4. todo lo generado se presenta como **borrador generado por IA**, nunca como un hecho.

El caso de prueba usa solo contenido que ya es público dentro del producto (la librería de ejemplo), para que el riesgo sea mínimo mientras se valida la puerta.

## 2. Usuarios y roles

| Rol                              | Qué puede hacer en este paso                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Administrador SIG de una empresa | Pedir la explicación de un requisito y elegir entre los modelos que su empresa permite.                   |
| Colaborador de una empresa       | Lo mismo (ver Q1).                                                                                        |
| Plataforma (SynapTech)           | Publica el catálogo de modelos y fija la política de cada empresa (sin pantalla; ver «Fuera de alcance»). |

Los demás roles no tienen funcionalidad propia aquí. Empresas de prueba: **A** y **B**, con políticas **distintas** para que el aislamiento sea evidente (ver Q4).

## 3. Historias y criterios de aceptación

### H1 — Pedir la explicación de un requisito

_Como persona de la empresa, quiero pedir que se me explique con palabras propias qué evidencia típica demuestra un requisito, para entender qué preparar._

- **H1.1** Cada entrada del listado de requisitos ofrece la acción «Explicar ejemplos de evidencia». (En la interfaz no se usa «evidencia» a secas: en el producto es un registro con responsable, vigencia y huella.)
- **H1.2** Al pedirla, veo la respuesta en la misma pantalla, en español de Ecuador, sin salir del listado.
- **H1.3** La respuesta lleva, siempre y de forma visible, el rótulo **«Borrador generado por IA»**, el nombre del modelo que la generó y un aviso con tres ideas: (a) debe contrastarse con el ejemplar de la norma adquirido por la empresa; (b) los ejemplos son **prácticas habituales, no requisitos**, y la norma no exige necesariamente cada uno; (c) qué evidencia se acepta lo decide el auditor de certificación según el contexto de la empresa.
- **H1.4** Mientras se espera veo un estado de «generando»; si pasan **60 segundos** sin respuesta (Q5) veo un mensaje claro y puedo reintentar.
- **H1.5** Si ningún modelo permitido está disponible, veo un mensaje en lenguaje llano, sin detalles técnicos, y el resto de la pantalla sigue funcionando.
- **H1.6** Al modelo solo se le envía la norma y edición consultadas, el identificador de la cláusula, su título breve y la guía propia de la librería. **No se envía nada de la empresa** (ni su nombre, ni marca, ni datos de personas, ni texto escrito libremente por quien consulta).
- **H1.7** La respuesta no incluye texto literal de las normas: se presenta como orientación redactada con palabras propias. Se considera cumplido cuando la verificación de contenido de las librerías (los mismos detectores: tono normativo, citas largas y enlaces; **sin** los límites de largo y de formato, que son de las guías breves) devuelve **cero coincidencias** sobre la respuesta; el control principal contra paráfrasis cercanas es la muestra de revisión humana (§8); si devuelve alguna, la respuesta no se muestra, se informa a la persona y se registra el rechazo (Q10).
- **H1.8** La respuesta se muestra como texto: nunca se interpreta como contenido activo de la página.
- **H1.9** La acción y la respuesta cumplen WCAG 2.2 AA (el estado de «generando» y el resultado se anuncian a tecnologías de apoyo; el botón se maneja con teclado).
- **H1.10** Cada ejemplo se presenta como «posible evidencia» o equivalente, **nunca** como algo que la empresa «debe tener»; y no son más de cinco, solo los que se deriven de la guía de la librería (no se inventan).
- **H1.11** Se explica **una** norma por vez: la solicitud indica norma y edición (entre las que aplica la entrada) y la respuesta las indica con la cláusula de esa norma. Si el requisito tiene alcance **parcial o específico** entre normas (H5.7 del corte 0.6), la respuesta lo advierte y **no generaliza** a las demás normas.
- **H1.12** Junto a la respuesta se repite el aviso de la librería: «Basado en una librería de ejemplo con guías propias de SynapTech; las numeraciones están sin verificar» (H5.5 del corte 0.6), mientras la librería siga marcada como borrador.

### H2 — Elegir el modelo

_Como persona de la empresa, quiero elegir con qué modelo se genera la respuesta, entre los que mi empresa permite._

- **H2.1** Veo solo los modelos que la política de **mi** empresa permite, con su nombre y si es local o externo.
- **H2.2** Si no elijo, se usa el modelo predeterminado de mi empresa.
- **H2.3** Si fuerzo la elección de un modelo que mi empresa no permite (por ejemplo, alterando la solicitud), la solicitud se rechaza con «prohibido» (403), no se genera nada y queda registrado.
- **H2.4** Mi elección se recuerda para mis próximas consultas (ver Q3).
- **H2.5** Cambiar de modelo no cambia nada más: la misma entrada, el mismo formato de respuesta y los mismos rótulos.

### H3 — Política de IA por empresa

_Como plataforma, quiero fijar por empresa qué modelos se permiten y cuál es el predeterminado, para que cada empresa controle dónde viajan sus consultas._

- **H3.1** Cada empresa tiene una política con: modelos permitidos, modelo predeterminado y si se permiten modelos externos. **Por omisión no se permite ninguno externo.**
- **H3.2** Una empresa sin política explícita usa la política segura por omisión: solo modelos locales y el predeterminado de plataforma.
- **H3.3** La política de una empresa no la ve ni la altera ninguna otra empresa.
- **H3.4** En este paso la política se carga como dato inicial de plataforma; no hay pantalla para editarla.
- **H3.5** Un modelo externo definido en el catálogo pero no permitido por la política **no recibe ninguna solicitud**: ninguna información sale de la infraestructura.

### H4 — El mismo caso de uso con dos modelos distintos (criterio de salida)

- **H4.1** Dos modelos distintos del catálogo responden al mismo caso de uso con la misma entrada, **sin cambiar código**: solo cambia la elección.
- **H4.2** Hay una prueba automatizada con respuestas simuladas que demuestra H4.1, y una verificación con los dos modelos locales reales.
- **H4.3** Agregar un tercer modelo al catálogo no exige modificar el caso de uso ni la pantalla.

### H5 — Medición y registro (P15)

- **H5.1** Cada consulta (exitosa, rechazada o fallida) queda en la bitácora inmutable con: empresa, actor (identificador opaco), modelo, tipo de proveedor (local o externo), duración, tamaño de entrada y salida (en unidades de medida del modelo), resultado y motivo.
- **H5.2** La bitácora **nunca** contiene el texto enviado, el texto recibido, ni datos personales.
- **H5.3** Una consulta rechazada también queda registrada, con un motivo de una **lista cerrada**: modelo no permitido por la política (403), proveedor externo no habilitado (403), límite de uso excedido (429) o respuesta con texto de norma (H1.7). La **falta de permiso** se registra como acceso denegado, igual que en el resto del sistema (un solo evento por intento).
- **H5.4** Si no se puede registrar la consulta, no se muestra la respuesta (el registro y la acción van juntos): se reintenta una vez y, si vuelve a fallar, la persona recibe un error de servicio no disponible, con una traza técnica sin contenido. Una base de datos caída no deja el rastro de H5.1.
- **H5.5** Se puede obtener, por empresa, el total de consultas y de tamaño por modelo en un periodo (medición para costos y límites). En este paso se verifica por prueba automatizada, sin pantalla.

### H6 — Límites y fallas

- **H6.1** Hay un límite de consultas por persona y por minuto (ver Q6). Al excederlo se informa cuándo reintentar y queda registrado.
- **H6.2** Si el modelo elegido falla o no responde, el mensaje es claro y no revela detalles internos (direcciones, nombres de servidor, trazas).
- **H6.3** Ninguna falla de IA impide usar el resto del listado.

## 4. Reglas de negocio

1. **Siempre borrador.** Todo contenido generado por IA lleva el rótulo y el modelo; no puede presentarse como aprobado ni guardarse como oficial (P15 y el asistente de la visión).
2. **Local por omisión.** Sin política que lo permita explícitamente, ninguna consulta usa un modelo externo.
3. **Solo contenido de la librería.** El caso de prueba envía únicamente norma, edición, cláusula, título breve y guía propia, nunca datos de la empresa; cualquier caso futuro que los use requiere su propia evaluación (ver «Impacto de IA»).
4. **Sin texto de normas.** Ni lo enviado ni lo mostrado reproduce texto de las normas ISO (regla 3 del proyecto).
5. **La política manda.** La elección de la persona nunca supera la política de su empresa.
6. **El registro no guarda contenido.** Se registra _que_ hubo una consulta y _cómo le fue_, no _qué_ se preguntó ni _qué_ se respondió.
7. **Un solo punto de entrada.** Ninguna parte del producto habla con un modelo sin pasar por la misma puerta, para que política, medición y registro no se puedan saltar.

## 5. Datos y clasificación

Los plazos y bases de tratamiento son hipótesis a confirmar con el asesor legal (ADR 028, aprobado como provisional).

| Dato                                                               | Clasificación                                            | Dónde vive                              |
| ------------------------------------------------------------------ | -------------------------------------------------------- | --------------------------------------- |
| Identificador, título breve y guía propia de la cláusula (entrada) | Propiedad intelectual de SynapTech; no personal          | Librería global (ya existe)             |
| Respuesta generada                                                 | Borrador; no personal si la entrada no lo es             | Solo en pantalla; **no se guarda** (Q2) |
| Catálogo de modelos (nombre, local o externo, estado)              | Configuración de plataforma                              | Datos de plataforma                     |
| Política de IA por empresa                                         | Configuración de la empresa; confidencial entre empresas | Datos de la empresa                     |
| Preferencia de modelo de una persona (Q3)                          | Personal (preferencia, pseudonimizada)                   | Datos de la empresa                     |
| Registro de la consulta (modelo, tamaño, duración, resultado)      | Personal pseudonimizado + auditoría                      | Bitácora inmutable                      |
| Texto enviado y recibido                                           | **No se conserva**                                       | —                                       |

## 6. Impacto multiempresa

- La política y la preferencia son datos de empresa: cada empresa solo ve y usa lo suyo, y se aplica el mismo aislamiento que al resto de datos de negocio.
- El catálogo de modelos es global (como el catálogo de librerías); qué parte de él usa cada empresa lo decide su política.
- Debe existir una prueba que intente usar, como empresa B, un modelo que solo permite la empresa A (y al revés) y **falle**, y otra que intente leer la política de otra empresa y **falle**.
- Las consultas de una empresa no son visibles para otra, ni siquiera en la medición agregada.

## 7. Impacto en la bitácora (P15)

| Evento                   | Cuándo se registra                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| Consulta de IA realizada | Cada consulta atendida: modelo, tipo de proveedor, duración, tamaño, resultado correcto o error      |
| Consulta de IA rechazada | Por política (modelo no permitido o externo no habilitado), por límite de uso o por respuesta con texto de norma |
| Cambio de modelo preferido | Cada vez que una persona cambia su modelo preferido (antes y después) |
| Configuración de IA cargada | Siembra del catálogo de modelos y de las políticas de empresa, con la huella del contenido |

Reglas: sin texto enviado ni recibido; sin datos personales; el motivo del rechazo es un código de una lista cerrada; si no se puede registrar, la consulta no se completa. Los eventos nuevos se agregan al catálogo cerrado de eventos de la bitácora.

## 8. Impacto de IA

Esta funcionalidad **es** el primer uso de IA del producto, y se trata como un sistema de IA conforme a la visión del producto (coherencia con ISO/IEC 42001):

- **Finalidad:** ayudar a entender qué evidencia suele demostrar un requisito. No decide nada, no evalúa cumplimiento y no modifica datos.
- **Riesgos considerados:** respuestas incorrectas o inventadas (por eso siempre borrador y contraste con la norma); reproducción de texto protegido (H1.7); fuga de datos a un modelo externo (H3.5); inyección de instrucciones (la entrada es solo contenido de la librería, sin texto libre de la persona); contenido activo en la respuesta (H1.8).
- **Supervisión humana:** la persona lee, contrasta y decide; no hay acción automática posterior.
- **Transparencia:** el modelo usado y el rótulo son visibles en cada respuesta.
- **Inventario:** el asistente debe quedar descrito como sistema de IA (finalidad, modelos, datos, controles). La ficha formal se incluye en la política de IA del paso 0.9 y en el inventario de sistemas de IA de una fase posterior (Q8).
- **Responsable:** el administrador SIG de SynapTech responde por el asistente (finalidad, modelos del catálogo, políticas y prompts).
- **Límites conocidos del modelo:** puede inventar o equivocarse, y los modelos pequeños locales redactan peor en español; por eso son borradores, con el aviso de H1.3, y no se usan para decidir.
- **Cambios controlados:** todo cambio de catálogo de modelos, de política de una empresa o de las instrucciones al modelo se registra y se revisa antes de la siguiente fase (en este paso se hace por revisión de código y registro de cambios; la bitácora de uso no los cubre).
- **Respuestas erróneas:** debe existir un canal para señalar una respuesta incorrecta. En este paso se difiere a la Fase 1 (Q12); mientras tanto, la persona usa el aviso de H1.3 y reporta al responsable.
- **Evaluación de calidad:** la comparación sistemática automatizada queda fuera de este paso. Aquí se exige una **muestra mínima de revisión humana**: 5 cláusulas × 2 modelos, revisadas por `experto-iso` con esta lista: no copia texto de norma, distingue práctica habitual de requisito, indica la norma y edición, y no pasa de cinco ejemplos.

## 9. Fuera de alcance

- Guardar, editar, aprobar o publicar la respuesta (flujo de borrador a aprobado).
- Pantalla para editar la política de IA de una empresa y administrar el catálogo de modelos.
- Modelos externos **habilitados**: se define que existen y están deshabilitados por omisión; no se prueban con datos reales.
- Clave propia de la empresa (BYOK) y gestión de secretos de proveedores externos.
- Respaldo automático a otro modelo cuando uno falla (Q7).
- Límites por empresa, cuotas de costo y facturación.
- Evaluaciones automáticas de calidad de modelos y prompts antes de cambiarlos.
- Herramientas expuestas a la IA, agentes y cualquier acción automática.
- Casos de IA que usen datos de la empresa (riesgos, hallazgos, documentos, evidencias).
- Historial de consultas visible para las personas.
- Respuestas en otros idiomas y voz o imágenes.

## 10. Preguntas abiertas

Cada una trae una propuesta; si no hay objeción, se toma la propuesta.

| #   | Pregunta                                                                    | Propuesta                                                                                                                                       |
| --- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | ¿Pueden usar la acción todos los roles o solo el administrador SIG?         | Ambos: solo lee guías públicas dentro del producto.                                                                                             |
| Q2  | ¿Se guarda la respuesta?                                                    | No: solo en pantalla. Guardar abre preguntas de aprobación y versión que son de otra fase.                                                      |
| Q3  | ¿La elección de modelo se recuerda por persona o se elige en cada consulta? | Recordarla por persona (una preferencia); implica un dato nuevo por persona.                                                                    |
| Q4  | ¿Qué políticas de prueba tienen A y B?                                      | A permite los dos modelos locales (predeterminado el más pequeño); B permite solo uno.                                                          |
| Q5  | ¿Cuál es el tiempo máximo de espera de una consulta?                        | 60 segundos (equipo de 8 GB, modelos pequeños).                                                                                                 |
| Q6  | ¿Qué límite de uso por persona?                                             | 10 consultas por minuto por persona.                                                                                                            |
| Q7  | ¿Se prueba el respaldo automático a otro modelo permitido cuando uno falla? | Diferirlo: aquí solo mensaje claro y reintento manual.                                                                                          |
| Q8  | ¿La ficha del asistente en el inventario de sistemas de IA se hace ahora?   | No: en la política de IA (0.9) y en el módulo de gobierno de IA (Fase 4 del producto).                                                          |
| Q9  | ¿Qué longitud y tono tiene la respuesta?                                    | Hasta unas 150 palabras, tono llano, con hasta 5 ejemplos de evidencia en lista, solo los que se deriven de la guía (H1.10).                                                           |
| Q10 | ¿Cómo se comprueba que la respuesta no copia texto de las normas?           | Reusar la misma verificación de contenido de las librerías con cero coincidencias como umbral (H1.7); si detecta alguna, no se muestra la respuesta y se registra el rechazo. |
| Q11 | ¿Quién decide qué modelos locales forman el catálogo inicial?               | Los dos ya instalados en el equipo de desarrollo, que suman 2,4 GB; ampliar requiere informar el tamaño antes de descargar.                     |
| Q12 | ¿Hay un canal para señalar una respuesta incorrecta?                        | Diferirlo a la Fase 1 (un evento de bitácora de código cerrado); mientras tanto, reporte directo al responsable del asistente.                  |
