# SIG-ISO — Qué tengo y qué me falta

Nov 17, 2026 · @Leonardo Reyes

## Resumen ejecutivo

El MVP está terminado: SynapTech ya puede preparar su certificación ISO/IEC 27001 de punta a punta en el sistema, desde el alcance hasta la Declaración de Aplicabilidad en Word. Los hitos M1 a M7 están integrados en la rama principal (hasta el PR #26, del 16 de noviembre).

Lo que falta para el SIG-ISO completo se agrupa en cinco etapas, de la A a la E. La **etapa A (dejar la 27001 lista para el auditor)** es la que conviene pedir primero: sin auditoría interna, no conformidades y revisión por la dirección no se puede pasar la auditoría de Etapa 2. Las estimaciones son aproximadas y se basan en el ritmo observado de unas 20 a 25 tareas por día de trabajo de Claude Code.

## Parte 1 — MVP: lo que ya tengo

Hoy el sistema permite recorrer las etapas E0 (alcance), E1 (diagnóstico), E3 (Declaración de Aplicabilidad) y E4 (controles y evidencias) del ciclo de certificación, solo para ISO/IEC 27001:2022.

### Funcionalidades

| Hito | Qué puedo hacer en el sistema                                                                                                               | Integrado      |
|------|---------------------------------------------------------------------------------------------------------------------------------------------|----------------|
| M1   | Adoptar la librería del Anexo A de 27001: 93 controles con guías propias, numeración verificada contra la NTE INEN-ISO/IEC 27001:2023       | PR #19        |
| M2   | Definir y aprobar el alcance por norma; hacer el diagnóstico de brechas requisito por requisito y ver la madurez por norma, capítulo y tema | PR #20        |
| M3   | Crear los controles de la empresa y mapear cada uno a varias cláusulas y controles (una medida respalda varias normas)                      | PR #20        |
| M4   | Subir evidencias con archivo, vigencia, reemplazo y descarga protegida; ver la cobertura por norma y por control                            | PR #21        |
| M5   | Generar, aprobar y congelar la Declaración de Aplicabilidad, y exportarla a Word                                                            | PR #21        |
| M6a  | Cargar normas desde la pantalla con una plantilla descargable, sin usar comandos                                                            | PR #21        |
| M6b  | Trabajar con varias empresas: una persona en varias, cambio de empresa al entrar, color y logo editables                                    | PR #21 y #22 |
| M7   | Gestionar personas: alta con código de solicitud, cambio de rol y baja desde la web                                                         | PR #26        |

### Cimientos técnicos (no se ven, pero sostienen todo)

| Cimiento                              | Qué aporta                                                                                         |
|---------------------------------------|----------------------------------------------------------------------------------------------------|
| Inicio de sesión con Keycloak         | Cuentas centralizadas; la aplicación nunca maneja contraseñas                                      |
| Aislamiento por empresa en PostgreSQL | Una empresa no puede ver datos de otra, verificado con pruebas automáticas                         |
| Bitácora inmutable                    | Quién hizo qué y cuándo; nadie puede alterarla, ni siquiera el administrador de la base            |
| Roles y permisos                      | Administrador SIG, dueño de proceso, auditor interno, auditor externo, colaborador, alta dirección |
| Pipeline de calidad en GitHub         | Cada cambio pasa 7 controles: pruebas, tipos, secretos, licencias y vulnerabilidades               |
| Sistema de diseño                     | Pantallas consistentes, contraste accesible y marca por empresa                                    |
| Capa de Claude Code                   | 8 subagentes, 4 skills, 8 comandos y hooks que bloquean acciones peligrosas                        |
| Documentación                         | ADRs numerados hasta el 037, especificaciones, guía de ejecución y estado.md al día                |

### En curso

**Declaración de Aplicabilidad justificada:** motivo de inclusión por control, registro de riesgos básico vinculado a los controles y referencia al tratamiento en el Word. Lleva 6 de 20 tareas hechas al 17 de noviembre; falta alrededor de 1 día.

## Límites conocidos del MVP

El MVP sirve para preparar la 27001, pero todavía no alcanza para pasar una auditoría de certificación ni para venderse.

| Límite                                                               | Consecuencia                                                                                                |
|----------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| Solo ISO/IEC 27001                                                   | La 9001 y la 42001 aún no tienen librería cargada                                                           |
| Sin gestión de riesgos completa                                      | La Declaración de Aplicabilidad no se justifica todavía con el tratamiento de riesgos (se está corrigiendo) |
| Sin auditoría interna, no conformidades ni revisión por la dirección | Son prerrequisitos de la auditoría de Etapa 2                                                               |
| Sin control documental                                               | Políticas y procedimientos se manejan fuera del sistema                                                     |
| Sin asistente de IA                                                  | El paso 0.7 quedó en pausa, con el modelo ya elegido (ADR 030)                                              |
| Solo corre en tu Mac                                                 | No hay servidor; la infraestructura como código (paso 0.8) está diferida                                    |
| Datos personales pendientes de validación legal                      | El ADR 028 bloquea el uso con personas reales hasta que lo revise un asesor                                 |

## Parte 2 — SIG-ISO: lo que me falta

Para el SIG-ISO completo faltan unos 30 a 35 días de trabajo de Claude Code, repartidos en cinco etapas que se piden una por una. Solo la etapa A es indispensable para certificar la 27001; las demás se suman según lo que necesites.

<img src="media/image1.png" style="width:6in;height:1.78571in" alt="ruta del SIG-ISO · 5 etapas en orden recomendado" />

ruta del SIG-ISO · 5 etapas en orden recomendado

La etapa A, resaltada, es la única indispensable para certificar la 27001; la C se adelanta para gestionar el ciclo con el certificador.

### Etapa A — La 27001 lista para el auditor (prioridad alta, ~9 a 11 días)

| Módulo                                                              | Qué aporta                                                                                              | Estimación                       |
|---------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|----------------------------------|
| <span class="mark">Declaración justificada y riesgos básicos</span> | <span class="mark">Motivo de inclusión por control y vínculo con riesgos (en curso)</span>              | <span class="mark">~1 día</span> |
| Gestión de riesgos completa                                         | Activos de información, evaluación, plan de tratamiento y riesgo residual                               | 1,5 a 2 días                     |
| Control documental                                                  | Políticas y procedimientos con versiones, aprobación, lectura confirmada y retención                    | ~2 días                          |
| Auditoría interna                                                   | Programa anual, plan, listas de verificación desde los requisitos, hallazgos, independencia del auditor | ~2 días                          |
| No conformidades y acciones correctivas                             | Origen, causa raíz, acciones y verificación de eficacia                                                 | 1 a 1,5 días                     |
| Indicadores y objetivos                                             | Fichas, metas, semáforo y tendencias                                                                    | 1 a 1,5 días                     |
| Revisión por la dirección                                           | Entradas obligatorias armadas desde los demás módulos, acta y decisiones                                | ~1 día                           |

### Etapa B — Integrar la 9001 y la 42001 (~5 a 7 días)

| Módulo                 | Qué aporta                                                                                        | Estimación                    |
|------------------------|---------------------------------------------------------------------------------------------------|-------------------------------|
| Librería ISO 9001      | Cláusulas con guías propias, en la edición que confirme tu certificador                           | ~0,5 día + tu verificación    |
| Librería ISO/IEC 42001 | Cláusulas y controles del Anexo A                                                                 | 0,5 a 1 día + tu verificación |
| Gobierno de IA         | Inventario de sistemas de IA y evaluación de impacto (guía ISO/IEC 42005)                         | 1,5 a 2 días                  |
| Apoyo del sistema      | Partes interesadas, requisitos legales (incluida la LOPDP), competencias y formación, proveedores | 2 a 3 días                    |

### Etapa C — Ciclo de certificación externa (~3 a 4 días)

| Módulo                        | Qué aporta                                                                                                                  | Estimación |
|-------------------------------|-----------------------------------------------------------------------------------------------------------------------------|------------|
| Certificación y mantenimiento | Organismo certificador, auditorías de Etapa 1 y 2, hallazgos externos, certificado, seguimientos, recertificación y alertas | ~2 días    |
| Transición de ediciones       | Comparar dos ediciones de una norma y heredar el trabajo hecho                                                              | 1 a 2 días |

### Etapa D — Productividad y automatización (~7 a 9 días)

| Módulo                           | Qué aporta                                                                                  | Estimación   |
|----------------------------------|---------------------------------------------------------------------------------------------|--------------|
| Asistente de IA local            | Borradores de políticas y justificaciones, sugerencia de evidencias (completar el paso 0.7) | 1,5 a 2 días |
| Importar normas desde PDF con IA | Extrae solo la estructura y no guarda el PDF                                                | ~2 días      |
| Editor de librerías en pantalla  | Corregir entradas y crear marcos propios sin plantilla                                      | ~1 día       |
| Tablero ejecutivo                | Avance por norma, brechas, vencimientos y próximas auditorías                               | ~1 día       |
| Monitoreo continuo               | Conectores que recogen evidencias automáticamente (Keycloak, GitHub)                        | 2 a 3 días   |

### Etapa E — Producto vendible (~5 días o más)

| Módulo                                        | Qué aporta                                                  | Estimación                         |
|-----------------------------------------------|-------------------------------------------------------------|------------------------------------|
| Servidor e infraestructura (paso 0.8)         | Despliegue on-premise o en nube privada con Helm y OpenTofu | 1,5 a 2 días, cuando haya servidor |
| Seguridad y cumplimiento completos (paso 0.9) | Paquete para due diligence de clientes corporativos         | ~1,5 días                          |
| Pipeline completo y endurecimiento            | Acciones fijadas, CSP, revisión externa de calidad          | ~1 día                             |
| Comercial                                     | Planes, límites por empresa, alta de clientes               | Por definir                        |
| App móvil para auditores                      | Evidencias fotográficas sin conexión                        | Por definir                        |

## Pendientes que dependen de mí

Estas tareas no son de desarrollo y ninguna la puede hacer Claude Code; las tres primeras frenan el uso real del sistema.

- [ ] Pasar el ADR 028 (privacidad y bitácora) a un asesor legal antes de dar de alta personas reales

- [ ] Revisar los títulos del Anexo A con mi ejemplar: docs/revisiones/2026-11-16-titulos-anexo-a.md

- [ ] Pasar el repositorio de GitHub a privado antes de mostrarlo a clientes

- [ ] Ordenar los PR: cerrar el #24, integrar el #25 y decidir sobre el #13, #14, #16 y #17 (fuera del MVP)

- [ ] Elegir el organismo certificador y confirmar contra qué edición de la 9001 auditará

- [ ] Comprar las normas: enmienda 1:2024 de la 27001 (gratuita), 27005, 9001, 42001, 19011:2026 y 42005

- [ ] Definir la fecha objetivo de la auditoría de Etapa 1 de la 27001

- [ ] Conseguir un servidor cuando se quiera usar fuera de mi Mac

## Cómo pedirlo a Claude Code conforme avance

Orden recomendado: **A → C (solo certificación y mantenimiento) → B → D → E**. Así la 27001 queda certificable primero, y lo demás se suma sin rehacer nada.

Reglas que mantienen el ritmo:

1.  Una etapa a la vez, y dentro de ella un módulo por especificación, con un máximo de unas 25 tareas.

2.  Un PR por módulo, integrado el mismo día antes de empezar el siguiente.

3.  ADR solo para decisiones de arquitectura; una revisión completa al cerrar cada etapa.

4.  /clear en Claude Code entre módulos, para ahorrar tokens.

5.  Pedir un estado (/estado) al iniciar cada sesión.

Plantilla para pedir cada módulo (cambia lo que está entre corchetes):

Siguiente módulo: \[nombre\], de la etapa \[letra\] de docs/producto/vision.md.  
Prepara un spec corto (máx. ~25 tareas) validado con experto-iso, muéstrame el  
plan con número de tareas y estimación, y espera mi aprobación. Luego trabaja de  
corrido hasta abrir el PR; detente solo ante una decisión de producto o algo  
irreversible. Actualiza estado.md en el mismo PR.
