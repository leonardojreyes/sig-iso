# Estado de la Fase 0 — sig-iso

**Léelo primero al iniciar cualquier sesión.**

- **Paso actual:** **Etapa A · Declaración justificada y riesgos básicos · tarea 19 de 20 (fase 6 de 6: Verificación y cierre)** (18 tareas hechas; hoja de ruta en `docs/producto/hoja-de-ruta.md`). Contexto: **MVP de certificación** (plan ágil, `docs/specs/mvp-certificacion/plan.md`): **M1 a M7 hechos y fusionados en `main`** (M6 se cerró el 2026-11-15 con su `/review`; M7, el 2026-11-17 con el PR #26). Siguen fuera del MVP el resto del 0.7 (puerto de IA), el 0.8 y el 0.9. **En curso:** la «Declaración de Aplicabilidad justificada» (`docs/specs/declaracion-justificada/`, spec **aprobado el 2026-11-17**, 20 tareas, rama `feature/declaracion-justificada`).
- **Pasos cerrados:** 0.1, 0.2, 0.3, 0.4 (#1 y #3), 0.5 (#4) y **0.6 (cerrado el 2026-11-09; PR #5 a #11)**. Siguen fuera del MVP: el resto del 0.7, el 0.8 y el 0.9.
- **PR (2026-11-17):** `main` incluye los PR #1, #3 a #12, #15, #18 a #23 y #26 (**M7**, personas). El #2 se cerró a propósito (PR de prueba que viola las reglas). **Abiertos:** #13, #14, #16 y #17 (0.7, 0.8 y 0.9, fuera del MVP: ver «Pendiente del responsable»), #24 (la guardia común de formularios; **ya entró en `main` dentro del #26**, se cierra) y #25 (accesibilidad y contraste del *hover*; **sigue vigente**, solo choca en este archivo). La protección de `main` exige los **7 checks**, incluido `integracion`, y que la rama esté al día. Regla de trabajo: nada se confirma ni se empuja directo en `main`; cada tarea o grupo de tareas va en una rama `feature/…`, con PR y los 7 checks en verde, y el merge lo haces tú.
- **Hitos del MVP integrados:** H1 y H2 (M1 a M3, #19 y #20), H3 (M4 a M6b, #21), elegir empresa al entrar y cerrar sesión (#22), accesibilidad de avisos y tablas (#23) y M7, personas (#26).
- **Corte 0.6 cerrado: 65 de 70 tareas hechas.** Las 5 restantes no bloquean: **4.4** (tuya), **9.2 y 9.3** (OpenFGA, pospuestas por el ADR 029) y **11.2 y 11.3** (worker de intentos fallidos, diferidas a la Fase 1). Plan en `docs/specs/corte-vertical-0-6/`; `/review` completo sin bloqueantes en `docs/revisiones/2026-11-09-review-corte-0-6.md`.

## MVP de certificación — qué está hecho

Plan vigente: `docs/specs/mvp-certificacion/plan.md` (manda sobre los specs largos; proceso ágil: una rama por rebanada, TDD, PR por hito y **un solo `/review` completo al final**). Código en `modules/certificacion` (hexagonal: dominio, aplicación, infraestructura), la API en `apps/api/src/certificacion/` y las pantallas en `apps/web`. Migraciones `0006` a `0008`.

| Hito | Qué entrega | Estado |
| --- | --- | --- |
| **M1** | Anexo A de ISO/IEC 27001:2022 como librería propia (**93 controles** planos, con tipo y grupo, guías de SynapTech; **numeración verificada el 2026-11-13** contra la NTE INEN-ISO/IEC 27001:2023, versión 1.0.0), esquema de librerías v3 y migración `0006`; el listado de requisitos muestra tipo y grupo | **Hecho** (`5bc949b`) |
| **M2** | **Alcance** por norma (texto y aprobación con quién y cuándo) y **diagnóstico**: estado por entrada (cumple, parcial, no cumple, no aplica; «sin evaluar» = no hay fila), comentario, fecha objetivo, **madurez** por norma, capítulo y tema, y concurrencia optimista por versión | **Hecho** |
| **M3** | **Controles de la empresa** y **mapeos** muchos a muchos con las entradas de las normas adoptadas (**marco de controles unificado**: una medida, varias normas) | **Hecho** |
| **M4** | Evidencias con archivo (huella SHA-256, vigencia, reemplazo, descarga protegida) y cobertura derivada de los mapeos. ADR 032 (almacén de archivos) | **Hecho** |
| **M5** | Declaración de Aplicabilidad de 27001 derivada del diagnóstico, los controles y las evidencias; aprobación con versión congelada e inmutable; exportación a Word. ADR 033 (`docx` MIT detrás de `GeneradorDocumentoPort`) | **Hecho** |
| **M6a** | **Cargar normas desde la interfaz** (requisito añadido el 2026-11-13, dentro del MVP): subir las librerías desde la web, sin comandos (ADR 034). Archivos o carpeta del navegador, librería propia de la empresa con RLS, plantilla descargable, errores en palabras, adopción | **Hecho (2026-11-14)** |
| **M6b** | **Multiempresa completo** (requisito añadido el 2026-11-13, después de M6a), ADR 035. **M6b-1** (una persona en varias empresas y cambio de empresa) **hecho 2026-11-15**; **M6b-2** (marca editable: color y logo con verificación de contraste) **hecho 2026-11-15**. Módulos activos y nombre editable quedan fuera del MVP. | **Hecho** |
| M6 | Cierre: `/review` completo, STRIDE ampliado (subida, descarga, exportación), este archivo y la guía de ejecución | **Hecho (2026-11-15)**: `/review` con seis revisores y sin bloqueantes, con sus correcciones (ver «M6 — Revisión completa del hito H3»); STRIDE en `docs/security/stride-mvp-h3.md` |
| **M7** | **Personas:** alta por solicitud de acceso con código corto, cambio de rol y baja, desde la web (ADR 036). La cuenta se sigue creando en Keycloak; la API no guarda credenciales de administración. | **Hecho y fusionado (#26, 2026-11-17)**; `/review` hecho (cinco revisores, sin bloqueantes) |

**M2 y M3 en detalle** (para no tener que releer el código):

- **Tablas** (todas con `empresa_id`, RLS forzada y clave foránea compuesta con la empresa; una prueba de aislamiento por tabla): `alcance` y `evaluacion` (`0007`), `control` y `control_mapeo` (`0008`). La aplicación **no puede borrar** alcances, evaluaciones ni controles: un control se **retira** y su código no se reutiliza. Los mapeos sí se pueden quitar (con rastro). Las entradas de las normas se referencian por `(código de librería, id estable)` **sin clave foránea**, con la versión de la librería fijada al evaluar, así una versión nueva de la librería no deja nada huérfano.
- **API** (contrato primero en `packages/contracts/openapi.yaml`, 19 operaciones protegidas en total): `GET/PUT /alcances`, `POST /alcances/aprobacion`, `GET /diagnostico`, `PUT /diagnostico/evaluaciones`, `GET/POST /controles`, `PUT /controles/{id}`, `POST /controles/{id}/retiro`, `POST /controles/{id}/mapeos` (201 o 200 si ya existía) y `POST /controles/{id}/mapeos/eliminacion` (204). Orden de evaluación **401 → 403 → 400 → 404 → 409**: el permiso se decide antes que la forma, y un recurso de otra empresa es un 404 indistinguible de uno inexistente. El contrato tiene un código nuevo, `409 conflicto` (versión vieja, código repetido, control retirado, tope de 50 mapeos por control).
- **Pantallas** (`/e/<empresa>/…`): `diagnostico`, `alcance` y `controles`, con navegación propia. Las escrituras son formularios `POST` hacia rutas propias de la web que verifican el `Origin`, que la empresa de la dirección sea la verificada y una lista cerrada de campos, y reenvían a la API con el token de la sesión; **la web no decide nada**. El resultado vuelve como un aviso de una lista cerrada. Un 403 se muestra como «sin acceso», sin revelar qué existe.
- **Permisos** (`platform/autorizacion`): el administrador SIG tiene todo; el colaborador consulta el alcance, el diagnóstico y el marco de controles y puede evaluar; los demás roles todavía no pueden nada (ADR 029). Permisos nuevos: `diagnostico.ver|evaluar`, `alcance.ver|gestionar|aprobar`, `controles.ver|gestionar`.
- **Bitácora** (acciones nuevas, siempre dentro de la misma transacción que el cambio): `evaluacion.cambiada`, `alcance.cambiado|aprobado`, `control.creado|cambiado|retirado`, `mapeo.creado|eliminado`. Solo estados, banderas y el objeto: **nunca** el comentario, el texto del alcance ni el nombre o la descripción de un control.
- **Verificación de extremo a extremo** con todo real (Keycloak, API, PostgreSQL y web): `pnpm web:verify-diagnostico` (44 comprobaciones) y `pnpm web:verify-controles` (51). Cubren permisos por rol, `Origin`, concurrencia y aislamiento con la empresa B. **Escriben en tu base local** (marca `VERIF-`): los controles de prueba quedan retirados, no se borran.
- **Medición del 2026-11-11:** `pnpm lint` sin errores (queda un aviso que ya existía), `pnpm typecheck` y `pnpm test` en verde (16 de 16 tareas).

**M4 en detalle:**

- **Tabla** `evidencia` (`0009`): `empresa_id`, RLS forzada, clave foránea compuesta con el control; la aplicación no puede borrar (solo cambia `estado`). Prueba de aislamiento incluida.
- **Archivos** (ADR 032): puerto `AlmacenArchivosPort` con adaptador local (`EVIDENCIAS_DIR`, por omisión `~/.sigiso/evidencias`, `<base>/<empresa>/<uuid>`, permisos 0700/0600). Siete tipos (PDF, PNG, JPEG, TXT, DOCX, XLSX, PPTX) decididos por el **contenido**, no por la extensión; rechaza macros, ejecutables, SVG/HTML y ZIP sospechosos; máximo 25 MB; subida en dos fases (el registro solo se confirma si el archivo llegó completo).
- **API** (+6 operaciones): `GET/POST /controles/{id}/evidencias`, `POST /evidencias/{id}/reemplazo`, `POST /evidencias/{id}/eliminacion`, `GET /evidencias/{id}/archivo`, `GET /cobertura`; errores nuevos 413 y 415.
- **Cobertura** por entrada: cubierta, evidencia vencida, sin evidencia, sin control o no aplica; la fecha «hoy» es la de Ecuador.
- **Bitácora:** `evidencia.creada|reemplazada|eliminada|descargada|subida_rechazada`; la descarga se registra **antes** de entregar el archivo. Permisos `evidencias.ver|registrar|eliminar` (el colaborador no elimina).
- **Web:** `/e/<empresa>/controles/<id>` (subir, reemplazar, eliminar, descargar, historial) y `/e/<empresa>/cobertura`; `proxyClientMaxBodySize: '27mb'` en Next. `pnpm web:verify-evidencias` (~75 comprobaciones con todo real, incluida una subida de 11 MB y disfraces).
- **Nota:** un formulario con archivo de la empresa B hacia una ruta de A recibe 409 de Next («Server Action unavailable») en vez de 404; no entrega ni guarda nada.
- **Fuera de M4:** cuota por empresa, antivirus, conciliación de huérfanos, verificar la huella al descargar, vencimiento como hecho del _worker_ y vista previa.

**M5 en detalle:**

- **Tablas** (`0010`): `declaracion_version` y `declaracion_fila`, con `empresa_id`, RLS forzada y claves foráneas compuestas; la aplicación solo lee e inserta (**inmutables**). Solo se guarda lo aprobado: el borrador se deriva cada vez.
- **Derivación** (función pura `derivarDeclaracion`): una fila por control del Anexo A de las librerías adoptadas. Cumple, parcial o no cumple → «aplica» (implementado, parcial o no implementado); «no aplica» usa como justificación el comentario de la evaluación; sin evaluar (o «no aplica» sin justificación) → «por decidir». Cada fila trae los códigos de los controles vigentes que la cubren y su cobertura de M4.
- **Aprobar** (solo administrador SIG): 409 si queda algo por decidir, si no hay controles de 27001 adoptados o si otra persona aprobó a la vez. Un control que aplica sin control asignado **sí** se puede aprobar: queda señalado. Congela filas, alcance de 27001 y conteos en una sola transacción; el número es correlativo por empresa.
- **API** (+6 operaciones): `GET /declaracion`, `POST /declaracion/aprobacion`, `GET /declaracion/versiones`, `GET /declaracion/versiones/{id}`, `GET /declaracion/documento` y `GET /declaracion/versiones/{id}/documento`. Permisos `declaracion.ver|exportar|aprobar` (el colaborador no aprueba).
- **Word:** `GeneradorDocumentoDocx` escribe solo texto plano (sin campos, enlaces ni macros); el borrador lleva el rótulo de preliminar y una versión sale **siempre de su copia congelada**. Cada exportación queda en la bitácora con la huella SHA-256 del documento, **antes** de entregarlo (falla cerrada).
- **Bitácora:** `declaracion.aprobada` (versión y cuatro conteos) y `declaracion.exportada` (huella). Nunca texto.
- **Web:** `/e/<empresa>/declaracion` (resumen, alcance, borrador, aprobar, historial, descarga) y `/declaracion/versiones/<id>` (versión congelada). `pnpm web:verify-declaracion` (~45 comprobaciones con todo real; **escribe** en la base local: evalúa como «Parcial» lo que falte del Anexo A y crea versiones aprobadas).
- **Fuera de M5:** el nombre de la empresa en el documento (no hay un puerto para leerlo), firma electrónica, comparar versiones, plantillas propias, PDF, y declaración para 9001 o 42001.

### M6a — Cargar normas desde la interfaz (hecho 2026-11-14)

- **ADR 034** (Aprobado): se sube el **YAML** (no el PDF); selector de archivo o carpeta del navegador; la librería es **propia de la empresa**; solo el administrador SIG (`normas.cargar`).
- **Base (migración `0011`):** `libreria.empresa_id` (nulo = catálogo global), código propio con el prefijo reservado `propia-` (los globales no pueden usarlo), RLS en `libreria`, la aplicación solo **inserta** librerías propias (versión inmutable), adopción limitada al catálogo global o a lo propio. Prueba de aislamiento (`aislamiento-libreria-propia`) y matriz de privilegios actualizada.
- **Caso de uso `CargarLibreriaUseCase`:** permiso → 1 MB y texto UTF-8 → YAML **sin alias ni claves repetidas** → esquema v3 → reglas de contenido (sin texto de norma) → prefijo `propia-` y no ejemplo → guardar todo o nada con la huella → bitácora `libreria.cargada` (código, versión, huella y conteos; nunca el contenido ni el texto de los errores; el rechazo también se registra). Misma versión y mismo contenido = «ya cargada»; otro contenido = rechazo.
- **API:** `POST /librerias/carga` (multipart, un archivo; 201 cargada, 200 ya cargada o rechazada con sus errores; 403 antes de leer el cuerpo; 413 sobre 1 MB) y `GET /librerias` con `propia`.
- **Web:** pantalla `/e/<empresa>/normas` (archivos o carpeta, hasta 20 por tanda, un archivo por petición; plantilla descargable; errores explicados por archivo en palabras claras; lista con adopción) y `pnpm web:verify-normas` (57 comprobaciones con todo real; la plantilla descargable pasa la validación tal cual). El resultado de la subida vive en la memoria del servidor y se muestra una vez.
- **Corregido de paso:** el fallo intermitente de `@sig/certificacion` era de las pruebas (ids de control con reloj y contador que chocaban entre archivos en paralelo); ahora usan UUID aleatorio (9 de 9 corridas completas en verde).
- **Límites conocidos:** un 413 (más de 1 MB declarado) no queda en la bitácora porque se corta antes del caso de uso; el resultado de la subida no se comparte entre varios servidores (igual que las sesiones); la librería subida no se puede borrar ni editar (se sube una versión nueva); adoptar sigue llevando a la pantalla de requisitos.

### M6b-1 — Una persona en varias empresas y cambio de empresa (hecho 2026-11-15)

- **ADR 035** (Aprobado): una cuenta puede tener **una fila `usuario` por empresa**, cada una con su rol (el rol no se hereda). El token sigue mandando como empresa inicial; **una sola operación nombra una empresa**, `POST /sesion/empresa`, que comprueba la pertenencia en la base (404 si no pertenece, con `acceso.cruzado`), registra `empresa.cambiada` en la empresa destino **antes** de guardar y guarda la **empresa activa de ESA sesión** (`sid`, vence a las 8 h).
- **Base (migración `0012`):** la clave de `usuario` pasa a `(empresa_id, id)`; tabla `empresa_activa` (sin RLS por empresa, solo el rol de plataforma, clave foránea compuesta que obliga a pertenecer); la plataforma lee solo `id`, `empresa_id` y `rol` de `usuario` y `id`, `slug` y `nombre` de `empresa`. Matriz de privilegios y pruebas actualizadas.
- **Guardia de la API:** tras verificar el token resuelve la empresa de la petición (activa de la sesión si la persona **sigue** perteneciendo; si no, la del token). Si no puede decidir, responde 500: no cae a otra empresa. Al cerrar la sesión se olvida la elección.
- **API:** `GET /sesion/empresas` y `POST /sesion/empresa`. **Web:** selector en la cabecera (solo para quien tiene varias empresas), `POST /e/<empresa>/empresa/cambiar` y aviso cerrado en el panel.
- **Siembra:** el consultor (`consultor@example.test`) es **administrador en A y colaborador en B**. Para darlo de alta en tu Keycloak sin borrar nada: `pnpm keycloak:realm` y `pnpm keycloak:cuentas` (importación parcial, que respeta el `id`; crear la cuenta por la API normal lo ignora) y `pnpm db:seed`. La contraseña está en `.local/secretos-keycloak.json`.
- **Verificación:** `pnpm web:verify-multiempresa` (39 comprobaciones con todo real): selector solo para quien tiene varias; cambiar a B y recibir el rol de colaborador; A deja de responder en esa sesión; otra sesión de la misma cuenta no se entera; una empresa ajena o inexistente da el mismo «no encontrada»; Origin, método y sesión; B ve exactamente lo que ve su administrador.
- **Límites conocidos:** el cambio de empresa agrega una consulta por petición en la guardia (sin caché); abrir otra pestaña con la empresa anterior da 404 (la sesión ya está en la otra); no hay pantalla para dar de alta personas ni roles (se hace con la siembra); `web:verify-listado` espera 21 entradas y A tiene 114 desde que adoptó el Anexo A (el script está desactualizado desde entonces).

### M6b-2 — Marca editable: color y logo (hecho 2026-11-15)

- **Qué hace:** el administrador SIG cambia el **color** y el **logo** de su empresa desde `/e/<empresa>/marca`; se ve de inmediato en toda la aplicación para toda la empresa. El nombre y el slug **no** se editan (quedan fuera del MVP, igual que los módulos activos por empresa).
- **Base (migración `0013`):** la aplicación puede actualizar **solo** `color_primario` y `logo_url` de **su** empresa (política por empresa + permiso por columnas); las reglas de forma ya estaban en la tabla. Prueba de aislamiento (`aislamiento-marca`, 15 casos) y matriz de privilegios actualizada.
- **Dominio y casos de uso:** permiso nuevo `marca.editar` (solo administrador SIG); `ActualizarMarcaUseCase` (permiso 403 → validación 400 → cambio atómico + bitácora). Al **editar**, un logo no permitido se **rechaza** (al leer, como siempre, se descarta en silencio). El color elegido se guarda tal cual y, si no cumple el contraste AA, la marca que se **aplica** se ajusta y se avisa.
- **Bitácora:** `marca.cambiada` registra solo **qué** cambió (color, logo), nunca el color ni la dirección del logo; si no cambia nada, no registra nada.
- **API:** `PUT /empresa/marca` (cuerpo cerrado: solo `colorPrimario` y `logoUrl`; la empresa sale del token). **Web:** pantalla «Marca» (cómo se ve ahora, aviso de contraste, formulario solo para el administrador) y `pnpm web:verify-marca` (30 comprobaciones con todo real; **restaura** la marca de A al terminar).
- **Límites conocidos:** el logo es una **dirección** (`https` o ruta propia), no se sube un archivo: el navegador la carga desde ese sitio (con `referrerpolicy="no-referrer"`) y quien aloja la imagen ve las visitas; subir el archivo a un almacén propio queda para después. No hay vista previa del color antes de guardar.

### M7 — Personas: alta, cambio de rol y baja (hecho 2026-11-16)

- **ADR 036** (Aprobado): «alta» es **dar acceso a una cuenta que ya existe en Keycloak**, no crearla; la API no guarda credenciales de administración. Una cuenta que ingresa **sin rol no recibe sesión** (se conserva la decisión de H6.1): el *callback* de la web pide su solicitud con ese token y muestra el código en `/acceso-pendiente` desde una cookie sellada de corta vida (≤ 10 min). El administrador SIG ve `/e/<empresa>/personas`: aprueba una solicitud escribiendo nombre, correo y rol (las cuentas no traen nombre ni correo en el token), la descarta, cambia el rol o da de baja.
- **Base (migración `0015`):** tabla `solicitud_acceso` (RLS forzada; una vigente por persona y empresa; código `XXXX-XXXX` de un alfabeto de 31 sin 0, O, 1, I ni L; vence a los 7 días; tope de 50 vigentes por empresa), y `usuario.baja_en` y `usuario.version`. **La aplicación vuelve a poder fijar `rol`** (la 0005 se lo había quitado) por columnas; quién puede lo decide el permiso. Una baja deja el rol en nulo y la fila se conserva.
- **API** (+6 operaciones, 41 protegidas en total): `POST /acceso/solicitud` (sin permiso, 201 o 200 si ya había una), `GET /personas`, `POST /personas/solicitudes/{id}/aprobacion` y `/descarte`, `PUT /personas/{id}/rol` y `POST /personas/{id}/baja`. Permisos nuevos `personas.ver` y `personas.gestionar` (**solo** el administrador SIG; el colaborador ni siquiera ve la lista). Orden 401 → 403 → 400 → 404 → 409. Una empresa **no puede quedarse sin administrador**, ni con dos bajas simultáneas (se bloquean las filas al contar; probado con una carrera real).
- **Bitácora** (misma transacción): `acceso.solicitado`, `acceso.rechazado`, `usuario.alta`, `rol.cambiado`, `usuario.baja`; solo identificadores y roles, **nunca** nombre, correo ni código.
- **Contrato:** las guardas de privacidad tienen excepciones **exactas y explicadas** (el correo solo en `Persona` y en la aprobación; el nombre solo en la aprobación).
- **Siembra:** `CUENTAS_SIN_ACCESO` (`pendiente`, empresa A) existe en Keycloak pero **no** se inserta como persona. Para tenerla: `pnpm db:migrate`, `pnpm keycloak:realm` y `pnpm keycloak:cuentas` (no cambia contraseñas existentes).
- **Verificación:** `pnpm web:verify-personas` (50 comprobaciones con Keycloak, API, PostgreSQL y web; **escribe** en tu base local y deja a `pendiente` dada de baja para poder repetirlo). Cubre: sin sesión pero con código; la baja y el cambio de rol rigen de inmediato en una sesión abierta; volver a pedir acceso reactiva a la misma persona; último administrador; aislamiento entre empresas. STRIDE en `docs/security/stride-mvp-m7.md`.
- **Límites conocidos:** crear la cuenta en Keycloak sigue siendo un paso aparte; quien pide acceso se identifica ante el administrador **fuera del sistema** (el código no prueba quién es); un rol por persona y empresa; sin pantalla para editar el nombre o el correo de una persona ya aprobada; **solo datos de prueba** hasta el asesor legal (ADR 028; se suma el tratamiento «solicitud de acceso con código» a sus insumos).


**Revisión del M7 (2026-11-16):** cinco revisores en paralelo (arquitectura, aislamiento entre empresas, seguridad, accesibilidad y cumplimiento): **sin bloqueantes**, todos «aprobar con correcciones». Corregido: la inserción de solicitudes quedó por columnas (migración 0016); el bloqueo de administradores pasó a `for no key update`; un choque de clave al aprobar ya no se informa como correo repetido; la lista de personas tiene tope de 1000; la cookie del código lleva etiqueta de dominio (`t: 'acceso'`); accesibilidad (nombre accesible de «Descartar solicitud», código legible por lector de pantalla y como `h3`, menos regiones, aviso sin título repetido); pruebas de lectura cruzada de `usuario` y mensajes exactos en las de aislamiento; ADR 036 y 028 completados.
**Deuda anotada del M7 (no bloquea):** la lista de roles está copiada en cuatro sitios y la forma del código en seis (derivarlas de `@sig/autorizacion` y del contrato); `BitacoraDeUnidad` vive en el puerto de marca; `llamarApi` y `pedirSolicitud` repiten el `fetch`; `vencerVencidas` escribe en cada llamada; sin «Salir» en la pantalla del código; sin enfriamiento tras un descarte; cookie del código sin borrar al aprobarse; axe en navegador real y lector de pantalla pendientes (jsdom no calcula contraste); `usuario.alta` no distingue alta nueva de reactivación.

### M6 — Revisión completa del hito H3 (2026-11-15)

Un solo `/review` con seis revisores en paralelo sobre los 316 archivos del hito (M4 a M6b): arquitectura, aislamiento entre empresas, seguridad, accesibilidad, cumplimiento y experto ISO. **Ningún hallazgo bloqueante.** Veredictos: arquitectura, aislamiento y seguridad «aprobar con correcciones»; accesibilidad, cumplimiento y experto ISO «corregir (no bloqueante)». El STRIDE ampliado de los flujos nuevos está en `docs/security/stride-mvp-h3.md`.

**Corregido en esta revisión**

- **Seguridad:** el logo de la empresa aceptaba cualquier ruta del propio sitio (por ejemplo la descarga de un documento), y cada persona que cargara una pantalla la habría pedido con su sesión. Ahora solo es una dirección `https` o un archivo de imagen bajo `/logos/` (dominio, web, contrato y base, migración `0014`).
- **Aislamiento:** si la elección de empresa de una sesión dejaba de valer (por ejemplo, se le quitaba el rol al consultor en esa empresa), la API volvía **en silencio** a la empresa del token mientras la pantalla seguía mostrando la otra. Ahora responde 401 y olvida la elección (ADR 035, punto 4).
- **Arquitectura / seguridad:** el límite de frecuencia se aplica **antes** de consultar la empresa activa (así protege también a la base); y la subida de librerías y de evidencias ya no procesa el cuerpo de una petición **sin sesión**.
- **Experto ISO:** el Word lleva la nota de que los controles salen del tratamiento de riesgos (documentos externos), como prometía el plan; y la declaración solo incluye controles de la **edición 2022** del Anexo A (no mezcla ediciones).
- **Accesibilidad:** el menú ya no desborda en pantallas angostas; el selector de empresa tenía dos etiquetas; mensajes de la marca más claros.
- **Pruebas:** dos pruebas de integración dejaban datos sin limpiar (la del caso «base caída» salía antes de limpiar): se acumularon 200 librerías y 222 empresas de prueba hasta que el catálogo de `sigiso_test` llegó a su tope y otras pruebas fallaron. Corregido y base de pruebas limpiada.
- **Documentación:** ADR 032 (el 413 por `Content-Length` no deja registro), ADR 034 (límites del detector de texto de normas), ADR 035 (elección inválida y identificador compartido) y ADR 028 (tres insumos nuevos para el asesor legal).

**Decisiones que son del responsable (no se tomaron solas)**

1. **Declaración de Aplicabilidad — tres huecos frente a lo que el plan prometía y un auditor suele esperar:** el **motivo de inclusión** de cada control (riesgo, legal, contractual, negocio), los **controles adicionales** fuera del Anexo A, y la **referencia al plan de tratamiento y al análisis de riesgos** (hoy solo hay la nota fija en el Word). No están implementados: o se hacen antes de presentar la declaración a un auditor, o se declaran como fuera del MVP. Tampoco hay columna de responsable por control.
2. **Títulos del Anexo A (pregunta Q3 del spec de dominio v2):** la librería `iso-27001-2022-anexo-a` reproduce la lista **completa** de los 93 títulos oficiales. La regla 3 permite «título breve»; el cumplimiento lo marca como decisión formal pendiente antes de publicar o vender (cerrar con un ADR o reformular los títulos).
3. **Registro del 413:** un archivo que declara más de lo permitido se corta antes del caso de uso y no deja registro en la bitácora (evidencias y librerías). Registrarlo exige una huella que aún no existe; hoy está documentado como límite.
4. ~~**Alta, baja y cambio de rol de personas:**~~ **resuelto por el M7 (ADR 036, 2026-11-16):** `rol.cambiado`, `usuario.alta` y `usuario.baja` ya los emite la pantalla de personas. Las cuentas de Keycloak se siguen creando aparte (siembra y `keycloak:cuentas`).

**Resuelto el 2026-11-16 (responsable):** (1) la Declaración con motivo de inclusión, controles adicionales y referencia al tratamiento de riesgos queda **fuera del MVP**; el motivo de inclusión es lo primero después. (2) Títulos del Anexo A: el responsable los revisa con su ejemplar de la NTE INEN; la lista de 93 filas con alternativas propias está en `docs/revisiones/2026-11-16-titulos-anexo-a.md` (los títulos actuales ya son frases cortas de 2 a 5 palabras, no los nombres oficiales completos; el riesgo es que algunos coincidan con el nombre usual). (3) El registro del 413 queda como **límite documentado**. (4) Altas, bajas y roles: pantalla mínima de personas, **M7** (ADR 036).

**Deuda anotada (no bloquea el hito)**

- Accesibilidad: el aviso que aparece tras recargar la página no recibe el foco ni se anuncia de forma fiable; la tabla ancha tiene un contenedor de desplazamiento duplicado y no enfocable con teclado; una subida de muchos archivos genera hasta 20 alertas; faltan estados con axe en cobertura y en el panel; no hay prueba de contraste de `primary-subtle`; enlaces sueltos más bajos que el objetivo mínimo de toque.
- Código: `cargar-libreria.use-case.ts` importa un error de otro caso de uso. **Resuelto (2026-11-16):** los cinco manejadores de escritura de la web (`escribir.ts`, `subir.ts`, `editar.ts`, `cambiar.ts` y `adoptar.ts`) comparten la guardia `auth/guardia-formulario.ts` (método, `Origin`, empresa verificada, redirección), y `SLUG`, `UUID`, `COLOR` y `LOGO` viven en `validacion/patrones.ts` (el `UUID` de `flujo.ts` ahora admite mayúsculas, como el resto). Se agregó `.prettierrc.json` (comillas simples, ancho 140) porque el hook `post-edit` ya formatea con Prettier; **solo los archivos tocados quedaron formateados**, el resto del repositorio aún no.
- Rendimiento: la empresa activa agrega una consulta por petición sin caché; el almacén de resultados de carga tiene un tope global de 200 y un reinicio lo borra.
- Antes de producción: `Strict-Transport-Security` y CSP con nonce en la web; verificar la huella al descargar una evidencia; retención, borrado físico y marca de «contiene datos personales» en las evidencias (ADR 028).

### Elegir la empresa al entrar y cerrar sesión (2026-11-15, después del PR #21)

Al probarlo, el responsable señaló dos carencias reales: no había forma de **cerrar sesión** desde la interfaz (la ruta existía, ninguna pantalla la ofrecía) y quien pertenece a varias empresas **entraba a una y solo después podía cambiar**. Corregido:

- **Elegir al entrar:** la portada lleva a quien pertenece a varias empresas a `/empresas` («¿Con qué empresa va a trabajar?», una tarjeta por empresa); quien pertenece a una entra directo. Elegir es `POST /empresas/elegir` (mismo núcleo que el selector de la cabecera; la API sigue decidiendo la pertenencia y dejando el hecho en la bitácora). La página de ingreso por empresa vuelve ahora a la portada (antes volvía a `/e/<empresa>/requisitos` y una persona de varias empresas daba 404 en las demás).
- **Cerrar sesión:** botón en la cabecera de toda pantalla con menú y en la pantalla de elección (`POST /auth/logout`).
- Verificado con todo real en `web:verify-multiempresa` (ahora con el flujo de elección) y `web:verify-login`.

**Límites conocidos del MVP** (decisiones ya tomadas; no son defectos pendientes de corregir):

- Las pantallas **no asignan responsable** (ni en el diagnóstico ni en los controles), aunque la API lo admite. Hoy nada lo asigna; cuando se agregue, reevaluar una entrada debe conservar el responsable.
- «Aprobar» el alcance aprueba el texto **ya guardado**, no lo que esté escrito en la caja; la pantalla lo dice.
- El `409 conflicto` de la API es genérico (el contrato es deliberadamente cerrado); el aviso de la web enumera las causas posibles.
- Un mapeo cuya entrada dejó de estar adoptada se sigue mostrando, sin título y rotulado, y no suma normas al control.
- Solo el administrador SIG gestiona controles y alcance; que el colaborador **proponga** cambios queda para después.
- **Solo datos de prueba** hasta que el asesor legal valide el ADR 028 (sin cambios).
- El campo `nombre` de un control es el título de una medida, no el de una persona: por eso tiene una **excepción explícita** en la prueba de privacidad del contrato (el resto de los cuerpos de petición no admite nombres).

## Corte 0.6 (cerrado) — qué está terminado

- **Catálogo:** `pnpm libraries:load` (4.5) carga las librerías con el rol del catálogo, de forma idempotente, todo o nada, con la huella de cada versión y un hecho de plataforma por carga.
- **Base de datos y aislamiento:** PostgreSQL 16 con RLS, roles `sigiso_*`, migraciones 0001–0005, prueba de aislamiento entre empresas (fases 1 y 2).
- **Bitácora inmutable** encadenada por huellas, con intentos fallidos y mantenimiento (fase 3). ADR 028 de privacidad **aprobado como provisional** (2026-11-08), pendiente del asesor legal.
- **Librerías de normas:** esquema v2, validador con control de texto en el CI, borrador `0.1.0` de la librería de ejemplo (4.1 a 4.3 y 4.6).
- **Dominio y casos de uso** de empresas y normas: marca, catálogo, adopción, listado y consulta con 404 indistinguible (fase 5).
- **API completa** (fase 6): contrato OpenAPI, verificación de tokens, guardia, filtro de 403/404 cruzado, controladores, límite de frecuencia, conformidad del contrato.
- **Autorización por rol desde la base** (ADR 029, tarea 9.4): `usuario.rol` y matriz en código. OpenFGA 1.22.1 instalado pero **pospuesto**.
- **Keycloak 26.8.2 local** (fase 8): realm sin secretos, arranque en 127.0.0.1, ingreso real verificado, mensaje genérico de credenciales inválidas, clientes integrados deshabilitados.
- **Ingreso y portada reales** (10.8): una sola acción hacia Keycloak (la aplicación no pide contraseña), avisos genéricos de error y, con sesión, la portada lleva al listado de la empresa.
- **Adopción desde la pantalla** (10.7): botón solo para el administrador SIG, con `Origin` verificado y aviso de las entradas disponibles.
- **Listado de requisitos real** (10.6): las entradas de las librerías adoptadas con filtros, rótulo de ejemplo y estados vacíos por rol; la cabecera muestra a la persona real.
- **Web, hasta la 10.5:** ingreso OIDC con PKCE, sesión (cookie sellada, renovación, cierre), proxy que protege `/e/<empresa>/…` (404 idéntico a otra empresa, sin caché) y **marca real de la empresa**. Verificado de extremo a extremo con `pnpm web:verify-login` (36 comprobaciones).
- **Siembra** de dos empresas y cuatro cuentas de prueba, `pnpm ram:report`, trazas mínimas y un flag de OpenFeature.

## Corte 0.6 — lo que queda fuera del cierre (5 tareas)

- **4.4 (parcialmente cerrada, 2026-11-13):** el **Anexo A de 27001** (`iso-27001-2022-anexo-a`, ahora `1.0.0`) ya se verificó contra la NTE INEN-ISO/IEC 27001:2023: los 93 controles, su numeración y su reparto por tema coinciden (solo se comparó la numeración y el tema; los títulos y las guías son propios). **Falta** la librería de ejemplo de Estructura Armonizada (cláusulas 4 a 10) y decidir sobre los títulos (Q3). Pendiente original: verificar numeraciones y guías con tus ejemplares y decidir sobre los títulos (`docs/specs/corte-vertical-0-6/verificacion-numeraciones.md`). Mientras tanto la librería de ejemplo `0.1.0` está **cargada en la base local**, marcada «borrador, numeraciones sin verificar»; al verificar se publica la versión siguiente.
- **9.2 y 9.3:** OpenFGA, pospuestas por el ADR 029 hasta que haya permisos por objeto. La autorización por rol funciona desde la base.
- **11.2 y 11.3 (diferidas a la Fase 1, M5):** el worker de intentos fallidos y de eventos de administración. El código de 11.1 queda en el repositorio, probado; la bitácora acepta esos registros, pero nada los alimenta todavía, y la prueba de aislamiento no cubre el paso «intento fallido → bitácora desde Keycloak».

## Pendiente del responsable

1. **PR #13, #14, #16 y #17 (pasos 0.7, 0.8 y 0.9, todos fuera del MVP). Propuesta del 2026-11-17**, comprobada simulando la integración con el `main` actual:
   - **#16** (ADR 031, **aprobado**: se difiere el 0.8 y se reduce el 0.9): **integrar**. Solo choca en el índice de ADR (`docs/adr/README.md`).
   - **#17** (paquete mínimo del 0.9: STRIDE, clasificación de datos, política de IA): **integrar**, no choca. Después, sumar a `clasificacion-datos.md` lo del M7 (solicitud de acceso, cookie del código, nombre y correo que escribe el administrador).
   - **#13** (spec, plan y tareas del 0.7; ADR 030 en estado «Propuesto»): **integrar**; solo choca en el índice de ADR. El ADR 030 sigue «Propuesto» hasta tu aprobación expresa.
   - **#14** (cimientos de IA, +1785 líneas, 20 archivos): **no integrar ahora; pasarlo a borrador.** Es código sin uso en el MVP y choca con `platform/autorizacion/src/roles.ts` y `platform/auditoria/src/dominio/catalogo.ts` (permisos y acciones del M7). Al retomar el 0.7 se rebasa uniendo las dos listas. `feature/ia-dominio` (esqueleto del módulo `asistente`, sin PR) queda apilada sobre él.
   - Orden sugerido: #16, #17 y #13 (cada uno rebasado sobre `main`, resolviendo el índice de ADR). Puedo preparar los tres rebases si me lo pides.
2. **#24 y #25 (míos).** El **#24** ya está contenido en `main` por el #26: **cerrarlo**. El **#25** sigue vigente (arreglo del contraste del *hover* con cualquier color de marca, axe en cobertura y panel, enlaces con objetivo táctil): rebasarlo sobre `main` (solo choca en este archivo) e integrarlo.
3. **Aprobar o ajustar el recorte del 0.7** y el ADR 030 (modelo por defecto del asistente), propuestos tras la prueba previa. El plan del MVP deja todo esto para después, así que no bloquea.
4. **Ramas a borrar (propuesta del 2026-11-17).** Todas tienen su PR fusionado, salvo las marcadas.
   - **GitHub y local** (PR fusionado): `fix/pipeline-bootstrap`, `docs/estado-paso-0-4`, `feature/paso-0-5-look-and-feel`, `feature/paso-0-6-plataforma`, `feature/docs-fase0-skills`, `feature/paso-0-6-librerias`, `feature/paso-0-6-adopcion`, `feature/paso-0-6-ingreso`, `feature/paso-0-6-cierre`, `feature/paso-0-6-aislamiento-e2e`, `feature/proteger-local`, `docs/cierre-paso-0-6`, `docs/spec-dominio-v2`, `feature/mvp-m1-anexo-a`, `feature/mvp-m2-m3`, `feature/mvp-m4-evidencias`, `feature/eleccion-empresa-al-entrar`, `fix/accesibilidad-avisos-y-tablas` y `feature/mvp-m7-personas`.
   - **GitHub y local, sin PR propio:** `feature/mvp-m2-diagnostico` (obsoleta: sus 72 archivos ya están en `main` por el #20, más evolucionados). **Solo locales:** `backup-m2-antes-de-rebase` y `tmp-cierre-15` (temporales).
   - **`docs/spec-mvp`: rescatar y luego borrar.** Tiene `docs/specs/mvp-certificacion/spec.md` (el spec aprobado del MVP), que **no estaba en `main`**; se recupera en este mismo PR.
   - **No borrar todavía:** `feature/prueba-violacion-reglas` (ejemplo de PR que viola las reglas); `docs/ruta-mvp`, `docs/seguridad-0-9` y `feature/spec-ia-0-7` (hasta integrar el #16, el #17 y el #13); `feature/ia-cimientos` y `feature/ia-dominio` (0.7, en pausa); `refactor/web-control-escritura` y `fix/accesibilidad-subida-normas` (sus PR #24 y #25: cerrar el primero, integrar el segundo, y entonces borrarlas).
   - Para borrar: `git push origin --delete <rama>` y `git branch -d <rama>` (las locales con PR fusionado por *squash* piden `-D`).
5. **Numeraciones y títulos de la librería de ejemplo (4.4)** cuando tengas los ejemplares: `docs/specs/corte-vertical-0-6/verificacion-numeraciones.md`. **Títulos del Anexo A:** la lista de 93 filas con una alternativa propia para que marques los que se parezcan a tu ejemplar está en `docs/revisiones/2026-11-16-titulos-anexo-a.md`.
6. **Asesor legal para el ADR 028** (aprobado como provisional el 2026-11-08): validar bases de tratamiento, retención, derechos de las personas y el rol de SynapTech (`docs/adr/028-privacidad-y-bitacora.md`, «No resuelto» e «Insumos para el asesor legal»). **Bloquea el uso con datos de personas reales**, incluido el personal de SynapTech, y en todo caso al primer cliente externo.
7. **A1 de la revisión de calidad** (el repositorio de GitHub es público): decisión tuya, pendiente; requiere un ADR. Sus demás hallazgos (`docs/revisiones/2026-11-08-revision-calidad-fase0.md`): M1, M5 y la protección de `.local/` resueltos; A2, M3 y M4 son prerrequisitos de la Fase 1 (abajo); **M2** conviene al pasar por la migración de adopción y **B1–B4** al pasar por esos archivos.
8. Para más adelante: integrar OpenFGA cuando haya permisos por objeto (ADR 029); decidir si `acceso.cruzado` se registra también para el catálogo global (ver H6.10 abajo).

Base local lista: `pnpm db:init`, `pnpm db:migrate` y `pnpm db:seed` dejaron los roles y las bases `sigiso`, `sigiso_test` y `openfga` con el esquema migrado (**hasta la `0016`**) y las dos empresas de prueba; `pnpm libraries:load` carga las librerías (la de ejemplo y, desde M1, el Anexo A de 27001; si todavía no adoptaste esta última, hazlo desde la pantalla de requisitos); las claves están en `.env.local` y `.local/` (ignorados). La empresa A ya adoptó la librería de ejemplo (ver «Brechas y avisos»). Los scripts `web:verify-diagnostico` y `web:verify-controles` dejaron en tu base datos de prueba de A: una evaluación, un alcance y controles `VERIF-…` retirados.

## Próximos pasos técnicos

1. **Declaración de Aplicabilidad justificada** (siguiente; spec por aprobar en `docs/specs/declaracion-justificada/`): motivo de inclusión por control, registro de riesgos básico vinculado a controles y referencia al tratamiento en el Word. Cierra el hueco 1 de «Decisiones que son del responsable» del M6.
2. **Integrar o cerrar los PR abiertos** según la propuesta de «Pendiente del responsable» (#16, #17, #13; #14 en borrador; #24 cerrar; #25 rebasar).
3. **Después del MVP:** el resto del 0.7 (IA local, modelo pequeño con su tamaño informado antes de descargar), 0.8 (Helm y OpenTofu validados, sin clúster) y 0.9; y los prerrequisitos de la Fase 1 de abajo que el MVP no resolvió.


- **Actualizado:** 2026-11-17

## Prerrequisitos de la Fase 1 (de la revisión de calidad del 2026-11-08)

**No se empieza la Fase 1 sin resolver estos tres puntos.** Se abordan juntos con un `/spec` de «modelo de dominio v2 y esquema de librerías v3», validado con `experto-iso`, más los ADR correspondientes.

- **A2 · Esquema de librerías limitado a la Estructura Armonizada.** `libreria_entrada` (migración 0002) exige `capitulo between 4 and 10` y `nivel in (1, 2)`, y `packages/normas-schema/libreria-norma.schema.json` tiene la misma restricción. No admite los controles del Anexo A de 27001 ni de 42001 (base de la Declaración de Aplicabilidad) y contradice P14. Corrección: tipo de entrada `clausula | control | objetivo`, sección/tema libre, jerarquía de profundidad variable con `padre_id`, atributos propios por norma; migración nueva + ADR + una librería de prueba con controles de Anexo A.
- **Avance con el MVP (2026-11-11):** **A2** quedó resuelto en lo mínimo con M1 (migración `0006` y esquema v3: `tipo` `clausula` o `control`, `grupo`, `capitulo` opcional en los controles, y la librería del Anexo A de 27001); siguen pendientes la jerarquía con `padre_id`, el tipo `objetivo`, los atributos por norma y las librerías de 42001 y 9001. **M4** (el alcance) quedó cubierto con un texto por norma y su aprobación; sedes y exclusiones en tablas, Certificado, Activo de información, evaluación de impacto de IA, orígenes de NC y clasificación de hallazgos siguen pendientes. **M3** (roles múltiples) sigue pendiente: el MVP funciona con un solo rol por persona.
- **M3 · Un solo rol por persona.** Pasar a roles múltiples (`usuario_rol` con vigencia opcional) y modelar la relación persona–proceso para validar la independencia del auditor (no audita su propio trabajo) y el acceso limitado en el tiempo del auditor externo. Hoy `usuario.rol` y la matriz en código (ADR 029, tarea 9.4) asumen un solo rol.
- **M4 · Entidades que faltan en el modelo de dominio** (`docs/producto/modelo-dominio.md`): Certificado (número, organismo, alcance, emisión, vencimiento, estado); Alcance por norma con sedes y exclusiones justificadas; Activo de información; Evaluación de impacto de sistemas de IA (42001); orígenes de No conformidad (queja, incidente, revisión por la dirección); clasificación de hallazgos de auditoría externa (NC mayor, NC menor, observación, oportunidad de mejora) y plazos de cierre.

## Brechas y avisos del cierre del corte 0.6

- **H6.10 · el 404 cruzado no se registra como `acceso.cruzado`.** El evento existe y el filtro de la API lo maneja, pero ningún código de producción lo emite y el proxy de la web responde 404 sin escribir en la bitácora. La indistinguibilidad del 404 sí está verificada. Resolverlo en la Fase 1 (detectar «otra empresa» comparando el slug de la URL con la empresa del token).
- **`pnpm web:verify-listado` adopta la librería para la empresa A** si no estaba adoptada (lo advierte su cabecera). `web:verify-aislamiento` no adopta nada.

## Respuestas de arranque (`/fase0-inicio`)

| #   | Pregunta                      | Respuesta                                                                |
| --- | ----------------------------- | ------------------------------------------------------------------------ |
| 1   | Nombre de código              | `sig-iso` (se mantiene)                                                  |
| 2   | Destino del primer despliegue | Solo local por ahora (0.8 deja Helm/OpenTofu validados, sin clúster)     |
| 3   | Revisores humanos de PR       | Solo el responsable                                                      |
| 4   | Repositorio GitHub            | Autorizada su creación (se hará en 0.2; visibilidad privada por defecto) |
| 5   | Ollama                        | Modelo pequeño (~3B), local; tamaño a informar antes de descargar (0.7)  |

## Decisiones

ADR 001–025, 027 y 029 aprobados; ADR 026 aprobado el 2026-11-08; ADR 028 aprobado como **provisional** (falta el asesor legal). Índice: `docs/adr/README.md`.

## Pendientes

- ORM y migraciones: decididos en el ADR 024 (Kysely y migraciones SQL) y en uso desde el corte 0.6.
- Sin Docker (ADR 022): PostgreSQL 16 nativo (Homebrew); Keycloak 26.8.2 y su JRE en `.local/` (ADR 025); OpenFGA 1.22.1 instalado pero sin uso (ADR 029). Falta instalar Valkey (`brew install valkey`) cuando se construya la cola.
- Repo remoto **público** (decisión del responsable, para habilitar protección de ramas sin plan de pago): https://github.com/leonardojreyes/sig-iso .
- TypeScript fijado en 5.9 (la v7 nativa rompe typescript-eslint).
- Librería de DOCX: el plan fija `docx` (MIT) en el ADR 033, que se escribe al empezar M5 y completa el ADR 021; PDF queda fuera del MVP.
- Revisión de `experto-iso`: los subagentes existen desde 0.3 (`.claude/agents/`); el responsable valida las numeraciones de las normas con sus ejemplares (4.4).
- Nota: `CLAUDE.md` global prefiere npm; el monorepo usa pnpm (ADR 003).

## Próximos pasos de la Fase 0

0.1 a 0.6 cerrados → **MVP de certificación (M1 a M7 hechos; sigue la Declaración de Aplicabilidad justificada)** → resto del 0.7 → 0.8 → 0.9

## Paso 0.3 — notas

- Creados: `CLAUDE.md` raíz (56 líneas) y por carpeta (`apps/`, `modules/`, `docs/`, `libraries/`), `.claude/settings.json`, hooks Node en `.claude/hooks/`, 8 subagentes y 8 comandos.
- Los subagentes y comandos nuevos se cargan al **reiniciar la sesión de Claude Code**; la demostración se revisó manualmente con sus listas de control.
- Hooks probados: bloquean `.env*` (también rutas Windows), borrado recursivo forzado, `push` a `main`; permiten `.env.example`, `pnpm test`, push a `feature/*`.
- **Skills creados (2026-11-08):** `.claude/skills/{modulo-hexagonal,migracion-rls,libreria-normas,endpoint-contrato}/SKILL.md`, cada uno con cuándo usarlo, pasos, ejemplo y criterio de terminado, basados en la estructura real del repositorio (`modules/empresas` y `modules/normas`, `platform/db/migrations`, `packages/normas-schema`, `packages/contracts`, `apps/api`) y en los ADR 001, 010, 024, 025, 026, 027 y 029. Con esto existen los 8 subagentes, 4 skills, 8 comandos y 4 hooks, todos en git (solo `settings.local.json` está ignorado).
- **Defecto encontrado y corregido en los hooks (2026-11-08):** `settings.json` los invocaba con ruta relativa (`node .claude/hooks/pre-edit.mjs`) y las reglas de denegación del entorno eran relativas al directorio actual (`./.env`); si el directorio de trabajo de Claude Code no era la raíz del repositorio, Node fallaba con código 1 (no bloqueante) y **una escritura de `.env` prosperó** (archivo de prueba, ya borrado). Ahora los cuatro hooks usan `node "$CLAUDE_PROJECT_DIR/.claude/hooks/<nombre>.mjs"` y se agregaron denegaciones `**/.env` para leer, editar y escribir. Verificado ejecutando cada comando desde una subcarpeta: `pre-edit` sale con 2 ante `.env` y con 0 ante un archivo normal. **Los cambios de hooks se aplican al reiniciar la sesión de Claude Code (o revisándolos en `/hooks`).** Para Windows se asume el intérprete de Git Bash, que expande `$CLAUDE_PROJECT_DIR`.
- **Protección de `.local/` (hallazgo del `/review` del 2026-11-09, aprobada por el responsable):** el hook de Bash bloquea leer o copiar `.local/secretos-*` y `.local/realm/` (realm resuelto, con contraseñas) con `cat`, `head`, `grep`, `sed`, `cp`… y por redirección; los registros (`*.log`) y el resto de `.local/` siguen legibles. `pre-edit` bloquea editar o escribir cualquier archivo de `.local/`, y `settings.json` deniega `Read` de esos secretos y `Edit`/`Write` de `.local/**`. 58 pruebas en `pnpm test:hooks`. Los scripts de pnpm leen y escriben esos archivos por su cuenta, sin pasar por estas reglas. Se aplica al reiniciar la sesión.
- **Endurecimiento de permisos y hooks (M1, 2026-11-09):** las reglas del hook de Bash viven ahora en `.claude/hooks/reglas-bash.mjs` (función pura) con 47 pruebas en `reglas-bash.test.mjs` (`pnpm test:hooks`, usa `node:test`). Cambios: bloquea la lectura/copia de `.env`, `.env.local`, `.env.*` (excepto `.env.example`) con `cat|head|tail|less|more|grep|sed|awk|bat|cp|mv|…` y por redirección; con `psql` bloquea `DELETE|UPDATE|ALTER|GRANT|REVOKE|CREATE ROLE` salvo contra `sigiso_test`; bloquea `git checkout .`, `git checkout -- .` y `git restore` (se permite `--staged`). En `settings.json`, `Bash(node:*)` pasó a `node scripts/*`, `node .claude/hooks/*` y `node --test .claude/hooks/*` (`node -e` vuelve a pedir aprobación) y se agregaron denegaciones para `git checkout .` y `git restore`. Los cambios de `settings.json` se aplican al reiniciar la sesión.
- Limitaciones: hooks no probados en Windows real; el escaneo de secretos del hook Stop es básico (gitleaks completo en 0.4); el hook de Bash evalúa el texto completo del comando, así que puede dar falsos positivos si el texto menciona un comando prohibido.

## Paso 0.4 — notas

- Pipeline: `.github/workflows/ci.yml` (lint, tipos, cobertura 80 % en dominio, build en macOS+Windows, validación de librerías) y `seguridad.yml` (gitleaks, Semgrep CE, OSV, Trivy, SBOM CycloneDX, licencias). Artefactos `evidencia-*` (90 días); ver `docs/security/evidencias/README.md`.
- **Protección de la rama principal activa:** PR obligatorio, 7 checks requeridos (`verificar` macOS/Windows, `integracion`, `gitleaks`, `semgrep`, `osv-scanner y licencias`, `trivy y SBOM CycloneDX`; eran 6 hasta el paso 0.6), historial lineal, sin force-push, también para administradores. Revisores requeridos: 0 (el responsable es el único revisor).
- **PR correcto (#1):** 6 de 6 checks en verde, incluido Windows. Integrado por el responsable.
- **PR que viola reglas (#2, cerrado sin integrar):** `gitleaks` detectó 2 secretos falsos y `osv-scanner y licencias` rechazó `mupdf@1.28.1` (AGPL-3.0-or-later). Estado de merge: BLOCKED. Además, GitHub push protection bloqueó por sí solo una clave con formato AWS.
- El primer run falló por dos defectos propios (tag inexistente de `trivy-action`, carpeta `libraries/normas` ausente en checkout limpio); corregidos en #1.
- OSV: 2 vulnerabilidades medias en `minimatch` transitivo (Nx/ESLint), ignoradas hasta 2026-12-04 en `osv-scanner.toml`.
- Pendientes: axe (llega con las pantallas, 0.5); anclar acciones por SHA antes de producción; Trivy no detectó los secretos falsos (solo gitleaks), aceptable porque gitleaks es el control principal; el merge a la rama principal lo hace el responsable (el clasificador de permisos me lo bloquea).
- Efecto de hacer público el repo: el correo del autor de los commits es visible.

## Paso 0.5 — notas

- Entregado: `packages/tokens`, `packages/ui` (base + 4 de dominio), `apps/storybook`, cinco pantallas plantilla en `/e/<empresa>/…` (empresas de prueba `a` verde y `b` azul), guía en `docs/design/guia-de-estilo.md`, ADR 023 (Aprobado).
- Contraste WCAG AA verificado por prueba automática (claro, oscuro y dos empresas): 24 pruebas en verde. `lint`, `typecheck`, `test` y `build` en verde.
- La pantalla de ingreso es solo plantilla: sin autenticación hasta 0.6.
- `/review` hecho (arquitectura, multiempresa, seguridad, accesibilidad). Corregido: validación del id de empresa, CSS de marca solo de la empresa actual, datos demo por empresa con pruebas de aislamiento, `logoUrl` validado, cabeceras básicas, `<button>` dentro de `<a>` (nuevo `BotonEnlace`), foco y resumen de errores en el formulario, migas subrayadas, `prefers-reduced-motion`, textos a i18n.
- Pendiente (registrado, no bloquea 0.5): CSP con nonce (necesita middleware; antes de producción); valores `rem` arbitrarios a tokens; regla de lint para la regla 7; `role="meter"` y contraste de la pista en barras; cabeceras `sr-only` en la matriz de riesgos; hex literales en pruebas; constante compartida para la clave `sig-tema`; autorización por empresa (OpenFGA) en 0.6.
- Aprobado por el responsable: pantallas, Storybook y ADR 023.
