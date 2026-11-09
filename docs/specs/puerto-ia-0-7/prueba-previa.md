# Prueba previa del paso 0.7 (tarea 1.5)

- **Fecha:** 2026-11-09 · **Prompt:** `evidencia-requisito@1.0.0` · **Norma consultada:** ISO 9001 · **Servicio:** Ollama local directo (API compatible con OpenAI), solo 127.0.0.1
- **Muestra:** 5 cláusulas × 2 modelos × 2 repetición(es). Entrada: solo la librería de ejemplo (sin datos de ninguna empresa).
- **Detector:** `revisarRespuestaIa` de `@sig/normas-schema` (tono normativo, citas largas, enlaces), umbral de cero coincidencias. Las «observaciones» son comprobaciones aproximadas de la lista del plan; la revisión humana manda.

## Resumen

| Modelo | Consultas | Con error | Rechazadas por el detector | Tasa | Mediana | Máximo |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| qwen2.5:1.5b | 10 | 0 | 6 | 60 % | 3957 ms | 14992 ms |
| granite3.3:2b | 10 | 0 | 0 | 0 % | 10008 ms | 15621 ms |

## Respuestas

### qwen2.5:1.5b · ha-4.3

- Tiempo: 5434 ms · Palabras: 79 · Ejemplos en lista: 0 · Unidades de entrada/salida: 582/128
- Detector: limpio

> Suele: Una lista de actividades y procesos que el sistema abarca.
> Puede servir: Un diagrama de flujo que muestra la interrelación de procesos.
> Una práctica habitual es: Un manual de procedimientos que detalla las actividades.
> Suele: Un informe de auditoría que demuestre que todos los procesos están cubiertos.
> Puede servir: Un registro de revisión de procesos que muestre la revisión periódica.
> Una práctica habitual es: Un protocolo de comunicación que establezca las acciones a seguir en caso de incumplimiento.

### qwen2.5:1.5b · ha-9.2

- Tiempo: 2092 ms · Palabras: 59 · Ejemplos en lista: 0 · Unidades de entrada/salida: 568/98
- Detector: tono_normativo, cita_textual · Observaciones: usa comillas

> Suele: "Los registros de las auditorías internas deben ser completos y detallados para documentar las observaciones y recomendaciones realizadas."
> Puede servir: "Los informes de auditoría interna deben incluir la evaluación de la conformidad con los requisitos establecidos en la norma."
> Una práctica habitual es: "Los auditorios internos deben tener un seguimiento para asegurar la implementación efectiva de las recomendaciones."

### qwen2.5:1.5b · ha-9.3

- Tiempo: 7316 ms · Palabras: 115 · Ejemplos en lista: 0 · Unidades de entrada/salida: 667/185
- Detector: limpio

> Suele la alta dirección revisar periódicamente el desempeño del sistema de gestión y dejar registros de las decisiones tomadas.
> Puede servir la revisión periódica de la documentación y la implementación de la norma ISO/IEC 42001 (2023) para respaldar la revisión por la dirección.
> Una práctica habitual es la revisión por la dirección en intervalos planificados, como lo indica la guía de la librería.
> Puede servir la revisión por la dirección en intervalos planificados, como lo indica la guía de la librería, para respaldar la revisión por la dirección.
> Una práctica habitual es la revisión por la dirección en intervalos planificados, como lo indica la guía de la librería, para respaldar la revisión por la dirección.

### qwen2.5:1.5b · ha-6.1

- Tiempo: 3957 ms · Palabras: 75 · Ejemplos en lista: 0 · Unidades de entrada/salida: 684/109
- Detector: tono_normativo, cita_textual · Observaciones: usa comillas

> Suele: "La empresa debe identificar y evaluar los riesgos y oportunidades que puedan afectar los resultados de la gestión de la calidad."
> Puede servir: "La empresa puede utilizar herramientas de análisis de riesgos como la matriz SWOT para identificar y evaluar las oportunidades y riesgos."
> Una práctica habitual es: "La empresa puede evaluar los riesgos de seguridad de la información y la IA en sus procesos de negocio para asegurar la continuidad y la eficiencia."

### qwen2.5:1.5b · ha-mejora

- Tiempo: 14992 ms · Palabras: 264 · Ejemplos en lista: 0 · Unidades de entrada/salida: 682/400
- Detector: cita_textual · Observaciones: usa comillas

> Suele: "Revisa de forma periódica qué se puede hacer mejor, a partir de los resultados del seguimiento y de la revisión por la dirección, y deja evidencia de los avances."
> 
> Puede servir: "Realiza análisis de rendimiento y identifica áreas de mejora basadas en los resultados de la auditoría."
> 
> Una práctica habitual es: "Asegura la revisión periódica de la gestión de la mejora continua para mantener la eficacia del proceso."
> 
> Suele: "Revisa de forma periódica qué se puede hacer mejor, a partir de los resultados del seguimiento y de la revisión por la dirección, y deja evidencia de los avances."
> 
> Puede servir: "Realiza análisis de rendimiento y identifica áreas de mejora basadas en los resultados de la auditoría."
> 
> Una práctica habitual es: "Asegura la revisión periódica de la gestión de la mejora continua para mantener la eficacia del proceso."
> 
> Suele: "Revisa de forma periódica qué se puede hacer mejor, a partir de los resultados del seguimiento y de la revisión por la dirección, y deja evidencia de los avances."
> 
> Puede servir: "Realiza análisis de rendimiento y identifica áreas de mejora basadas en los resultados de la auditoría."
> 
> Una práctica habitual es: "Asegura la revisión periódica de la gestión de la mejora continua para mantener la eficacia del proceso."
> 
> Suele: "Revisa de forma periódica qué se puede hacer mejor, a partir de los resultados del seguimiento y de la revisión por la dirección, y deja evidencia de los avances."
> 
> Puede servir: "Realiza análisis de rendimiento y identifica áreas de mejora basadas en los resultados de la auditoría."
> 
> Una práctica habitual es: "Asegura la revisión periódica de

### qwen2.5:1.5b · ha-4.3

- Tiempo: 3119 ms · Palabras: 51 · Ejemplos en lista: 0 · Unidades de entrada/salida: 582/76
- Detector: tono_normativo, cita_textual · Observaciones: usa comillas

> Suele: "El sistema debe cubrir todas las áreas, sitios y actividades relevantes para la organización."
> Puede servir: "El sistema debe incluir la documentación de las actividades fuera del alcance del sistema."
> Una práctica habitual es: "El sistema debe ser revisado periódicamente para asegurar que cubre todas las áreas y actividades pertinentes."

### qwen2.5:1.5b · ha-9.2

- Tiempo: 3262 ms · Palabras: 55 · Ejemplos en lista: 0 · Unidades de entrada/salida: 568/88
- Detector: tono_normativo, cita_textual · Observaciones: usa comillas

> Suele: "Los registros de las auditorías internas deben ser completos y detallados para documentar las observaciones y conclusiones."
> Puede servir: "El análisis de los resultados de las auditorías internas puede ayudar a identificar áreas de mejora."
> Una práctica habitual es: "El seguimiento de las recomendaciones de auditoría interna debe ser continuo para asegurar su implementación."

### qwen2.5:1.5b · ha-9.3

- Tiempo: 3824 ms · Palabras: 59 · Ejemplos en lista: 0 · Unidades de entrada/salida: 667/95
- Detector: limpio

> Suele: La dirección revisa periódicamente la eficiencia del sistema y registra las decisiones tomadas.
> Puede servir: La revisión por la dirección puede respaldarse con informes de auditoría externa, registros de acciones tomadas y seguimiento de resultados.
> Una práctica habitual es: La dirección revisa la gestión de la calidad y la seguridad, asegurándose de que se cumplan los estándares establecidos.

### qwen2.5:1.5b · ha-6.1

- Tiempo: 11344 ms · Palabras: 208 · Ejemplos en lista: 0 · Unidades de entrada/salida: 684/303
- Detector: tono_normativo, cita_textual · Observaciones: usa comillas

> Suele: "La empresa debe identificar y evaluar los riesgos y oportunidades que puedan afectar los resultados de la gestión de la calidad."
> Puede servir: "La evaluación de riesgos y oportunidades puede ser documentada en un informe de impacto de la gestión de la calidad."
> Una práctica habitual es: "La empresa puede utilizar herramientas de análisis de riesgos para identificar y evaluar los posibles impactos de las decisiones en la gestión de la calidad."
> Suele: "La empresa debe planificar acciones para mitigar los riesgos identificados y aprovechar las oportunidades."
> Puede servir: "La empresa puede establecer un plan de acción para mitigar riesgos y aprovechar oportunidades en su proceso de gestión de la calidad."
> Una práctica habitual es: "La empresa puede realizar un seguimiento periódico para evaluar la eficacia de las acciones tomadas para mitigar riesgos y aprovechar oportunidades."
> Suele: "La empresa debe mantener un registro de las acciones tomadas y su impacto en la gestión de la calidad."
> Puede servir: "La empresa puede registrar las acciones tomadas para mitigar riesgos y aprovechar oportunidades en su proceso de gestión de la calidad."
> Una práctica habitual es: "La empresa puede utilizar registros de seguimiento para monitorear la implementación y el cumplimiento de las acciones tomadas para mitigar riesgos y aprovechar oportunidades."

### qwen2.5:1.5b · ha-mejora

- Tiempo: 3742 ms · Palabras: 67 · Ejemplos en lista: 0 · Unidades de entrada/salida: 682/107
- Detector: limpio

> Suele: Revisa de forma periódica los resultados del seguimiento y la revisión por la dirección para identificar áreas de mejora.
> Puede servir: Documenta los avances de las mejoras realizadas, como cambios en procesos o implementación de nuevas prácticas.
> Una práctica habitual es: Realiza una revisión periódica de la gestión de mejora continua, incluyendo la documentación de los avances y la evaluación de la eficacia de las mejoras.

### granite3.3:2b · ha-4.3

- Tiempo: 14519 ms · Palabras: 109 · Ejemplos en lista: 11 · Unidades de entrada/salida: 699/210
- Detector: limpio

> Suele:
> - Documentación del sistema de gestión (Sistema de Gestión de Calidad).
> - Inventario de procesos y actividades incluidos en el Sistema.
> - Criterios de inclusión y exclusión de áreas y sitios.
> - Contrato o acuerdo de cliente que define el alcance.
> - Memoria de la junta de control interno.
> 
> Puede servir:
> - Declaraciones de empleados sobre la comprensión del alcance.
> - Registros de reuniones de juntas de control interno.
> - Copias de contratos o pedidos de clientes.
> 
> Una práctica habitual:
> - Inventario actualizado de procesos y actividades.
> - Documentación que mapea el alcance y lo contrasta con la certificación.
> - Registros de modificaciones en el alcance del Sistema.

### granite3.3:2b · ha-9.2

- Tiempo: 9769 ms · Palabras: 90 · Ejemplos en lista: 5 · Unidades de entrada/salida: 681/197
- Detector: limpio

> Suele:
> - **Planificación de auditorías**: Documentación que muestra la planificación previa a la auditoría, incluyendo el alcance, el enfoque y los recursos.
> - **Selección de auditores**: Evidencia de que los auditores son imparciales y no tienen conflictos de interés.
> - **Entrevistas y observaciones**: Registros que demuestran las entrevistas realizadas y las observaciones efectuadas durante la auditoría.
> - **Informes de auditoría**: Copias de los informes generados por los auditores, reflejando los hallazgos y recomendaciones.
> - **Acciones correctivas**: Documentación que indica las acciones implementadas en consecuencia de los hallazgos de la auditoría.

### granite3.3:2b · ha-9.3

- Tiempo: 10008 ms · Palabras: 96 · Ejemplos en lista: 5 · Unidades de entrada/salida: 793/170
- Detector: limpio

> • Suele ser que la alta dirección se reúne periódicamente para evaluar el rendimiento del Sistema de Gestión (SG).
> • Puede servir que se documenten las decisiones tomadas y las acciones correctivas implementadas.
> • Una práctica habitual es que la dirección comunique los resultados de las revisiones a la alta dirección y al equipo de gestión.
> • También es común que se realicen auditorías internas para apoyar la revisión por parte de la dirección.
> • Una práctica frecuente es que se utilice la evidencia de los informes de control interno para validar el desempeño del SG.

### granite3.3:2b · ha-6.1

- Tiempo: 7217 ms · Palabras: 61 · Ejemplos en lista: 5 · Unidades de entrada/salida: 813/123
- Detector: limpio

> Suele:
> - Evaluaciones de riesgos identificadas en informes de seguridad informática.
> - Análisis de impacto de oportunidades de mercado en estrategias de negocio.
> - Documentación de procesos de gestión de riesgos y oportunidades.
> - Registros de evaluaciones de terceros independientes sobre la gestión de riesgos.
> - Registros de incidentes de seguridad y su análisis para mejoras en la gestión de riesgos.

### granite3.3:2b · ha-mejora

- Tiempo: 10302 ms · Palabras: 86 · Ejemplos en lista: 5 · Unidades de entrada/salida: 810/167
- Detector: limpio

> Suele:
> - **Revisión interna**: Documentación que muestra las revisiones internas realizadas para identificar áreas de mejora.
> - **Seguimiento de indicadores**: Datos que reflejan el seguimiento de indicadores clave para evaluar el rendimiento.
> - **Revisión directiva**: Registros que indican la revisión por parte de la dirección sobre los resultados del seguimiento.
> - **Plan de mejora**: Planes específicos que detallan las acciones a tomar para mejorar ciertos procesos o productos.
> - **Evaluación de impacto**: Análisis que mide el impacto de las mejoras implementadas en los resultados del negocio.

### granite3.3:2b · ha-4.3

- Tiempo: 7179 ms · Palabras: 61 · Ejemplos en lista: 12 · Unidades de entrada/salida: 699/131
- Detector: limpio · Observaciones: habla de clasificación de hallazgos o promesa de certificación

> Suele:
> - Documentación de alcance del sistema (ESO)
> - Mapa de procesos organizacionales
> - Entrevistas con empleados
> - Observación de actividades
> - Registros de incidentes y mejoras
> - Contratos y acuerdos con proveedores
> - Cumplimiento normativo
> - Evaluación de riesgos
> - Planes de contingencia
> - Procedimientos de control interno
> - Informes de auditorías internas
> - Certificados de cumplimiento de normas externas.

### granite3.3:2b · ha-9.2

- Tiempo: 7928 ms · Palabras: 71 · Ejemplos en lista: 5 · Unidades de entrada/salida: 681/151
- Detector: limpio

> Suele:
> - **Certificado de capacitación**: Evidencia que los auditores han recibido formación adecuada.
> - **Plan de auditoría**: Documento que muestra la planificación detallada de la auditoría.
> - **Informe de auditoría**: Evidencia que los resultados se registran y se comunican de manera clara.
> - **Libro de errores y mejoras**: Muestra la implementación de acciones derivadas de las auditorías.
> - **Registro de auditorías**: Registro que demuestra la frecuencia y tipo de auditorías realizadas.

### granite3.3:2b · ha-9.3

- Tiempo: 8226 ms · Palabras: 80 · Ejemplos en lista: 5 · Unidades de entrada/salida: 793/147
- Detector: limpio

> • Suele ser una reunión periódica de la alta dirección para evaluar el desempeño del sistema.
> • Puede servir un registro de las decisiones tomadas y las acciones correctivas implementadas.
> • Una práctica habitual es la realización de auditorías internas para revisar el desempeño del sistema.
> • Puede servir informes detallados sobre las actividades de revisión por parte de la dirección.
> • Una práctica común es la documentación de las decisiones y acciones derivadas de la revisión por la dirección.

### granite3.3:2b · ha-6.1

- Tiempo: 15621 ms · Palabras: 137 · Ejemplos en lista: 15 · Unidades de entrada/salida: 813/289
- Detector: limpio

> Suele:
> - Evaluaciones de riesgos identificadas en informes de seguridad.
> - Documentación de auditorías internas sobre vulnerabilidades.
> - Planes de contingencia elaborados tras análisis de riesgos.
> - Evaluaciones de impacto de nuevas tecnologías en la información.
> - Registros de incidentes de seguridad y acciones correctivas.
> 
> Puede servir:
> - Certificados de cumplimiento de normas de seguridad.
> - Informes de auditorías externas sobre la gestión de riesgos.
> - Comunicados de seguridad de terceros involucrados en el negocio.
> - Registros de capacitación sobre gestión de riesgos.
> - Documentación de cambios en la infraestructura tecnológica.
> 
> Una práctica habitual es:
> - Realización de evaluaciones de riesgos periódicas.
> - Implementación de mecanismos de detección y alerta temprana.
> - Desarrollo de planes de contingencia actualizados.
> - Evaluación de la efectividad de las medidas de mitigación.
> - Monitoreo y revisión de la gestión de riesgos.

### granite3.3:2b · ha-mejora

- Tiempo: 12235 ms · Palabras: 93 · Ejemplos en lista: 10 · Unidades de entrada/salida: 810/189
- Detector: limpio

> Suele:
> - Revisión interna periódica de procesos.
> - Documentación de los resultados del seguimiento.
> - Revisión por la dirección y registro de las mejoras propuestas.
> - Entrevistas con empleados para identificar áreas de mejora.
> - Análisis de datos para identificar tendencias y oportunidades de mejora.
> - Implementación de cambios y seguimiento de su efectividad.
> - Registro de las mejoras realizadas y su impacto.
> - Participación de empleados en la identificación de mejoras.
> - Evaluación de la efectividad de las mejoras implementadas.
> - Uso de indicadores clave de rendimiento (KPI) para medir el progreso.
