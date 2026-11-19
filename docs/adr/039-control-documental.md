# ADR 039 — Control documental: versiones, aprobación y lectura confirmada

- **Estado:** Aprobado (2026-11-19) al integrar el PR del módulo. Spec aprobado por el responsable con la propuesta por omisión (`docs/specs/control-documental/spec.md`, sección 11). **No contradice** ningún ADR; reutiliza el almacén de archivos del ADR 032 y la autorización por rol del ADR 029.
- **Fecha:** 2026-11-18
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

Las normas piden que la información documentada de la empresa esté identificada, aprobada, vigente, disponible y conservada. Hoy el producto guarda **evidencias** (registros), no el texto que la empresa decide (políticas, procedimientos). Hace falta un documento controlado sin construir un editor ni un flujo de varios pasos.

## Decisión

1. **Documento y versión.** El documento (código correlativo por tipo: `POL-001`) es la identidad estable; cada **versión** (1, 2, 3…) lleva **un archivo** (los siete tipos de M4, decididos por el contenido, con huella SHA-256) y una nota de cambios obligatoria. Tipos: política, procedimiento, instructivo, formato, manual, **externo** y otro. El externo (norma, reglamento, contrato) lleva emisor y edición opcionales y pasa por el mismo flujo.
2. **Estados de la versión:** borrador → en revisión → aprobada → obsoleta (más «descartada», que no se borra). **Una sola versión aprobada por documento**; aprobar otra deja la anterior obsoleta **en la misma transacción**. No hay vigencia futura: rige desde que se aprueba (se evita un documento sin versión vigente).
3. **Separación de funciones.** El aprobador (permiso `documentos.aprobar`, solo administrador SIG) **no puede ser el autor**. Excepción registrada: si la empresa tiene **un solo administrador** activo, puede aprobar su propia versión con **motivo obligatorio** y el historial la marca «aprobada por su autor». Con dos o más administradores, la regla es estricta. El motivo es texto de la empresa: queda en la base, **no** en la bitácora (solo la bandera `por_su_autor`).
4. **Inmutabilidad.** Una versión aprobada u obsoleta no cambia (la aplicación no puede actualizar su archivo ni su nota). Nada se borra: retirar un documento lo deja sin versión vigente. **No hay disposición (borrado de archivos) en este módulo**: solo se marca la versión obsoleta como «elegible para disposición» al vencer la retención del tipo (años y motivo breve, definidos por la empresa; sin valor por omisión). Es **irreversible**, por eso se difiere y se decide aparte.
5. **Distribución y lectura confirmada.** La distribución es configuración del documento (personas; «agregar a todas las personas de un rol» resuelve la lista en ese momento). Al aprobar se crea una **lectura pendiente por destinatario y versión**; solo la propia persona la confirma. La nueva versión reabre la lectura únicamente si el aprobador marca «requiere nueva lectura». Es **constancia de conocimiento, no capacitación**. Una persona dada de baja deja de contar como pendiente; su confirmación se conserva. No se envían correos.
6. **Clasificación informativa.** La clasificación (pública, interna, confidencial, restringida) **no gobierna el acceso** en el MVP; la interfaz lo dice. Quien tiene `documentos.ver` ve todo lo vigente de su empresa.
7. **Revisión periódica.** Próxima revisión un año después de aprobar (editable). «Revisado sin cambios» lo registran el responsable del documento o un administrador (motivo cerrado: periódica, auditoría, cambio de contexto) y reinicia la fecha sin crear versión.
8. **Permisos** (matriz del ADR 029): `documentos.ver`, `documentos.redactar` y `documentos.leer` para administrador y colaborador; `documentos.aprobar` y `documentos.gestionar` (retirar, distribución, retención, vínculos) solo el administrador. Sale de la lista de cuatro del spec: `gestionar` separa lo que el colaborador no hace.
9. **Vínculos.** Un documento puede respaldar entradas de las librerías **adoptadas** (por código de librería e id estable, sin clave foránea, como los mapeos) y controles de la empresa. La cobertura documental es un **filtro** («entradas sin documento vigente»). Sin vínculo con evidencias.
10. **Bitácora** (misma transacción): `documento.*`, `version.*`, `lectura.confirmada`, `retencion.cambiada`. Objetos de forma exacta (`documento:POL-001`, `version:POL-001.v3`, `retencion:politica`); la huella como versión del objeto; **nunca** títulos, notas, motivos escritos ni nombres. La descarga se registra **antes** de entregar el archivo (falla cerrada).
11. **Datos y RLS.** Tablas con `empresa_id`, RLS forzada, claves foráneas compuestas y una prueba de aislamiento por tabla; las versiones solo se insertan y se actualizan por columnas de estado (nunca el archivo ni la huella).

## Alternativas

- **Editor en línea:** descartado por alcance (otra etapa). **Flujo de varios pasos o por proceso:** descartado (un aprobador). **Vigencia futura:** descartada: dejaba documentos sin versión vigente. **Clasificación que limita el acceso:** pospuesta hasta que existan más roles. **Disposición automática:** descartada (irreversible).

## Consecuencias

- Reutiliza el almacén, la detección de tipo y la descarga protegida de M4; sin dependencias nuevas.
- Las empresas con un solo administrador pueden operar, con rastro visible de que aprobó su propia versión.
- **Solo datos de prueba** hasta que el asesor legal valide el ADR 028: los archivos pueden contener datos personales y las lecturas son datos personales seudonimizados (insumos nuevos para el asesor).
- **Retención:** aplica a las **versiones obsoletas de documentos** (información documentada que se mantiene); los **registros** (evidencias, actas) se conservan por su fecha y se gobiernan en las evidencias (ADR 032). «Elegible para disposición» no es una política de retención completa.
- **Base de tratamiento (hipótesis a validar con el asesor legal, ADR 028 insumo 13):** cumplimiento de la obligación documental de la empresa para versiones y lecturas.
- Pendiente para después: disposición con confirmación, clasificación con efecto, recordatorios, editor y comparación de versiones.
