# ADR 025 — Keycloak y OpenFGA nativos en el entorno local, con descargas verificadas

- **Estado:** Aprobado (2026-11-07): versiones fijadas, JRE Temurin descargado por el script y excepciones declaradas
- **Fecha:** 2026-11-07
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

El ADR 007 fijó Keycloak y el ADR 008 fijó OpenFGA. El ADR 022 decidió **no usar Docker** en el equipo de desarrollo (Mac M1 de 8 GB), así que ambos deben correr de forma nativa. Keycloak no tiene fórmula de Homebrew (OpenFGA sí), y el plan preveía instalar «un JDK por Homebrew y el zip oficial» de Keycloak.

Antes de descargar nada se verificaron versiones, licencias y **tamaños reales** (7 de noviembre de 2026):

| Pieza                                   | Versión                          | Licencia                        | Descarga                                      | En disco (descomprimido)                               |
| --------------------------------------- | -------------------------------- | ------------------------------- | --------------------------------------------- | ------------------------------------------------------ |
| Keycloak (zip oficial)                  | 26.8.2 (publicada el 2026-11-05) | Apache-2.0                      | 165,7 MB                                      | 183 MB (517 archivos; medido en el directorio del zip) |
| JRE Eclipse Temurin 21 (aarch64, macOS) | 21.0.13+9                        | GPL-2.0 con excepción Classpath | 45,7 MB                                       | ~110–140 MB (estimado)                                 |
| OpenJDK 21 de Homebrew                  | 21.0.13                          | GPL-2.0 con excepción Classpath | **220,7 MB** (JDK 191,4 MB + 24 dependencias) | ~400 MB (estimado)                                     |
| OpenFGA (Homebrew, sin dependencias)    | 1.22.1                           | Apache-2.0                      | 18,7 MB                                       | ~50 MB (estimado)                                      |

Dos hechos cambian el plan original:

1. La fórmula `openjdk@21` de Homebrew arrastra **24 dependencias gráficas** (glib, cairo, harfbuzz, librerías de X11…) que un Keycloak sin pantalla no usa, y se instalan para todo el sistema.
2. Homebrew solo existe en macOS. La regla del proyecto es que los scripts funcionen **igual en macOS y Windows**.

Keycloak 26.8.2 es muy reciente, pero corrige varias vulnerabilidades que la 26.8.1 aún tiene (según sus notas: toma de una cuenta en el inicio de sesión por organizaciones, reproducida en 26.8.1; agotamiento de disco sin autenticar en 26.8.0 y anteriores; XSS en la página de ingreso). Para un servicio de identidad pesa más eso que su antigüedad.

## Decisión

### 1. Versiones fijadas

- **Keycloak 26.8.2**, zip oficial de GitHub. Se actualiza solo con un cambio explícito de este ADR o de la tabla de versiones del script, nunca con «la última».
- **JRE Eclipse Temurin 21.0.13+9** (21 es LTS y es el Java de la imagen oficial de contenedor de Keycloak). Basta un JRE sin cabeceras gráficas: la imagen oficial de Keycloak también corre sobre un runtime «headless».
- **OpenFGA 1.22.1** por Homebrew, que es una sola fórmula de 18,7 MB sin dependencias (su instalación es la tarea 9.1, con su propio «ok»).

### 2. El JRE se descarga con el script, no con Homebrew (a confirmar por ti)

`scripts/keycloak-dev.mjs` descarga el JRE de Temurin desde la API de Adoptium según el sistema operativo y la arquitectura, y lo instala en una carpeta ignorada por git (`.local/`). Así:

- baja **45,7 MB en lugar de 220,7 MB**, sin tocar el Homebrew del equipo ni sus 24 paquetes;
- el mismo script sirve en macOS y en Windows;
- el JRE queda aislado en la carpeta del proyecto y se borra con ella.

La alternativa (Homebrew `openjdk@21`) sigue siendo válida si prefieres no gestionar ese JRE; ver «Alternativas».

### 3. Descargas verificadas e instalación acotada

- La huella SHA-256 de cada archivo descargado (Keycloak y JRE) **queda fijada en el repositorio**. Si no coincide, el script aborta y no extrae nada.
- La huella se fija solo después de cruzar al menos dos fuentes independientes: la que publica GitHub para el zip (`321ffee6…06b3`), la huella SHA-1 que Keycloak publica junto al zip (`987faddc…bc`), y la que publica Adoptium para el JRE (`225bab0a…c09a`). La firma GPG (`.asc`) de Keycloak existe; hoy el equipo no tiene `gpg`, así que su verificación queda como mejora opcional.
- Se instala en `.local/` (ignorada por git). El script nunca usa `sudo`, nunca ejecuta lo descargado antes de verificarlo y valida las rutas del archivo al extraer (sin salir de la carpeta destino).
- Antes de cada descarga el script informa el tamaño y pide confirmación.

### 4. Keycloak solo local y con secretos generados

- Escucha **solo en 127.0.0.1**. El heap de la JVM se acota (512 MB como punto de partida; `pnpm ram:report` mide el consumo real frente al presupuesto de ~4 GB).
- El realm se importa desde una **plantilla con marcadores**; el realm resuelto, con las contraseñas generadas, queda en una carpeta ignorada. La plantilla no contiene secretos (lo comprueba una prueba y `gitleaks`).
- `empresa_id` es un atributo de la cuenta **no editable por la persona**, entregado por un mapper de protocolo (ADR 027). La API exige una audiencia propia, por lo que el realm incluye el mapper de audiencia.
- Los eventos de usuario y de administración se habilitan; el mensaje de credenciales inválidas es el mismo exista o no el usuario (H1.2); el idioma es español.
- Almacén: el de archivo de Keycloak en desarrollo. En CI o despliegue, PostgreSQL.

### 5. Lo que consume el worker de eventos (excepción temporal al ADR 009)

El ADR 009 prevé una cola Valkey. Mientras no exista, el worker **sondea** los eventos de Keycloak con una cuenta de servicio de solo lectura de eventos. Copia solo tipo, fecha, código de error e identificador de usuario (si existe); **nunca** la IP, el nombre de usuario escrito ni el detalle. Es idempotente por clave, con punto de control y alerta si hay un hueco.

### 6. Observabilidad y flags mínimos (desvíos del ADR 013 y del plan base)

- **OpenTelemetry mínimo**: un span por solicitud con método, patrón de ruta, estado y `empresa_id`; exportador a consola; sin recolector ni auto-instrumentación (tarea 12.1).
- **OpenFeature con proveedor en memoria**, sin flagd (tarea 12.2). Es un desvío consciente del ADR 013 mientras no haya dónde alojar flagd.

> **Actualización (ADR 029, 2026-11-07):** OpenFGA quedó instalado y verificado (tarea 9.1) pero **no se integra** en el corte 0.6; la autorización usa la matriz en código con el rol guardado en la base. Lo demás de este ADR sigue vigente.

## Alternativas consideradas

| Alternativa                               | Por qué no (o por qué queda abierta)                                                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| JDK de Homebrew (`openjdk@21`)            | 220,7 MB y 24 paquetes del sistema, solo macOS. Válida si prefieres Homebrew; costaría 175 MB más de descarga y un script distinto en Windows. |
| Eclipse Temurin completo (JDK, no JRE)    | 190,5 MB. Keycloak no necesita el compilador.                                                                                                  |
| Java 25                                   | La documentación de Keycloak la nombra como la más reciente, pero la imagen oficial usa 21 y es lo más probado.                                |
| Keycloak 26.8.1                           | Tres semanas de antigüedad, pero sin las correcciones de seguridad de la 26.8.2.                                                               |
| Docker                                    | Descartado por el ADR 022 para el equipo local.                                                                                                |
| Keycloak con la última versión «flotante» | Una cadena de suministro sin versión fijada ni huella. Se fija.                                                                                |

## Estándar y licencia

- Estándar: OpenID Connect y OAuth 2.0 (Keycloak); Zanzibar (OpenFGA).
- Licencias: Keycloak Apache-2.0; OpenFGA Apache-2.0.
- **Excepción a la regla 8 (solo MIT, Apache, BSD o MPL):** el JRE de OpenJDK es GPL-2.0 con excepción Classpath. Se admite como **herramienta de desarrollo local**: no se distribuye con el producto, no se enlaza con nuestro código y no se incluye en imágenes ni paquetes. Si algún día el producto se entregara con un runtime de Java, habría que revisar esta excepción.
- No se agregan dependencias de Node; `pnpm licenses:check` sigue en verde (736 paquetes revisados).

## Consecuencias

- Hay que descargar **211,4 MB** (Keycloak más JRE) para la tarea 8.2, y 18,7 MB más para OpenFGA en la 9.1. En disco: unos 300 MB y unos 50 MB.
- Keycloak es el componente más pesado en RAM de la pila. La tarea 12.3 registra la medición real con `pnpm ram:report`; si no cabe en el presupuesto, se acota más el heap o se apaga lo que no se use.
- La versión de Keycloak es un dato del repositorio: subirla es un cambio revisable (nueva huella, nuevas notas de versión).
- Dos desvíos quedan declarados y reversibles: sondeo del worker (hasta que haya cola) y flags en memoria (hasta que haya flagd).
- Hasta que se instale Keycloak (fase 8), la API en una instalación real no puede validar tokens y responde 500: es el comportamiento cerrado por diseño (ADR 027).

## Criterio de tecnología mayoritaria (P12)

Keycloak, OpenFGA, OpenTelemetry y OpenFeature son las opciones de soporte largo ya decididas en los ADR 007, 008 y 013. El único desvío de método es descargar el JRE con el propio script en lugar de usar el gestor de paquetes del sistema, y se justifica por el tamaño y por la paridad entre macOS y Windows.
