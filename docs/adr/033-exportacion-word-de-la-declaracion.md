# ADR 033 — Exportación a Word de la Declaración de Aplicabilidad: `docx` detrás de un puerto

- **Estado:** Aprobado (2026-11-12), como parte del plan del MVP de certificación (M5)
- **Fecha:** 2026-11-12
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

La Declaración de Aplicabilidad (DdA) de ISO/IEC 27001:2022 es un documento que el auditor revisa: por cada control del Anexo A dice si aplica, por qué y cómo se implementa. El MVP la **deriva** del diagnóstico y de los controles de la empresa, la deja **aprobar con una versión congelada** y la **exporta a Word** (.docx), que es el formato que la empresa edita y entrega.

Hace falta una librería que escriba .docx desde Node, sin Docker, sin LibreOffice y con licencia permitida (regla 8).

## Decisión

1. **Librería `docx` 9.15.3 (MIT)**, que **genera** el documento por código (sin plantillas .docx que mantener). Dependencias directas: `fflate`, `nanoid` y `@types/node`, todas permisivas. Ocupa unos **20 MB** en `node_modules` (informado antes de instalar, como pide el entorno); no descarga modelos ni binarios.
2. **Detrás de un puerto**, `GeneradorDocumentoPort` (en `application`), con el adaptador en `infrastructure`. La aplicación y el dominio no importan `docx`; el formato Word podrá cambiarse (o sumarse PDF) sin tocar los casos de uso. Las pruebas de aplicación usan un generador falso.
3. **El documento se arma solo con datos propios**: identificador del control, título breve, estado de aplicabilidad, justificación y estado de implementación escritos por la empresa, y las referencias a las cláusulas **por su identificador**. **Nunca** texto de la norma (regla 3).
4. **Marca de borrador.** Toda exportación lleva el rótulo «Documento preliminar generado por el sistema: lo revisa y aprueba la empresa» hasta que la versión esté aprobada; el de la IA no aplica porque no interviene.
5. **Versión congelada.** Al aprobar, se guarda una copia **inmutable** de las filas de la DdA (tabla propia, con `empresa_id`, RLS y sin permiso de modificar ni borrar) y la exportación de una versión aprobada sale **siempre de esa copia**, no de los datos vivos.
6. **Descarga** con las mismas reglas del ADR 032: solo por la API, con la empresa del token, como adjunto, tipo fijo, `nosniff`, `no-store`, y registrada en la bitácora **antes** de entregar (falla cerrada). El nombre del archivo lo fija el servidor.
7. **Contenido controlado.** Lo que la empresa escribe (justificaciones) puede traer caracteres de control o fórmulas: se normaliza (sin controles, longitud acotada) y se escribe siempre como **texto**, nunca como campo, hipervínculo ni macro. El .docx generado no lleva macros ni objetos incrustados.

## Alternativas consideradas

| Alternativa                                          | Por qué no                                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `docxtemplater` (MIT) + `pizzip` (MIT **o GPL-3.0**) | obliga a mantener una plantilla .docx y `pizzip` tiene doble licencia que `check-licenses` marcaría |
| `officegen`                                          | sin mantenimiento activo; arrastra `lodash`, `archiver` y otras dependencias antiguas               |
| Generar HTML y convertir con LibreOffice             | requiere instalar y ejecutar un programa pesado (8 GB de RAM, sin Docker)                           |
| Entregar solo PDF o CSV                              | la empresa necesita editar y firmar el documento                                                    |

## Consecuencias

- Una dependencia nueva de ~20 MB; `pnpm check:licenses` debe seguir en verde.
- El formato exacto del documento (tablas, orden, portada) queda como diseño de M5 en `plan.md`.
- Si la empresa necesita PDF más adelante, se agrega otro adaptador del mismo puerto.
