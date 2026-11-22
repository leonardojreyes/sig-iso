# Hoja de ruta del SIG-ISO

- **Actualizado:** 2026-11-18 · **Responsable:** Ing. Leonardo J. Reyes B., MBA
- **Fuente:** documento «SIG-ISO — Qué tengo y qué me falta» (claude.ai, 2026-11-17). Desde ahora **este archivo es la referencia oficial**: Claude Code lo mantiene al día y marca cada módulo como hecho en el mismo PR que lo cierra.

## Cómo se nombra el avance

- **Etapa** (A a E) → **módulo** → **tarea X de Y** (con su **fase N de M**, las del `tasks.md` de cada módulo).
- Ejemplo de reporte: «Etapa A · Declaración justificada y riesgos básicos · tarea 13 de 20 (fase 3 de 6: Contrato y API)».
- «Fase 0» y los hitos M1 a M7 son historia (cimientos y MVP); no se usan para el trabajo nuevo.

## Orden recomendado

**A → C (solo «Certificación y mantenimiento») → B → D → E.** Solo la etapa A es indispensable para certificar ISO/IEC 27001 (sin auditoría interna, no conformidades y revisión por la dirección no se pasa la Etapa 2).

Estados: `Hecho` · `En curso` · `Pendiente` · `Por definir`. Estimaciones en días de trabajo de Claude Code, aproximadas (ritmo observado: 20 a 25 tareas por día).

## MVP — hecho (2026-11-04 a 2026-11-16)

| Hito | Contenido | PR |
| --- | --- | --- |
| M1 | Librería del Anexo A de 27001 (93 controles, numeración verificada contra la NTE INEN-ISO/IEC 27001:2023) | #19 |
| M2 | Alcance por norma y diagnóstico de brechas con madurez | #20 |
| M3 | Controles de la empresa y mapeo a varias normas | #20 |
| M4 | Evidencias con archivo, vigencia y cobertura | #21 |
| M5 | Declaración de Aplicabilidad aprobada, congelada y exportable a Word | #21 |
| M6a | Carga de normas desde la pantalla con plantilla | #21 |
| M6b | Multiempresa completo y marca editable | #21, #22 |
| M7 | Personas: alta con código de solicitud, cambio de rol y baja | #26 |

## Etapa A — La 27001 lista para el auditor (prioridad alta, ~9 a 11 días)

| Módulo | Qué aporta | Estimación | Estado |
| --- | --- | --- | --- |
| Declaración justificada y riesgos básicos | Motivo de inclusión por control, vínculo con riesgos, referencia al tratamiento en el Word (`docs/specs/declaracion-justificada/`; `/review` en `docs/revisiones/2026-11-18-review-declaracion-justificada.md`) | ~1 día | **Hecho** (2026-11-18) |
| Gestión de riesgos completa | Activos de información, evaluación, plan de tratamiento y riesgo residual | 1,5 a 2 días | Pendiente |
| Control documental | Políticas y procedimientos con versiones, aprobación, lectura confirmada y retención (`docs/specs/control-documental/`; ADR 039; STRIDE en `docs/security/stride-control-documental.md`) | ~2 días | **Hecho** (2026-11-19) |
| Auditoría interna | Programa anual, plan, listas de verificación desde los requisitos, hallazgos, independencia del auditor (`docs/specs/auditoria-interna/`; ADR 040; STRIDE en `docs/security/stride-auditoria-interna.md`) | ~2 días | **Hecho** (2026-11-22) |
| No conformidades y acciones correctivas | Origen, causa raíz, acciones y verificación de eficacia | 1 a 1,5 días | Pendiente |
| Indicadores y objetivos | Fichas, metas, semáforo y tendencias | 1 a 1,5 días | Pendiente |
| Revisión por la dirección | Entradas obligatorias armadas desde los demás módulos, acta y decisiones | ~1 día | Pendiente |

## Etapa B — Integrar la 9001 y la 42001 (~5 a 7 días)

| Módulo | Qué aporta | Estimación | Estado |
| --- | --- | --- | --- |
| Librería ISO 9001 | Cláusulas con guías propias, en la edición que confirme el certificador | ~0,5 día + verificación del responsable | Pendiente |
| Librería ISO/IEC 42001 | Cláusulas y controles del Anexo A | 0,5 a 1 día + verificación del responsable | Pendiente |
| Gobierno de IA | Inventario de sistemas de IA y evaluación de impacto (guía ISO/IEC 42005) | 1,5 a 2 días | Pendiente |
| Apoyo del sistema | Partes interesadas, requisitos legales (incluida la LOPDP), competencias y formación, proveedores | 2 a 3 días | Pendiente |

## Etapa C — Ciclo de certificación externa (~3 a 4 días)

| Módulo | Qué aporta | Estimación | Estado |
| --- | --- | --- | --- |
| Certificación y mantenimiento | Organismo certificador, auditorías de Etapa 1 y 2, hallazgos externos, certificado, seguimientos, recertificación y alertas | ~2 días | Pendiente |
| Transición de ediciones | Comparar dos ediciones de una norma y heredar el trabajo hecho | 1 a 2 días | Pendiente |

## Etapa D — Productividad y automatización (~7 a 9 días)

| Módulo | Qué aporta | Estimación | Estado |
| --- | --- | --- | --- |
| Asistente de IA local | Borradores de políticas y justificaciones, sugerencia de evidencias (completa el paso 0.7; modelo según ADR 030) | 1,5 a 2 días | Pendiente |
| Importar normas desde PDF con IA | Extrae solo la estructura; no guarda el PDF | ~2 días | Pendiente |
| Editor de librerías en pantalla | Corregir entradas y crear marcos propios sin plantilla | ~1 día | Pendiente |
| Tablero ejecutivo | Avance por norma, brechas, vencimientos y próximas auditorías | ~1 día | Pendiente |
| Monitoreo continuo | Conectores que recogen evidencias automáticamente (Keycloak, GitHub) | 2 a 3 días | Pendiente |

## Etapa E — Producto vendible (~5 días o más)

| Módulo | Qué aporta | Estimación | Estado |
| --- | --- | --- | --- |
| Servidor e infraestructura (paso 0.8) | Despliegue on-premise o en nube privada con Helm y OpenTofu | 1,5 a 2 días, cuando haya servidor | Pendiente |
| Seguridad y cumplimiento completos (paso 0.9) | Paquete para due diligence de clientes corporativos | ~1,5 días | Pendiente |
| Pipeline completo y endurecimiento | Acciones fijadas por SHA, CSP, revisión externa de calidad | ~1 día | Pendiente |
| Comercial | Planes, límites por empresa, alta de clientes | Por definir | Por definir |
| App móvil para auditores | Evidencias fotográficas sin conexión | Por definir | Por definir |

## Reglas de trabajo

1. Una etapa a la vez y, dentro de ella, un módulo por spec, con un máximo de ~25 tareas.
2. Un PR por módulo, integrado por el responsable el mismo día, antes de empezar el siguiente.
3. ADR solo para decisiones de arquitectura; un `/review` completo al cerrar cada etapa.
4. Al cerrar un módulo: marcarlo `Hecho` aquí y actualizar `docs/fase0/estado.md`, en el mismo PR.
5. Las decisiones de producto, los cambios de alcance y lo irreversible se consultan al responsable.
