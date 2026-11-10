# Clasificación de datos — sig-iso

- **Estado:** Borrador para revisión de `revisor-cumplimiento` (paso 0.9 mínimo, ADR 031).
- **Fecha:** 2026-11-09.
- **Qué es:** los niveles de clasificación, dónde vive cada tipo de dato hoy y qué se permite hacer con él. Parte de la tabla del spec del corte 0.6 (§5) y del ADR 028.
- **Qué no es:** asesoría legal. Las bases de tratamiento, los plazos de retención y los derechos de las personas son **hipótesis** que valida un asesor legal antes del primer cliente externo (ADR 028, provisional). Los plazos exactos están en el spec del corte 0.6 (§5) y no se repiten aquí para no divergir.

## Niveles

| Nivel                          | Qué es                                                                            | Ejemplos hoy                                                                                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Público de SynapTech**       | Contenido propio que el producto puede mostrar a cualquier empresa                | Librería de ejemplo (id de cláusula, título breve, guía propia)                                                                                                             |
| **Interno**                    | Datos de la operación sin datos personales; solo de la empresa o de la plataforma | Marca de la empresa, adopción de librerías, estado anterior y posterior en la bitácora, trazas técnicas, catálogo y políticas de IA                                         |
| **Confidencial de la empresa** | Información de negocio de una empresa cliente                                     | **Todavía no existe en el producto** (llegará con riesgos, hallazgos, diagnóstico, evidencias, documentos). Hoy no hay ninguna                                              |
| **Personal (LOPDP)**           | Identifica o permite identificar a una persona, también seudonimizada             | Nombre y correo, identificador opaco de la cuenta, identidad en el token, cookie de sesión, eventos del sistema de identidad, personal de SynapTech que opera la plataforma |
| **Secreto**                    | Permite acceder a algo                                                            | Contraseñas, claves de la base, secretos de Keycloak, clave del cliente OIDC                                                                                                |

## Dónde vive cada dato hoy

| Dato                                                                         | Nivel                                                     | Dónde                                                                                     | Quién lo ve                                                                                      |
| ---------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Nombre y correo de las personas                                              | Personal                                                  | Tabla `usuario` (por empresa, con RLS)                                                    | La empresa y quien administra la plataforma                                                      |
| Identificador opaco, empresa, fecha, acción, resultado y motivo | Personal (seudonimizado) | Bitácora inmutable | La aplicación solo lee lo de su empresa (RLS); el dueño de la base puede leerla completa (lectura transversal, ADR 028) |
| *Access token* de sesión (id, empresa, nombre, correo) | Personal | Solo en el servidor de la web; nunca llega al navegador | El servidor |
| Cookie de sesión | **Secreto** y personal: lleva el *refresh token*, cifrado con JWE (`A256GCM`) | Navegador (`HttpOnly`, `SameSite=Lax`; `Secure` si está configurado) | La persona (el contenido no es legible sin la clave del servidor) |
| Eventos de Keycloak (intentos fallidos, cambios de rol)                      | Personal                                                  | Keycloak; hacia la bitácora está diferido (11.2 y 11.3)                                   | Quien administra Keycloak                                                                        |
| Dirección de red de quien ingresa                                            | Personal                                                  | **No se registra** (decisión Q3 del ADR 028)                                              | —                                                                                                |
| Contraseñas                                                                  | Secreto                                                   | Solo en Keycloak; la aplicación nunca las pide ni las guarda                              | —                                                                                                |
| Claves y secretos de desarrollo | Secreto | `.env.local` y `.local/` (fuera de git; Claude Code tiene bloqueada la **lectura de los secretos y del realm** y la **edición de toda** `.local/`) | La persona dueña de la máquina |
| Marca de la empresa, adopción de librerías (qué librerías), trazas técnicas | Interno | Base de datos y registros técnicos | La empresa o la plataforma |
| Quién adoptó una librería (`adoptada_por`, identificador opaco de la cuenta) | Personal (seudonimizado) | Tabla de adopción por empresa (RLS) | La empresa; se trata como la bitácora (enlace a destruir al dar de baja, ADR 028 §2) |
| Librería de ejemplo                                                          | Público de SynapTech                                      | Archivo versionado y catálogo global                                                      | Cualquier empresa                                                                                |
| Texto enviado y recibido por el asistente de IA | Público (solo contenido de la librería en el 0.7) | **Previsto: no se guarda en ningún sitio**; solo se muestra en pantalla | La persona que lo pidió |
| Registro de una consulta al asistente (modelo, duración, tamaños, resultado) | Personal (seudonimizado) | Bitácora (**previsto**; los eventos están definidos en el PR #14, aún sin integrar) | Igual que el resto de la bitácora |

## Reglas de manejo por nivel

1. **Secreto:** nunca en el código, en un ADR, en una plantilla ni en un registro; `.env.example` va sin valores; se genera, no se escribe a mano.
2. **Personal:** solo donde está en la tabla anterior. **Nunca** en la bitácora (salvo el identificador opaco de la cuenta y códigos), en trazas, en mensajes de error ni en lo que se envía a un modelo de IA. Cualquier dato personal nuevo exige actualizar esta tabla y el ADR 028.
3. **Confidencial de la empresa:** cuando exista, solo se procesa con modelos **locales**, nunca con un modelo externo sin una política de la empresa que lo permita (política de IA) ni se copia entre empresas; siempre con `empresa_id` y RLS.
4. **Interno:** solo de la empresa a la que pertenece, salvo el catálogo y los datos de plataforma, que son globales y de solo lectura para la aplicación.
5. **Público de SynapTech:** libre dentro del producto. Nunca incluye texto de las normas ISO: solo identificador, título breve y guía propia (regla 3), verificado en el CI y por `revisor-cumplimiento`.

## Qué se puede enviar a un modelo de IA

| Nivel                      | Modelo local                              | Modelo externo                                                           |
| -------------------------- | ----------------------------------------- | ------------------------------------------------------------------------ |
| Público de SynapTech       | Sí                                        | Solo si la política de la empresa lo permite (deshabilitado por omisión) |
| Interno                    | Sí, con aprobación del caso de uso        | No                                                                       |
| Confidencial de la empresa | Sí, con evaluación propia del caso de uso | **No** (si algún día se quisiera, exige cambiar esta política y la de IA, con revisión) |
| Personal                   | No                                        | No                                                                       |
| Secreto                    | No                                        | No                                                                       |

En el 0.7 solo se envía contenido de la librería de ejemplo (nivel público). Ver `docs/security/politica-ia.md`.

## Pendiente (antes del primer cliente externo)

Diferido por el ADR 031 hasta antes del primer cliente externo: validar con el asesor legal las bases de tratamiento, la retención y los derechos de las personas y definir el rol de SynapTech (responsable o encargada del tratamiento); el registro de actividades de tratamiento (LOPDP); la política de derechos de autor de las normas; el mapeo a los controles del Anexo A de 27001 y 42001; y la revisión de due diligence.
