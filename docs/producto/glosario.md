# Glosario del dominio ISO

Definiciones de trabajo redactadas por SynapTech con palabras propias (no reproducen el texto de las normas).

| Término | Definición en el sistema |
| --- | --- |
| **Norma** | Estándar de gestión (ISO 9001, ISO/IEC 27001, ISO/IEC 42001, …). Se carga como librería de datos. |
| **Edición** | Versión publicada de una norma (p. ej. 27001:2022). Una norma puede tener varias; la transición entre ediciones tiene su propio análisis de brechas. |
| **Estructura Armonizada** | Esqueleto común de cláusulas 4 a 10 compartido por las normas de sistemas de gestión; permite reutilizar evidencias entre normas. |
| **Requisito** | Condición que la norma exige cumplir, identificada por cláusula (entrada de tipo cláusula de la librería). Se evalúa como cumple / parcial / no cumple / no aplica. |
| **Control de la empresa** | Medida interna de la empresa que satisface uno o varios requisitos y controles de la norma. Puede ser adicional (de otra fuente, sin equivalente en el Anexo A). Se mapea muchos a muchos con las entradas de la norma. Se identifica con un código propio de la empresa y **no se borra: se retira** (deja de cambiarse y de recibir mapeos, queda su rastro y su código no se reutiliza). |
| **Control de la norma** | Entrada de tipo control del Anexo A de una librería (27001:2022 o 42001:2023): una medida de referencia que la Declaración de Aplicabilidad evalúa. En la librería de SynapTech para 27001 (borrador, numeraciones sin verificar) hay 93, repartidos en cuatro temas: organizacionales, personas, físicos y tecnológicos; en el MVP se evalúan en el diagnóstico. No es lo mismo que el control de la empresa. |
| **Agrupador** | Entrada de una librería que reúne a otras: un tema (27001:2022), un objetivo de control (42001:2023) o un capítulo (Estructura Armonizada). |
| **Equivalencia entre normas** | Relación declarada entre entradas de normas distintas: común, parcial o específica, con nota propia y quién la verificó. Por omisión es parcial y sin verificar. |
| **Mapeo** | Relación entre un control de la empresa y una entrada de una norma adoptada (una cláusula o un control de la norma). Base de "un requisito común, una evidencia, varias normas". Se puede quitar; cada alta y baja queda en la bitácora. |
| **Evidencia** | Registro o archivo que demuestra que un control opera (con responsable, fecha, vigencia y hash SHA-256). Se reutiliza para todos los requisitos mapeados. |
| **Vigencia (de evidencia)** | Fecha hasta la cual la evidencia sigue siendo válida; genera alertas de vencimiento. |
| **Hallazgo** | Resultado de una auditoría: conformidad, observación, oportunidad de mejora o no conformidad. |
| **No conformidad (NC)** | Incumplimiento de un requisito. Se clasifica en mayor o menor. |
| **NC mayor** | Incumplimiento que compromete la capacidad del sistema de lograr sus resultados, o ausencia/falla total de un requisito. Bloquea o condiciona la certificación hasta cerrarse. |
| **NC menor** | Incumplimiento aislado que no compromete la eficacia del sistema; requiere acción correctiva en el plazo acordado. |
| **Observación** | Punto que no es incumplimiento pero podría serlo si no se atiende; no exige acción correctiva formal. |
| **Oportunidad de mejora** | Sugerencia de auditoría sin carácter de incumplimiento. |
| **Acción correctiva / CAPA** | Acción para eliminar la causa raíz de una NC, con verificación de eficacia. |
| **Causa raíz** | Origen de un problema, analizado con técnicas como 5 porqués o Ishikawa. |
| **Declaración de Aplicabilidad (SoA)** | Documento que exigen 27001 y 42001. Se arma por control de la norma (Anexo A): si aplica, justificación de inclusión, estado de implementación, justificación de exclusión y enlace a los controles de la empresa. Se genera desde los controles reales. |
| **Evaluación de impacto de sistemas de IA** | Análisis de 42001 de los efectos de un sistema de IA sobre personas y la organización. |
| **Auditoría interna** | Auditoría realizada por la propia organización; prerrequisito de la Etapa 2. |
| **Revisión por la dirección** | Reunión de alta dirección con entradas obligatorias que evalúa el desempeño del sistema; prerrequisito de la Etapa 2. |
| **Auditoría combinada** | Auditoría de varias normas con un solo equipo y calendario. |
| **Organismo certificador** | Entidad acreditada que audita externamente y decide la certificación. |
| **Etapa 1** | Auditoría externa de preparación: revisa documentación y disposición para la Etapa 2. |
| **Etapa 2** | Auditoría externa de implementación y eficacia del sistema. |
| **Decisión de certificación** | Resolución del organismo que otorga el certificado; inicia el ciclo de 3 años. |
| **Certificado** | Documento con número, alcance y vigencia (ciclo de 3 años). |
| **Seguimiento (vigilancia)** | Auditorías periódicas durante el ciclo. El primero, a más tardar 12 meses después de la decisión de certificación; luego el segundo. |
| **Recertificación** | Auditoría completa antes del vencimiento del certificado para iniciar un nuevo ciclo. |
| **Transición de edición** | Migración a una nueva edición de la norma dentro del plazo del organismo/IAF, con análisis de brechas propio. |
| **Alcance** | Límites del sistema: sedes, procesos, productos y exclusiones justificadas. En el MVP es un texto por norma que una persona aprueba (queda quién y cuándo); si el texto cambia, vuelve a «sin aprobar». |
| **Parte interesada** | Persona u organización con requisitos relevantes para el sistema. |
| **Proyecto de certificación** | Instancia que recorre las etapas E0–E8 para una norma o combinación. |
| **Empresa (tenant)** | Organización cliente aislada por RLS; unidad de multiempresa. |
| **Librería de normas** | Archivo YAML versionado con la estructura de una norma (sin su texto). |
| **Sistema de IA** | Sistema inventariado para 42001; el asistente del propio producto es uno. |
| **Borrador generado por IA** | Marca obligatoria en todo contenido de IA hasta aprobación humana. |
| **Entrada (de una librería)** | Cláusula o control de una librería de normas, con un identificador estable propio, un título breve y una guía de SynapTech. Una misma entrada puede aplicar a varias normas, cada una con su numeración (compartir un número no significa pedir lo mismo). |
| **Diagnóstico (autoevaluación)** | Evaluación que la empresa hace de cada entrada de las librerías que adoptó, antes de la auditoría. Es un juicio propio, no un resultado oficial. |
| **Evaluación** | Estado que la empresa le da a una entrada: cumple, parcial, no cumple o no aplica (este último exige justificar). Lleva comentario, responsable y fecha objetivo. Una entrada sin evaluación está **sin evaluar**. |
| **Madurez** | Porcentaje que resume la autoevaluación: cumple vale 100, parcial 50 y no cumple 0; «no aplica» no cuenta y «sin evaluar» se muestra aparte. Si no hay nada evaluable no hay porcentaje. Mide la autoevaluación, no la probabilidad de certificarse. |
| **Marco de controles unificado** | Vista de los controles de la empresa con las entradas que cubren y las normas que alcanzan: una medida se trabaja una vez y se ve cubriendo varias normas. |
| **Retirar (un control)** | Dar de baja un control sin borrarlo: deja de cambiarse y de recibir mapeos, queda su rastro y su código no se reutiliza. |
