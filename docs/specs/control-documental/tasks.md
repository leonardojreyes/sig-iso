# Tareas — Control documental

- **Spec:** [spec.md](spec.md) (con los ajustes de la sección 11) · **Rama:** `feature/control-documental` · **Plan:** no hay; proceso ágil, las decisiones van en el ADR de la tarea 1.
- **Estado:** **22 tareas** en 5 fases, **~2 días** (estimación de la hoja de ruta). **Todas hechas el 2026-11-19** (rama `feature/control-documental`, PR por abrir).

## Cómo leer este documento

- Cada tarea cabe en una sesión de `/implement` (máx. ~1 hora). Orden TDD: prueba → dominio → caso de uso → adaptador → interfaz → documentación. **‖** = puede ir en paralelo.
- Todas incluyen `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde y un commit en inglés con Conventional Commits.
- «Aislamiento» = prueba que intenta leer o cambiar datos de otra empresa y **debe fallar**; toda tabla nueva se declara en los tres sitios de `privilegios.integration.test.ts`.
- **Contrato primero**; bitácora con acciones nuevas en el catálogo (objeto de forma exacta, sin texto libre) y en la misma transacción.
- Migraciones `0027` en adelante (`0021`–`0026` quedan reservadas a «Gestión de riesgos completa»); se renumeran si cambia el orden.
- Reutiliza el almacén de archivos de M4 (`AlmacenArchivosPort`, ADR 032) y la guardia común de formularios de la web.

## Fase 1 — Decisión, base de datos y dominio

| ID  | Tarea                                                                                                                                                                                                                                                                             | Depende |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | **ADR 039** «Control documental» (versión única vigente, separación de funciones y excepción del único administrador, clasificación informativa, lectura como constancia, retención sin disposición) + glosario y `modelo-dominio.md`                                             | —       |
| 2   | Permisos `documentos.ver\|redactar\|aprobar\|leer` y matriz (colaborador redacta y consulta; solo el administrador aprueba); acciones de bitácora (`documento.*`, `version.*`, `lectura.*`) con ejemplos y pruebas ‖                                                              | 1       |
| 3   | Migración `0027`: `documento` (código correlativo por tipo, tipo con «externo», emisor y edición opcionales, área, clasificación, responsable, estado) y `documento_version` (archivo, huella, nota, estado, autor, aprobador, fechas); RLS forzada, **aislamiento**, privilegios | 1       |
| 4   | Migración `0028`: `documento_destinatario`, `documento_lectura` (por versión y persona), `documento_vinculo` (entradas adoptadas y controles de la empresa) y `retencion_tipo` (años y motivo); RLS, **aislamiento**, privilegios ‖                                               | 1       |
| 5   | Dominio puro: documento y versión, máquina de estados (borrador, revisión, aprobada, obsoleta), una sola vigente, separación de funciones y excepción registrada, revisión vencida o por vencer, «elegible para disposición» + pruebas (≥ 80 %) ‖                                 | 1       |

## Fase 2 — Casos de uso y adaptadores

| ID  | Tarea                                                                                                                                                                                                                                | Depende |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| 6   | Casos de uso del documento: crear (código por tipo), cambiar, retirar, listar con filtros (tipo, estado, responsable, área, norma, sin vigente, revisión vencida) y ver con historial                                                | 2, 3, 5 |
| 7   | Casos de uso de versiones: subir borrador (tipos y límite de M4, huella, nota obligatoria), descartar y enviar a revisión nombrando aprobador                                                                                        | 6       |
| 8   | Aprobar (distinto del autor, o excepción con motivo) y devolver con motivo; la anterior pasa a obsoleta en la misma transacción; revisión sin cambios; descarga con bitácora **antes** de entregar y leyenda «no vigente»            | 7       |
| 9   | Distribución y lecturas: destinatarios por persona y «agregar por rol» (resuelve al momento), lecturas pendientes al aprobar, confirmar (solo la propia persona), «requiere nueva lectura», conteo por versión, baja de la persona ‖ | 8       |
| 10  | ✅ Vínculos con entradas adoptadas y controles de la empresa, filtro «entradas sin documento vigente» y retención por tipo con su motivo ‖                                                                                              | 6       |
| 11  | ✅ Adaptadores de PostgreSQL de 6 a 10 y pruebas de integración con la base real: **aislamiento** (incluida la descarga), rollback si falla la bitácora, carrera de dos aprobaciones (una sola vigente), versión inmutable              | 6 a 10  |

## Fase 3 — Contrato y API

| ID  | Tarea                                                                                                                                                                                                                  | Depende |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 12  | ✅ Contrato OpenAPI de documentos, versiones, flujo, distribución, lecturas, vínculos y retención; **guardas de privacidad** con textos libres acotados (`maxLength`); tipos generados                                    | 6 a 10  |
| 13  | ✅ Controladores de documentos, versiones y flujo (subida multipart con 413 y 415, aprobar, devolver, descarga): 401 → 403 → 400 → 404 → 409, la empresa del token manda, 404 indistinguible, conformidad con el contrato | 11, 12  |
| 14  | ✅ Controladores de distribución, lecturas, vínculos, cobertura y retención + conformidad                                                                                                                                 | 11, 12  |

## Fase 4 — Interfaz web

| ID  | Tarea                                                                                                                                                                                  | Depende |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 15  | ✅ Pantalla **Documentos**: lista con filtros y marcas (sin vigente, revisión vencida, lecturas pendientes), alta, detalle con historial y versión vigente; navegación; textos es-EC; axe | 13      |
| 16  | ✅ Versiones y flujo: subir versión, enviar a revisión, aprobar y devolver (con la excepción del único administrador), descarga con rótulo «no vigente»; formularios por la guardia común | 13, 15  |
| 17  | ✅ **Mis lecturas pendientes** y confirmar; panel de distribución y conteo «N de M» por versión (frase «constancia de conocimiento, no capacitación») ‖                                   | 14, 15  |
| 18  | ✅ Revisión periódica, retención por tipo y vínculos con requisitos y controles; filtro «entradas sin documento vigente»; axe ‖                                                           | 14, 15  |

## Fase 5 — Verificación y cierre

| ID  | Tarea                                                                                                                                                                                                                                                   | Depende |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 19  | ✅ `pnpm web:verify-documentos` con todo real: flujo completo (redactar, revisar, aprobar, leer), una sola vigente, separación de funciones, permisos por rol, descarga y aislamiento con la empresa B; repetible, limpio y bajo 120 peticiones por minuto | 16 a 18 |
| 20  | ✅ STRIDE, clasificación de datos y los insumos nuevos del ADR 028 (lecturas y archivos con datos personales); guía de ejecución ‖                                                                                                                         | 19      |
| 21  | ✅ `/review` completo (arquitecto, multiempresa, seguridad, accesibilidad, cumplimiento y `experto-iso`) y sus correcciones                                                                                                                                | 19, 20  |
| 22  | ✅ PR del módulo; ADR 039 «Aprobado»; `hoja-de-ruta.md` y `docs/fase0/estado.md` al día **en el mismo PR**                                                                                                                                                 | 21      |

## Fuera de esta lista

Editor en línea, comparación de versiones, firma electrónica, flujos de varios pasos, disposición (borrado) de archivos, vínculo documento–evidencia, recordatorios por correo, importación masiva y capacitación formal (spec, sección 9 y ajustes de la sección 11).
