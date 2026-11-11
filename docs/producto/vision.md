# Visión del producto — sig-iso

> Extraído de FASE0.md, sección 2. Fuente de verdad del contexto de producto.

## 2.1 Resumen de la entrevista

| Tema | Respuesta |
| --- | --- |
| Problema | Gestionar como empresa todo el ciclo de vida hacia la certificación en varias normas ISO y su mantenimiento: diagnóstico, implementación, evidencias, auditorías, certificación, seguimientos y recertificación. |
| Usuario inicial | SynapTech Ecuador (uso interno primero). |
| Evolución | Después se venderá como producto **multiempresa** a empresas medianas y grandes del Ecuador (y a consultoras ISO). Por eso es multiempresa desde el día uno, aunque arranque con una sola empresa. |
| Normas de la v1 | **ISO 9001** (calidad), **ISO/IEC 27001:2022** (seguridad de la información), **ISO/IEC 42001:2023** (sistemas de gestión de IA). El modelo de datos debe admitir agregar cualquier otra norma sin cambiar código (14001, 45001, 20000-1, 22301, 37001, 27701…). |
| Canales | Web primero (responsiva, usable en tableta). Móvil nativo: **por definir** después de la v1 (caso de uso probable: auditor en sitio que toma evidencias fotográficas sin conexión). |
| Marca por empresa | Logo y colores por empresa (por defecto). |
| IA embebida | Sí. **Local con Ollama** por defecto (los datos del SIG son confidenciales y no salen de la infraestructura) y modelo **elegible** por empresa y usuario mediante gateway. |
| Integraciones | Por definir. Candidatas: Keycloak (evidencia de revisión de accesos), GitHub (evidencia de controles de desarrollo seguro), correo para notificaciones, almacenamiento S3 para evidencias. |
| Stack | Mismas decisiones que Orbyta: backend TypeScript + NestJS, PostgreSQL, Keycloak, on-premise o nube privada, GitHub. |
| Restricciones del equipo | Máquina de desarrollo principal: MacBook Pro M1, **8 GB RAM**, ~36 GB de disco disponibles. El equipo también usa Windows. El arranque debe ser **ligero** y mostrar **progreso visible pronto**. El responsable **no quiere aprobar cada comando**: solo aprueba al final de cada paso. |
| Look and feel | Por definir en el paso 0.5. Valor inicial propuesto: verde esmeralda SynapTech `#0E5C42` como color primario. |

## 2.2 Proceso de negocio que el sistema debe soportar (ciclo de vida de certificación)

El sistema modela un **Proyecto de certificación** por norma (o combinado) que recorre estas etapas. Cada etapa tiene entregables, responsables, fechas y un criterio de salida:

| # | Etapa | Qué gestiona el sistema |
| --- | --- | --- |
| E0 | Decisión y alcance | Contexto de la organización, partes interesadas y sus requisitos, alcance del sistema por norma, exclusiones justificadas, sedes y procesos incluidos. |
| E1 | Diagnóstico (análisis de brechas) | Autoevaluación requisito por requisito (cumple / parcial / no cumple / no aplica), evidencia existente, porcentaje de madurez por cláusula y por norma. |
| E2 | Plan de implementación | Plan de trabajo derivado de las brechas: tareas, responsables, fechas, dependencias, avance. |
| E3 | Diseño del sistema | Política integrada, objetivos medibles, mapa de procesos, metodología de riesgos, **Declaración de Aplicabilidad** (27001 y 42001), evaluación de impacto de sistemas de IA (42001), documentos y registros requeridos. |
| E4 | Implementación y operación | Controles en marcha, evidencias con vigencia, formación y competencia, comunicación, proveedores, inventario de activos de información y de sistemas de IA. |
| E5 | Evaluación | Indicadores, programa y ejecución de **auditorías internas**, **revisión por la dirección** con sus entradas obligatorias. Ambas son prerrequisito para la auditoría de Etapa 2. |
| E6 | Mejora | No conformidades, análisis de causa raíz, acciones correctivas, verificación de eficacia, oportunidades de mejora. |
| E7 | Certificación externa | Selección del organismo certificador acreditado, **auditoría de Etapa 1** (preparación y documentación), **auditoría de Etapa 2** (implementación y eficacia), hallazgos externos y su cierre, decisión de certificación, certificado (número, alcance, vigencia). |
| E8 | Mantenimiento (ciclo de 3 años) | Auditoría de **seguimiento 1** (máximo 12 meses desde la decisión de certificación), **seguimiento 2**, **recertificación** antes del vencimiento; alertas anticipadas; **transición de edición** de normas (por ejemplo ISO 9001:2015 → 2026, ISO 14001:2015 → 2026) con su propio análisis de brechas. |

## 2.3 Principio rector del dominio: "un requisito común, una evidencia, varias normas"

Las tres normas comparten la **Estructura Armonizada** (cláusulas 4 a 10: contexto, liderazgo, planificación, apoyo, operación, evaluación del desempeño, mejora). El sistema debe:

1. Tener un **marco de controles unificado** de la empresa: cada control interno se mapea a uno o varios requisitos de una o varias normas (relación muchos a muchos).
2. Reutilizar la **misma evidencia** para todos los requisitos mapeados ("mapear una vez, evidenciar una vez").
3. Permitir **auditorías combinadas** (un equipo auditor, varias normas) y calendarios unificados.
4. Mostrar la cobertura por norma, por cláusula y por control en tiempo real.

## 2.4 Buenas prácticas tomadas del mercado (a incorporar como requisitos)

| Fuente de referencia | Práctica a incorporar | Debilidad observada que debemos evitar |
| --- | --- | --- |
| Suites SIG latinoamericanas (Kawak, ISOTools, Isolución) | Módulos por proceso del SIG; control documental con versiones, flujos de aprobación y control de cambios; mapa de procesos como punto de entrada; indicadores con semáforo; auditorías; CAPA; riesgos; formación; proveedores; encuestas y quejas. | Rigidez (ajustes requieren desarrollo pagado), tableros débiles, carga de matrices complicada. → Todo configurable por empresa, importación desde Excel, tableros fuertes. |
| Automatización de cumplimiento (Vanta, Drata) | Marco de controles unificado con mapeo entre normas; recolección automática de evidencias y pruebas periódicas de controles; Declaración de Aplicabilidad generada desde los controles reales; integraciones. | Enfoque solo en seguridad y nube pública, costo por norma. → Cubrir calidad e IA, y funcionar on-premise. |
| GRC de código abierto (CISO Assistant, AGPLv3) | Normas descritas en un **formato abierto de librería** (archivo de datos versionado) que se importa sin tocar código; normas personalizadas; mapeo automático entre marcos; campañas de auditoría; API primero; MCP. | — → Inspirarse en el diseño **sin copiar código** (licencia AGPL). Antes de importar cualquier librería de terceros, verificar su licencia y registrar un ADR. |

## 2.5 Restricción legal sobre el texto de las normas

El texto de las normas ISO tiene derechos de autor. **El sistema no debe incluir el texto de las normas.** Las librerías de normas guardan solo: identificador de cláusula o control, título breve, una guía redactada por SynapTech con palabras propias, y el mapeo. Cada empresa usa su ejemplar adquirido de la norma como referencia. Este punto lo verifica el subagente `revisor-cumplimiento`.

## 2.6 Módulos funcionales previstos (para fases posteriores a la Fase 0)

Guarda esta lista en `docs/producto/vision.md` en el paso 0.1. Se construyen después de la Fase 0, cada uno con `/spec`.

| Fase | Módulo | Contenido mínimo |
| --- | --- | --- |
| 1 | Normas y requisitos | Librerías de normas en formato abierto (YAML/JSON con esquema), versiones de norma, importación, normas personalizadas. |
| 1 | Proyectos de certificación | Etapas E0–E8, plan de trabajo, avance, tablero por norma. |
| 1 | Diagnóstico | Autoevaluación por requisito, madurez, generación del plan desde las brechas. |
| 2 | Controles y evidencias | Marco unificado, mapeo muchos a muchos, evidencias con vigencia y responsable, alertas de vencimiento, Declaración de Aplicabilidad exportable. |
| 2 | Documentos | Control documental: versiones, estados (borrador, revisión, aprobado, obsoleto), aprobación, distribución, lectura confirmada, retención. |
| 2 | Riesgos y oportunidades | Metodología configurable, matriz, tratamiento, riesgo residual, vínculo con controles; activos de información. |
| 3 | Auditorías | Programa anual, plan, listas de verificación desde los requisitos, hallazgos, auditorías combinadas, auditor externo con acceso de solo lectura limitado en el tiempo. |
| 3 | No conformidades y CAPA | Origen (auditoría, queja, incidente, indicador), causa raíz (5 porqués, Ishikawa), acciones, verificación de eficacia. |
| 3 | Indicadores y objetivos | Fichas, metas, semáforo, tendencias, vínculo con objetivos y procesos. |
| 3 | Revisión por la dirección | Entradas obligatorias armadas automáticamente desde los demás módulos, acta, decisiones y acciones. |
| 4 | Gobierno de IA (42001) | Inventario de sistemas de IA, evaluación de impacto, ciclo de vida, proveedores de IA. |
| 4 | Certificación externa y ciclo | Organismo certificador, auditorías Etapa 1/2, seguimientos, recertificación, transición de edición, calendario con alertas. |
| 4 | Apoyo | Partes interesadas, requisitos legales (incluida LOPDP), competencias y formación, proveedores, comunicación. |
| 5 | Monitoreo continuo | Conectores que recogen evidencias y prueban controles automáticamente (Keycloak, GitHub, etc.). |
| Transversal | Asistente de IA | Redactar borradores de documentos y políticas, sugerir evidencias para un requisito, resumir hallazgos, proponer causa raíz; siempre como borrador que aprueba un humano. |

> **Avance (2026-11-11).** El recorte que se está construyendo es el MVP de certificación (`docs/specs/mvp-certificacion/plan.md`): del módulo «Normas y requisitos» el Anexo A de 27001 como librería; del «Diagnóstico» la autoevaluación con madurez, más el alcance por norma; de «Controles y evidencias» el marco unificado con mapeos (M3), y quedan las evidencias con archivo (M4) y la Declaración de Aplicabilidad exportable (M5). El estado al día está en `docs/fase0/estado.md`. Esta visión no cambia: sigue siendo el norte.
