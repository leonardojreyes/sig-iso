# ADR 032 — Archivos de evidencia: almacén detrás de un puerto, adaptador local y lista cerrada por firma

- **Estado:** Aprobado (2026-11-10), como parte del plan del MVP de certificación
- **Fecha:** 2026-11-11
- **Decide:** Ing. Leonardo J. Reyes B.
- **Completa** el [ADR 017](017-archivos-evidencias.md) (que fijó la API S3 y el hash SHA-256) y **no lo reemplaza**: S3 sigue siendo el destino de producción.

## Contexto

El MVP necesita que cada empresa suba evidencias (PDF, imágenes, documentos de oficina) y las descargue después. El ADR 017 eligió almacenamiento compatible con S3, pero el desarrollo corre en una Mac de 8 GB **sin Docker** (ADR 022) y el MVP funciona en una sola máquina: un servicio más de almacenamiento pesa sin aportar nada todavía.

Subir archivos es la superficie más delicada del producto: un archivo puede mentir sobre su tipo, traer contenido activo (HTML, SVG, macros), un nombre con rutas (`../`), un tamaño absurdo, o terminar en la carpeta de otra empresa.

## Decisión

1. **Puerto `AlmacenArchivosPort`** (guardar en temporal calculando SHA-256, leer un rango, confirmar, abrir para lectura y descartar) y un **adaptador de sistema de archivos local** para el MVP. El adaptador de S3 lo sustituirá sin cambiar el puerto ni los casos de uso.
2. **Dónde y cómo se guarda.** En una carpeta **fuera del repositorio**, indicada por la variable de entorno `EVIDENCIAS_DIR` (con plantilla en `.env.example` y la ruta ignorada por git). Cada archivo va en `<base>/<empresa_id>/<uuid>`: la empresa sale **solo del token** y el nombre en disco es un UUID generado por el servidor, **nunca** el nombre que mande el cliente. Antes de abrir o escribir se comprueba con `path.resolve` que el destino quede dentro de `<base>/<empresa_id>`.
3. **Orden de una subida.** Se recibe en flujo a un archivo temporal de la misma empresa, calculando el **SHA-256** y contando bytes en el adaptador (se corta al pasar **25 MB**); se decide el tipo por la **firma del contenido**; se abre **una sola transacción** con la fila y el hecho de bitácora y, como último paso antes de confirmarla, se **renombra** el temporal a su nombre definitivo. Si cualquier paso falla se descarta el temporal. *Refina el orden del plan:* con el renombrado dentro de la transacción, un fallo del renombrado deshace la fila; y si fallara la confirmación después de renombrar, queda a lo sumo un archivo **sin referencia**, que nunca se sirve (la conciliación posterior queda fuera del MVP).
   **Subida en dos fases (refinamiento del paso 4 de M4).** Recibir el archivo y decidir su tipo (fase 1, `iniciar`) está separado de la transacción (fase 2, `confirmar`). La API solo confirma cuando la petición HTTP termina **sin errores**: si multer rechaza un segundo archivo, o el cliente corta la conexión, la subida pendiente se **descarta** y no queda ninguna fila, hecho de bitácora de creación ni archivo definitivo. Sin esta separación, una petición inválida con dos archivos habría creado la evidencia del primero y aun así respondido 400.
4. **Lista cerrada de tipos:** PDF, PNG, JPEG, TXT (UTF-8 sin bytes nulos), DOCX, XLSX y PPTX. **No** se admiten SVG, HTML ni formatos con macros. La detección usa los **primeros bytes** (`%PDF-`, firma PNG, `FF D8 FF`) y, para los tres formatos de oficina, **el directorio central del ZIP leído sin descomprimir** (así no hay riesgo de bomba de compresión): se comprueba la parte propia de cada formato y se **rechaza** si aparece `vbaProject.bin`. La extensión y el `Content-Type` del cliente **se ignoran**.
5. **Un archivo por petición**, de hasta 25 MB (la API rechaza con 413, sin leer el cuerpo, una petición que ya declara más). Los rechazos que llegan al caso de uso (tipo, firma, y el tamaño cuando se descubre al recibir el archivo por trozos) quedan en la bitácora como `evidencia.subida_rechazada` con un motivo cerrado (`tipo_no_permitido`, `tamano_excedido` o `firma_invalida`); por HTTP son **413** (tamaño) y **415** (tipo o contenido dañado). **Excepción conocida (revisión H3):** el 413 que se corta ANTES del caso de uso, porque la petición ya declara más de lo permitido (`Content-Length`), no deja registro: ahí no se ha leído nada ni existe un archivo que identificar con una huella. Los campos de texto van **antes** del archivo, porque la API decide permiso, datos y control antes de leer un solo byte de él.
6. **Descarga.** Solo a través de la API, con la empresa del token, siempre como **adjunto** (`Content-Disposition: attachment`), con `Content-Type` fijo según el tipo que se detectó al subir, `X-Content-Type-Options: nosniff` y `Cache-Control: no-store`. Cada descarga se registra (`evidencia.descargada`) y, si no se puede registrar, **no se entrega** (falla cerrada). Nunca hay una ruta pública ni estática hacia los archivos.
7. **El nombre original** del archivo se conserva solo como etiqueta, normalizado a caracteres seguros y de hasta 120.
8. **No se borra nada.** Reemplazar o eliminar una evidencia cambia su estado; el archivo queda en disco (integridad y auditoría). La depuración por retención llegará cuando se cierre el ADR 028.
9. **Subida técnica** con `multer` 2.5.0 (licencia MIT), que ya llega como dependencia de `@nestjs/platform-express`: **no se agrega ninguna dependencia nueva**.

## Alternativas consideradas

| Alternativa | Por qué no |
| --- | --- |
| SeaweedFS (compatible con S3) desde ya | Un servicio más en una máquina de 8 GB sin Docker, sin beneficio aún; queda como el destino cuando haya servidor. |
| Guardar los archivos en PostgreSQL | Infla la base y las copias, y mezcla datos de negocio con binarios; el puerto permite pasar a S3 sin tocar nada más. |
| Confiar en la extensión o en el `Content-Type` del cliente | Ambos los controla quien sube el archivo. |
| Una librería de detección de tipos | Una dependencia más para siete tipos que se resuelven con firmas conocidas y un recorrido acotado del ZIP; menos superficie de cadena de suministro. |
| Renombrar después de confirmar la transacción (orden del plan) | Un fallo del renombrado dejaría una fila apuntando a un archivo que no existe, peor que un archivo sin fila. |

## Estándar y licencia

- Estándar: sistema de archivos POSIX en el MVP; API S3 como destino (ADR 017).
- Licencia: `multer` 2.5.0, MIT (ya presente como dependencia transitiva). Sin dependencias nuevas.

## Consecuencias

- La carpeta de evidencias **debe entrar en la copia de seguridad** junto con la base de datos; si se pierde, la huella guardada permite detectar que un archivo no es el original, pero no recuperarlo.
- Sin **cuota por empresa**, sin **antivirus** y sin **conciliación de archivos huérfanos** en el MVP (el plan los deja fuera). La huella se muestra y se guarda, pero **no se vuelve a verificar al descargar** todavía.
- Una subida lenta ocupa una conexión; el límite de 25 MB y el límite de frecuencia por persona de la API acotan el daño.
- Ampliar `STRIDE` (subida, descarga y exportación) es parte del cierre M6.

## Criterio de tecnología mayoritaria (P12)

Sistema de archivos y estándares abiertos; la única pieza de terceros (`multer`) es la de uso más extendido con Express y ya forma parte del árbol de Nest.
