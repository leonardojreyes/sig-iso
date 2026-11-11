# modules/certificacion — alcance, diagnóstico, controles, evidencias y Declaración (MVP)

Plan: `docs/specs/mvp-certificacion/plan.md`. Se construye por rebanadas (M2 alcance y diagnóstico; M3 controles; M4 evidencias; M5 Declaración).

- **Capas:** `domain` (reglas puras: evaluación, madurez, alcance) · `application` (casos de uso y puertos) · `infrastructure` (Kysely). Los controladores viven en `apps/api`.
- **No importa `modules/normas`:** las entradas de las librerías adoptadas llegan por `CatalogoLecturaPort`, cuyo adaptador se arma en `apps/api`. Los puertos de autorización y la unidad de trabajo se redeclaran aquí.
- **Referencias a entradas:** por `(libreria_codigo, id_estable)` con el `libreria_id` fijado al evaluar; así una versión nueva de la librería no deja huérfano nada.
- **Datos Confidenciales de la empresa:** todo con `empresa_id` y RLS; una prueba de aislamiento por tabla. Solo datos de prueba hasta validar el ADR 028.
- **Bitácora:** estados y banderas; el comentario y el texto del alcance NUNCA van allí.
- **Archivos de evidencias (M4, ADR 032):** el puerto es `AlmacenArchivosPort` (adaptador local en `infrastructure`; el de S3 lo sustituirá). La aplicación no importa módulos de Node, así que sus fakes y pruebas usan `prueba/archivos.ts` (archivos fabricados y un SHA-256 puro); `node:crypto` solo se usa en `infrastructure`.
- **Subida de archivos:** los casos de uso deciden permiso, datos y control **antes de leer un solo byte** del flujo; el tipo se decide por el contenido (`detectarTipoArchivo`), nunca por la extensión ni el `Content-Type`.
