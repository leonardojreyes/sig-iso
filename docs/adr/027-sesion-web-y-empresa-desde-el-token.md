# ADR 027 — Sesión web (BFF) con OIDC y empresa solo desde el token

- **Estado:** Aprobado (2026-11-07), con las hipótesis de 30 min de inactividad, 8 h de sesión máxima, 5 min de access token y `SameSite=Lax`
- **Fecha:** 2026-11-06
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

El ADR 007 fijó Keycloak (OIDC) y dijo que «la empresa se resuelve desde el token, subdominio o encabezado, en un solo lugar». Tres vías, tres superficies de ataque: el subdominio y el encabezado los controla quien hace la petición.

El corte vertical 0.6 exige (spec H1.6, H2.1–H2.6) que la empresa de una persona la determine **su cuenta** y que nada que ella envíe pueda cambiarla. El contrato OpenAPI (tarea 5.1) y las pruebas ya se apoyan en esto: ninguna operación recibe la empresa como parámetro, y los encabezados `X-Empresa` y `?empresa=` se ignoran.

Faltan también las reglas de la sesión del navegador: dónde viven los tokens, qué cookie se emite, cómo expira la sesión y cuándo se considera iniciada (el inicio debe quedar en la bitácora, regla 4).

## Decisión

### 1. La empresa sale solo del token verificado

- La API toma la empresa del claim `empresa_id` de un token de acceso **verificado**. Nunca de la URL, el subdominio, un encabezado, el cuerpo ni una consulta.
- **Reglas de verificación:** lista blanca de algoritmos (`RS256` y `ES256`; se rechazan `none` y `HS*`); emisor fijo tomado de la configuración (no del token); audiencia propia de la API (mapper de audiencia en Keycloak: el `aud=account` por defecto no sirve); `typ` y `azp` comprobados (un `id_token` no vale como access token); expiración con tolerancia de reloj de 30 s. Las claves públicas (JWKS) se guardan en caché y, ante un `kid` desconocido, se vuelve a pedir el JWKS con límite de frecuencia.
- **`empresa_id` no editable:** en Keycloak es un atributo con permisos de vista y edición solo para `admin`, con atributos no gestionados y autorregistro desactivados. En proveedores de identidad federados (ADR 007) solo se admite un mapper de atributo fijo por proveedor, nunca uno que copie datos del proveedor externo. La API valida además que sea un UUID y que la empresa exista y esté activa.
- El identificador de la persona es el claim `sub` (opaco, es el que va a la bitácora).
- Token ausente, inválido, vencido o sin `empresa_id` válido → **401**. El hecho `token.invalido` se agrega y limita en frecuencia (no se infla la bitácora inmutable con peticiones sin autenticar) y **nunca** guarda el token ni sus claims. Una empresa inexistente responde igual.
- La empresa verificada se fija una vez como contexto de la petición y llega a PostgreSQL con `conTenant` (ADR 024). Una operación sin empresa **falla**, no devuelve datos de todas. Los permisos dentro de la empresa (OpenFGA, ADR 008) se acotan por esa misma empresa del token.
- En la web, `/e/[empresa]` es solo decorativo: se compara con la empresa de la sesión y, si no coincide, responde 404 sin datos ni marca de la otra.
- El cambio de empresa de un consultor que atiende a varias **queda fuera de este ADR** y exigirá otro.

### 2. Sesión del navegador con patrón BFF (backend for frontend)

**Flujo OIDC**

- El servidor de Next.js hace el flujo de **código de autorización con PKCE `S256`**, con `state` y `nonce`, y valida `iss` en el callback (RFC 9700: login CSRF y confusión de emisor). El verificador PKCE, el `state`, el `nonce` y el destino de retorno viajan en una cookie sellada de un solo uso con 5 minutos de vida.
- En Keycloak, `redirect_uri` y `post_logout_redirect_uri` son exactos, sin comodines. El cliente es confidencial y su secreto vive en `.env.local`. Se activa la detección de fuerza bruta de Keycloak; el mensaje que no revela si el usuario existe (H1.2) es el de Keycloak.
- El destino de retorno se valida con `new URL(destino, origen)` comprobando que el origen sea el propio y que la ruta no empiece por `//` ni `/\`: se rechazan también las variantes codificadas.

**Cookie de sesión**

- Nombre con prefijo `__Host-`, `Path=/`, `httpOnly`, `Secure`, `SameSite=Lax`, **sin `Max-Age`** (cookie de sesión del navegador).
- Contenido sellado con JWE `dir` + `A256GCM` y `kid`: refresh token, `id_token`, un identificador de sesión (`sid`) y un `exp` propio. Hay una clave activa y una anterior, para rotarla sin cerrar sesiones.
- Debe caber con margen en los 4 KB (un refresh token de Keycloak ronda 1–2 KB y el JWE añade cerca de un 37 %): hay prueba de tamaño. Si no cabe, se reducen los claims del token y, en último caso, se pasa a un almacén de sesión (alternativa 2).
- El access token vive en la memoria del servidor, indexado por `sid`. Todo lo autenticado usa rutas dinámicas y `cache: 'no-store'` (la caché de datos de Next no puede servir a una empresa lo guardado para otra). Hay una prueba con dos personas de empresas distintas en la misma instancia.
- La cookie solo se fija desde Route Handlers o el middleware (los Server Components de Next no pueden fijar cookies).

**Renovación**

- Se activa la rotación del refresh token en Keycloak (`Revoke Refresh Token`) con reutilización permitida **0**: reusar uno ya usado revoca la sesión (detecta robo, RFC 9700 §4.14). La renovación se serializa por `sid` (una sola a la vez) y reemite la cookie.

**Inicio, cierre y CSRF**

- Cada ingreso crea una sesión nueva (evita fijación de sesión).
- Tras el callback, el servidor llama a `POST /sesion/inicio`. La API deriva el hecho **del token verificado**, nunca de datos del cliente, y registra `login.ok`; es idempotente por `sid` y con límite de frecuencia. **Solo si se registró** se emite la cookie: sin rastro no hay sesión.
- Toda petición que no sea de lectura verifica `Origin` (ausente o `null` se rechaza) y ningún cambio de estado se hace por GET.
- Cierre: `POST /sesion/cierre` registra `logout`, **revoca el refresh token** (RFC 7009), cierra la sesión SSO con `id_token_hint` (por eso se sella el `id_token`) y borra la cookie. Hay una prueba de que reproducir la cookie robada después del cierre da 401. Las páginas internas llevan `Cache-Control: no-store` para que «atrás» no muestre datos de una sesión cerrada (H1.4).
- Se envían las cabeceras `Content-Security-Policy` y `Referrer-Policy` (tarea 6.2 de cabeceras de seguridad).

### 3. Expiración

- Inactividad máxima de **30 minutos** (pregunta Q4 del spec, confirmada), impuesta por Keycloak (SSO Session Idle), no por la web.
- Límite absoluto de sesión (`SSO Session Max`) de **8 horas** (confirmado) y access token de **5 minutos** como máximo.
- Si se desactiva o se mueve de empresa a una cuenta, el refresh debe fallar; el access token vigente sigue valiendo hasta que expire (como máximo 5 minutos): queda documentado como límite aceptado.
- Cuando el refresh falla por sesión inactiva o vencida, la persona vuelve a ingresar y se registra `sesion.expirada`.

### 4. Lo que este ADR no decide

- El sondeo de eventos de Keycloak (intentos fallidos) y la instalación de Keycloak y OpenFGA nativos: ADR 025.
- La retención de la bitácora y los datos personales: ADR 028.

## Alternativas consideradas

| Alternativa                                                           | Por qué no                                                                                                                                                                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tokens en el navegador (SPA con `localStorage` o memoria del cliente) | Un fallo XSS los exfiltra; el BFF los mantiene fuera del alcance del JavaScript.                                                                                                                             |
| Sesión en el servidor con almacén propio (Valkey o PostgreSQL)        | Más piezas en una Mac de 8 GB sin Docker; la cookie sellada y el refresh token bastan para este corte. Se reconsidera si hace falta revocar sesiones una a una desde el servidor.                            |
| Empresa por subdominio o encabezado (opciones del ADR 007)            | Las controla quien llama: abren la puerta a pedir datos de otra empresa. Se descartan para la API; el subdominio podría usarse más adelante solo como ayuda de presentación, siempre comparado con el token. |
| Cookie `SameSite=Strict`                                              | Rompe el regreso desde Keycloak (navegación entre sitios). `Lax` más la verificación de `Origin` en los POST cubre el riesgo.                                                                                |
| Bibliotecas de sesión de terceros                                     | Para sellar la cookie basta `jose` (JWE), que ya usa la API para verificar tokens: una dependencia menos.                                                                                                    |

## Estándar y licencia

- Estándar: OpenID Connect Core 1.0, OAuth 2.0 con PKCE (RFC 7636), mejores prácticas de seguridad de OAuth 2.0 (RFC 9700), JWT (RFC 7519) y JWE (RFC 7516); gestión de sesiones según OWASP ASVS 4 (capítulo V3).
- Licencias: `jose` MIT; Next.js MIT; Keycloak Apache 2.0 (ADR 007). Ninguna excepción.

## Consecuencias

- La garantía de aislamiento descansa en un solo punto de entrada de la empresa (el token verificado) y en la RLS; ninguna pantalla ni ruta puede elegirla.
- El servidor web guarda el access token en memoria: si se reinicia, la persona sigue con sesión porque se recupera con el refresh token de la cookie.
- Riesgo abierto: la serialización de la renovación por `sid` funciona dentro de una instancia; con varias instancias del servidor web, dos renovaciones simultáneas podrían invalidar la sesión. Se acota con una prueba y, si no basta, se pasa al almacén de sesión (alternativa 2).
- La clave que sella la cookie es un secreto: se genera en local, queda en `.env.local` (fuera de git) y se rota sin cambiar el código (regla 9).
- Valores confirmados por el responsable el 2026-11-07: 30 minutos de inactividad (Q4), 8 horas de sesión máxima, 5 minutos de access token y `SameSite=Lax`.
- Revisión de `revisor-seguridad` (2026-11-07): sin bloqueantes; sus 9 hallazgos importantes y 5 menores están incorporados arriba.
- Las tareas 6.1, 6.2 (verificador y guardia) y la fase 10 (web) se construyen sobre este ADR.

## Criterio de tecnología mayoritaria (P12)

OIDC con código y PKCE es el estándar vigente para aplicaciones web; Keycloak y Next.js ya están decididos. Sin excepciones.
