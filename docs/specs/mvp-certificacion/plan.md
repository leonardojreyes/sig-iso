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
| M6  | Cierre: `/review`, STRIDE ampliado (subida, descarga, exportación), `estado.md`, guía                                     | MVP usable por SynapTech                              |

**Hitos de PR:** H1 = M1; H2 = M2 + M3; H3 = M4 + M5 + M6.

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
