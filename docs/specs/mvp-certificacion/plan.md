# Plan ágil — MVP de certificación (recorte medio)

- **Estado:** Aprobado por el responsable el 2026-11-10. Manda sobre los specs largos de esta carpeta y de `modelo-dominio-v2`.

Se guarda como `docs/specs/mvp-certificacion/plan.md` y **manda sobre los specs largos** (`mvp-certificacion/spec.md`, `modelo-dominio-v2/spec.md`), que quedan como referencia del norte, no como contrato.

## Contexto

Preocupa que el ciclo se volvió lento (5 días) por el ceremonial (spec, plan, tareas, varios revisores, ADR, PR apilados) y por un alcance que creció (puerto de IA, esquema con jerarquías, versiones inmutables en todo). Se decidió **recorte medio** y **proceso ágil**.

**Lo ya construido se reutiliza casi todo:** ingreso con Keycloak y sesión, aislamiento por empresa (RLS), bitácora inmutable, autorización por rol, API, marco web, sistema de diseño, catálogo, adopción y listado de requisitos, CI. Lo único que no entra al MVP es lo del 0.7 (detector, eventos y prompts de IA; unas 5 tareas pequeñas) y los documentos largos.

## Alcance del MVP (qué sí)

1. **Anexo A de ISO/IEC 27001:2022** como entradas de la librería, **planas** (tipo y grupo/tema, sin jerarquía de padres), «borrador, numeraciones sin verificar».
2. **Alcance** como texto por norma, con aprobación simple (quién y cuándo). Sin tablas de sedes ni exclusiones; el proyecto de certificación es **implícito** (uno por empresa).
3. **Diagnóstico** de cláusulas y controles: estado (cumple, parcial, no cumple, no aplica, sin evaluar), comentario, responsable y fecha objetivo; filtros; **madurez** por cláusula, grupo y norma con desglose; concurrencia optimista.
4. **Controles de la empresa y mapeos** muchos a muchos con entradas de la norma (entrada por entrada).
5. **Evidencias con archivo** (huella SHA-256, tipo documento/registro, fecha del hecho, vigencia opcional), reemplazo, descarga protegida y **cobertura**.
6. **Declaración de Aplicabilidad de 27001:** una fila por control del Anexo A más adicionales, derivada del diagnóstico y los controles; motivo de inclusión; referencia al plan de tratamiento y al análisis de riesgos externo; marcada **preliminar**; **aprobación** con versión congelada e inmutable; **exportación Word**.

## Alcance que NO entra (queda para después)

Proyecto con etapas y sedes/exclusiones en tablas; 42001 y 9001 como librerías con Anexo A y apartados propios; jerarquía de padres y equivalencias; roles múltiples (M3); certificado; asistente de IA; vencimiento registrado como hecho (barrido del _worker_); cuota por empresa y script de conciliación de archivos; antivirus; PDF; comparar diagnósticos.

## Reglas que no se recortan

Regla 2 (aislamiento: una prueba por tabla nueva que intenta leer lo de otra empresa y falla; claves foráneas compuestas con `empresa_id`), regla 4 (bitácora de toda creación, cambio, aprobación y eliminación, sin texto libre), regla 3 (sin texto de normas; el detector de contenido corre sobre la librería y el `.docx`), clasificación de datos (primeros datos Confidenciales) y **solo datos de prueba** hasta validar el ADR 028.

## Decisiones técnicas (solo dos ADR cortos)

- **ADR 032 — Archivos de evidencia (completa el 017).** Puerto `AlmacenArchivosPort` con adaptador de sistema de archivos local (carpeta fuera del repositorio, variable de entorno, en `.gitignore`). Ruta `base/<empresa_id>/<uuid>` con la empresa del **token**, comprobada con `path.resolve`. Orden: temporal → SHA-256 (en el adaptador) → transacción única (fila + bitácora) → renombrar; si falla el registro, borrar el temporal. Lista cerrada PDF, PNG, JPEG, TXT, DOCX, XLSX, PPTX (sin SVG, HTML ni macros), tipo por **firma del contenido**, 25 MB, un archivo por petición, descarga como adjunto con `nosniff`. Subida con `multer`. El adaptador S3 sustituye al local sin cambiar el puerto.
- **ADR 033 — Exportación (completa el 021):** `docx` (MIT) detrás de `GeneradorDocumentoPort`; se corre `scripts/check-licenses.mjs` sobre el árbol transitivo.
- Sin ADR para el esquema: **una migración aditiva `0006`** (`libreria_entrada` agrega `tipo` y `grupo`; `capitulo` pasa a opcional solo para controles) y el esquema JSON acepta `esquema: 3` con esos campos opcionales (los archivos v2 siguen validando). Las referencias de la empresa a una entrada son `(libreria.codigo, id_estable)` con el `libreria_id` fijado al evaluar.

## Estructura

Un solo módulo `modules/certificacion` (Nx no permite que dos módulos se importen), con subcarpetas por agregado; un módulo Nest por rebanada en `apps/api/src/certificacion/`; contrato primero; puertos redeclarados; `CatalogoLecturaPort` con adaptador en `apps/api` que delega en `modules/normas` solo por su `index.ts`. Permisos nuevos en `roles.ts` (administrador SIG todos; colaborador: ver, registrar evidencias y proponer evaluaciones; **no** aprobar alcance ni Declaración). Tablas `*_version` solo con `select, insert` para `sigiso_app` y un disparador contra `update`/`delete` (como la bitácora), con prueba.

## Diseño de M5 — Declaración de Aplicabilidad de 27001

**Qué es:** una fila por **control del Anexo A** de las librerías adoptadas que aplican a 27001. Se **deriva** (no se escribe a mano) del diagnóstico, los controles de la empresa y las evidencias; si la empresa quiere cambiar algo, cambia el diagnóstico o los controles y la declaración se recalcula.

**Derivación de cada fila** (función pura en el dominio):

- **Aplicabilidad:** `aplica` si la evaluación es cumple, parcial o no cumple; `no_aplica` si la empresa lo evaluó así (su **justificación** es el comentario, que ya es obligatorio); `por_decidir` si no hay evaluación.
- **Implementación:** `implementado` (cumple), `parcial`, `no_implementado` (no cumple) o `sin_evaluar`; vacía si no aplica.
- **Controles de la empresa** que la cubren (por código, vigentes) y su **estado de cobertura** de M4.
- Título breve y grupo vienen de la librería (propios); **nunca** texto de la norma.

**Aprobación:** solo el administrador SIG. **Se rechaza (409 `incompleta`) si queda algún control «por decidir»**, porque una declaración con huecos no se puede presentar al auditor; una aplicable sin control mapeado **sí** se permite y se marca en el documento como «sin control asignado» (es un hallazgo, no un impedimento). Al aprobar se guarda una **versión congelada** (número correlativo por empresa, quién y cuándo, el texto del alcance de 27001 vigente en ese momento y todas las filas con sus textos). No se edita ni se borra; una nueva aprobación crea la versión siguiente.

**Tablas (migración `0010`, `empresa_id`, RLS forzada, sin `update` ni `delete` para la aplicación):** `declaracion_version` (número, aprobada por/en, conteos) y `declaracion_fila` (clave foránea compuesta con la versión; entrada, título, grupo, aplicabilidad, implementación, justificación, códigos de controles, cobertura). Una prueba de aislamiento por tabla.

**Permisos:** `declaracion.ver` y `declaracion.exportar` (administrador SIG y colaborador), `declaracion.aprobar` (solo administrador SIG).

**API (contrato primero):** `GET /declaracion` (borrador derivado y datos de la última versión aprobada), `POST /declaracion/aprobacion` (201), `GET /declaracion/versiones`, `GET /declaracion/versiones/{id}` (filas congeladas), `GET /declaracion/documento` (borrador, con rótulo «preliminar») y `GET /declaracion/versiones/{id}/documento` (desde la copia congelada). Descargas con las reglas del ADR 032.

**Bitácora** (claves cerradas, sin textos): `declaracion.aprobada` (número y conteos) y `declaracion.exportada` (borrador o número de versión; se registra **antes** de entregar).

**Pasos:** 1 migración y aislamiento · 2 dominio, permisos y eventos · 3 casos de uso, `GeneradorDocumentoPort` y adaptadores (`docx`) · 4 API · 5 web (pantalla, aprobar, historial, descarga) y `web:verify-declaracion`.

**Lo que M5 no hace:** firma electrónica, comparar versiones, plantillas de formato propias de la empresa, PDF, controles que no sean del Anexo A y declaración para 9001 o 42001.

## Bitácora (acciones nuevas, claves y motivos cerrados)

`alcance.aprobado`, `evaluacion.cambiada` (estado anterior y nuevo), `control.creado|cambiado|retirado`, `mapeo.creado|eliminado`, `evidencia.creada|reemplazada|eliminada|descargada|subida_rechazada` (motivos `tipo_no_permitido`, `tamano_excedido`, `firma_invalida`), `declaracion.generada|aprobada|exportada`.

## Rebanadas y proceso (ágil)

Proceso: **una rama por rebanada desde `main`**, TDD con pruebas junto al código, **PR por hito** (para reducir idas y vueltas con `gh pr create`), **un solo `/review` completo al final** (arquitecto, multiempresa, seguridad, cumplimiento). Sin specs, planes ni listas de tareas nuevos: este documento es el alcance.

| #   | Rebanada                                                                                                                  | Qué se ve en pantalla                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| M1  | Anexo A de 27001: migración 0006, esquema, carga, listado con tipo y grupo, librería (93 controles, guías propias breves) | Listado con controles agrupados por tema y filtros    |
| M2  | Alcance (texto, aprobación) y diagnóstico con madurez                                                                     | Evaluar cláusulas y controles, ver la madurez         |
| M3  | Controles de la empresa y mapeos                                                                                          | Marco de controles unificado                          |
| M4  | Evidencias con archivos (almacén local) y cobertura                                                                       | Subir una evidencia y verla respaldar varias entradas |
| M5  | Declaración de Aplicabilidad: derivada, aprobación, versión congelada, exportación Word                                   | El documento descargable                              |
| M6a | **Cargar normas desde la interfaz** (añadido el 2026-11-13): cada empresa sube sus librerías de normas desde la web, sin comandos | Una persona de la empresa carga una librería y la adopta, sin terminal |
| M6b | **Multiempresa completo** (añadido el 2026-11-13): recupera lo de la Fase 0 que el recorte dejó fuera: consultor con varias empresas (cambio explícito de empresa, sin acceso cruzado por defecto), configuración por empresa (normas activas, módulos activos, logo y colores editables) y catálogo global de solo lectura más librerías propias (este último ya cubierto por M6a) | Un consultor entra, elige entre sus empresas y cambia; el administrador de cada empresa configura su marca y sus normas |
| M6  | Cierre: `/review`, STRIDE ampliado (subida, descarga, exportación), `estado.md`, guía                                     | MVP usable por SynapTech                              |

**Hitos de PR:** H1 = M1; H2 = M2 + M3; H3 = M4 + M5 + M6a + M6b + M6.

## M6a — Cargar normas desde la interfaz (requisito añadido, entra al MVP)

**Pedido del responsable (2026-11-13):** hoy una librería se carga con un comando (`pnpm libraries:load`), que no es amigable. Cada empresa debe poder **subir sus normas desde la interfaz**, indicando dónde está el archivo, y después adoptarlas. Debe estar dentro de este MVP, antes del cierre (M6). **Decisiones cerradas el 2026-11-13 y registradas en el ADR 034:** se sube el YAML (no el PDF); selector de archivo o carpeta del navegador; la librería es propia de cada empresa (con RLS); solo el administrador SIG carga; plantilla descargable. Las notas de abajo son el análisis previo.

**Decisiones abiertas (a resolver antes de implementar):**
1. **Qué se sube.** Lo previsto por el ADR 026 es la **librería en YAML** (esquema v3, sin texto de la norma), que el sistema ya sabe validar. Subir el **PDF de la norma** es otra cosa: es texto licenciado (la regla 3 prohíbe llevarlo al repositorio y la licencia de INEN es de usuario único) y habría que decidir si el sistema lo lee o solo lo guarda. Se propone empezar por el YAML.
2. **«Especificando el directorio».** Un servidor web no puede leer una carpeta del computador de la persona: lo usual es un selector de archivos o carpeta del navegador, que sube los archivos. Si se quiere una ruta de carpeta del servidor, solo sirve en instalaciones de una sola máquina y exige una lista permitida de carpetas. Confirmar cuál se quiere.
3. **Alcance.** El ADR 026 hoy tiene un catálogo **global e inmutable** que se carga con permisos propios (`sigiso_catalogo`) y cada empresa lo adopta. Subir desde la web obliga a decidir si la librería es **propia de la empresa** (con `empresa_id` y RLS, como prevé el ADR 020) o va al catálogo global (solo un administrador de la plataforma).
4. **Seguridad de la subida.** Lista cerrada de tipo (YAML), tamaño máximo, validación completa con el esquema y las reglas de contenido **antes** de guardar, rechazo si trae texto de norma, y registro en la bitácora (qué librería, versión y huella; nunca el contenido). Mismo cuidado que las evidencias (ADR 032).
5. **Permisos.** Probablemente solo el administrador SIG de la empresa (permiso nuevo), no el colaborador.

**Esperado al terminar:** pantalla «Normas» con subir, ver el resultado de la validación (errores en palabras claras), adoptar y ver versiones; un ADR nuevo; migración con RLS si la librería es por empresa; pruebas de aislamiento; `web:verify-normas`.

## M6b — Multiempresa completo (requisito añadido el 2026-11-13, después de M6a)

**Pedido del responsable:** el MVP debe ser multiempresa como lo mostraba la Fase 0 (`FASE0.md` 5.4), que el recorte medio dejó en «una empresa = un proyecto». El aislamiento por RLS ya existe; falta lo que se ve y se usa. Entra: **consultor con varias empresas** (cambio explícito, sin acceso cruzado por defecto), **configuración por empresa** (normas activas, módulos activos, logo y colores editables por su administrador, con la verificación de contraste WCAG) y **catálogo global + librerías propias** (con M6a). Queda fuera: base dedicada y despliegue dedicado, SSO propio por empresa, modelos de IA por empresa.

**Por diseñar (con un ADR corto antes de implementar):** cómo se modela la pertenencia de un usuario a varias empresas (hoy `usuario` lleva un solo `empresa_id` y la empresa sale del token); cómo se cambia de empresa sin que el token autorice cruces (nuevo token por empresa vs. selección verificada en el servidor); permisos del consultor por empresa; bitácora del cambio de empresa; pruebas de aislamiento y de que un cambio no filtra datos de la anterior.

## Diseño de M3 — controles de la empresa y mapeos

**Qué es un control de la empresa:** una medida propia de la organización («Política de contraseñas», «Revisión trimestral de accesos»), **no** un control del Anexo A. Una misma medida puede responder a varias entradas de una o varias normas: de ahí el **marco de controles unificado** (se trabaja una vez, se cubre en varias normas). La relación con la norma se guarda **entrada por entrada** (sin jerarquías ni equivalencias, que quedan fuera del MVP).

**Tablas (migración `0008`, todo con `empresa_id` y RLS forzada):**

| Tabla           | Contenido                                                                                                                                                                                                                    | Reglas                                                                                                                                                                                                                                                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `control`       | `id`, `codigo` (1–20, `[A-Za-z0-9._-]`), `nombre` (1–120), `descripcion` (≤1000, opcional), `responsable_id` (opcional), `estado` (`vigente` o `retirado`), `version` (concurrencia optimista), quién y cuándo creó y cambió | `unique (empresa_id, codigo)` y `unique (empresa_id, id)` (clave foránea compuesta). **Sin DELETE** para la aplicación: un control se **retira** (queda el rastro) y su código no se reutiliza.                                                                                                                                                             |
| `control_mapeo` | `control_id` + `(libreria_codigo, id_estable)` de la entrada, quién y cuándo                                                                                                                                                 | PK sobre las cuatro columnas (sin duplicados); clave foránea compuesta `(empresa_id, control_id)`. La entrada se referencia **sin FK** (como `evaluacion`: el catálogo es por versión) y el caso de uso comprueba que esté en las librerías adoptadas. La aplicación puede **insertar y borrar** mapeos (no actualizar); cada alta y baja va a la bitácora. |

**Dominio (`modules/certificacion/src/domain`):** `Control` (crear, cambiar nombre, descripción y responsable, retirar; un control retirado no se cambia ni recibe mapeos) y `MapeoControl` (valor: control + entrada). Tope de **50 mapeos por control**. Los textos no admiten caracteres de control.

**Permisos:** `controles.ver` (administrador SIG y colaborador) y `controles.gestionar` (solo administrador SIG: crear, cambiar, retirar y mapear). El colaborador consulta el marco; proponer cambios queda para después.

**Bitácora** (claves y motivos cerrados; **nunca** el nombre ni la descripción): `control.creado`, `control.cambiado`, `control.retirado` (objeto `control:<codigo>`) y `mapeo.creado`, `mapeo.eliminado` (objeto `mapeo:<codigo>.<id_estable>`).

**Lo que M3 no hace:** evidencias y cobertura (M4), derivar la Declaración (M5), importar controles ni plantillas.

## Diseño de M4 — evidencias con archivo y cobertura

**Qué es una evidencia:** un registro o archivo que demuestra que un **control de la empresa** opera. Cuelga del **control** (no de la entrada): la entrada de la norma queda respaldada **a través de los mapeos** de M3. Así «una evidencia, varias normas» sale sola: subir una evidencia a un control que cubre varias entradas las respalda todas.

**Tabla (migración `0009`, con `empresa_id` y RLS forzada):** `evidencia` guarda el control (clave foránea compuesta), el `tipo` (`documento` o `registro`), el título (1–120), la **fecha del hecho**, la **vigencia** opcional (`vigente_hasta`, no anterior a la fecha del hecho), el `estado` (`activa`, `reemplazada` o `eliminada`), la evidencia a la que reemplaza (`reemplaza_id`) y los datos del archivo: nombre en el almacén (UUID del servidor), nombre original normalizado (≤120), tipo de contenido **de la lista cerrada**, tamaño (1 byte a 25 MB) y **SHA-256**. Los datos del archivo **no se pueden modificar** una vez guardados: la aplicación solo puede actualizar `estado` y quién y cuándo (permiso por columna, como en `usuario`) y **no puede borrar** filas. Reemplazar crea una evidencia nueva y marca la anterior como `reemplazada`; eliminar marca `eliminada`. **El archivo físico no se borra** en el MVP.

**Cobertura (se calcula, no se guarda):** para cada entrada de las librerías adoptadas que no esté evaluada como «no aplica»:

- **cubierta:** algún control vigente mapeado a ella tiene al menos una evidencia activa y vigente;
- **evidencia vencida:** hay evidencias activas pero todas pasaron su vigencia;
- **sin evidencia:** hay controles vigentes mapeados, pero ninguna evidencia activa;
- **sin control:** ningún control vigente la cubre.

Se resume por norma (cantidades y porcentaje de cubiertas) y por entrada. «Hoy» se calcula con la fecha de Ecuador (`America/Guayaquil`). Es una medida de **cobertura documental**, no una opinión sobre la eficacia del control.

**Permisos:** `evidencias.ver` (administrador SIG y colaborador), `evidencias.registrar` (administrador SIG y colaborador: subir y reemplazar) y `evidencias.eliminar` (solo administrador SIG).

**Tope:** 100 evidencias activas por control (acota la respuesta y evita acumulación sin sentido).

**API (contrato primero):** `GET/POST /controles/{id}/evidencias` (la subida es `multipart/form-data`, **un archivo por petición**), `POST /evidencias/{id}/reemplazo` (multipart), `POST /evidencias/{id}/eliminacion` (204), `GET /evidencias/{id}/archivo` (descarga) y `GET /cobertura`. La subida y la descarga siguen el **ADR 032**: la empresa sale del token, el tipo se decide por la **firma del contenido** (nunca por la extensión ni por lo que diga el cliente), la descarga es siempre un adjunto con `nosniff` y queda en la bitácora.

**Bitácora** (claves y motivos cerrados; nunca el título ni el nombre del archivo): `evidencia.creada`, `evidencia.reemplazada`, `evidencia.eliminada`, `evidencia.descargada` y `evidencia.subida_rechazada` (motivos `tipo_no_permitido`, `tamano_excedido`, `firma_invalida`).

**Lo que M4 no hace** (queda fuera por el plan): cuota por empresa, antivirus, conciliación de archivos huérfanos, verificación de la huella al descargar, vencimiento registrado como hecho por el _worker_ y vista previa en el navegador.

## Prerrequisito (tuyo)

Integrar los PR abiertos #13 a #18 (documentos y la fase 1 del 0.7) para partir de un `main` actualizado y evitar conflictos en el catálogo de bitácora y en `estado.md`; los que no quieras (por ejemplo los specs largos) los cierras. Opcional: una regla de permisos que me deje `gh pr create`, para ahorrar un paso por PR.

## Riesgos

| Riesgo                                          | Mitigación                                                                                                                        |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Numeración y títulos del Anexo A sin verificar  | «Borrador» en pantallas y en el Word; los verificas en paralelo, no bloquea                                                       |
| Subida de archivos (el tramo más delicado)      | Lista cerrada, firma, límites, nombre generado, adjunto, `nosniff`, pruebas negativas; antivirus antes del primer cliente externo |
| Declaración sin análisis de riesgos             | Rótulo «preliminar» y nota de riesgos externos en el documento                                                                    |
| M1 rompe pruebas del catálogo                   | Cambio aditivo (columnas con valor por omisión), v2 sigue validando                                                               |
| Datos Confidenciales sin ciclo de vida definido | Solo datos de prueba hasta validar el ADR 028 con el asesor legal                                                                 |

## Verificación

`pnpm db:migrate && pnpm db:seed && pnpm libraries:load` → `pnpm keycloak:start` → `pnpm dev` → `admin-a` recorre alcance, diagnóstico, control, evidencia y Declaración y descarga el Word; `admin-b` no ve nada de A; `pnpm web:verify-aislamiento` en verde (se amplía con las tablas nuevas); `pnpm lint`, `typecheck`, `test:hooks` y la suite de integración en verde; `/review` final sin bloqueantes.
