# ADR 035 — Una persona en varias empresas: empresa activa por sesión, guardada en la base

- **Estado:** Aprobado (2026-11-15), como parte del plan del MVP de certificación (M6b). Acota el ADR 027, sección 1 («El cambio de empresa de un consultor queda fuera de este ADR y exigirá otro»).
- **Fecha:** 2026-11-15
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

La Fase 0 prometió que un **consultor** atienda a varias empresas con **un solo usuario** y **cambio explícito de empresa**, sin acceso cruzado por defecto. Hoy no cabe: el token de Keycloak trae un solo `empresa_id` y `usuario.id` es clave primaria global, así que una cuenta pertenece a una sola empresa. El ADR 027 fija que la empresa sale solo del token verificado y que ninguna operación recibe una empresa del cliente.

Se evaluaron tres caminos: **una cuenta de Keycloak por empresa** (no cumple «un solo usuario»), **token por empresa con token exchange** (exige configurar y probar Keycloak por empresa; el más difícil de operar sin Docker) y **empresa activa por sesión guardada en la base** (elegido).

## Decisión

1. **Pertenencia.** Una persona (el `sub` de su cuenta) puede tener **una fila `usuario` por empresa**, cada una con su propio rol. La clave primaria de `usuario` pasa a `(empresa_id, id)`; las claves foráneas que ya eran compuestas no cambian, y la de `empresa_libreria.adoptada_por` pasa a compuesta. El rol de una persona **no se hereda** entre empresas: sin fila (o con rol nulo) en una empresa, no hay acceso a ella.
2. **El token sigue mandando.** El claim `empresa_id` del token verificado es la empresa **inicial** de la sesión. Nada en el token se acepta sin verificar.
3. **Una sola operación nombra una empresa:** `POST /sesion/empresa` con la empresa pedida. La API verifica la identidad del token y comprueba en la base que **esa persona pertenece a esa empresa con un rol**; si no, responde **404** (indistinguible de una empresa que no existe). Si pertenece, guarda la **empresa activa de ESA sesión** (`sid` del token) y registra el hecho `empresa.cambiada` en la empresa destino **antes** de guardar (falla cerrada: sin rastro no hay cambio). Ninguna otra operación acepta una empresa del cliente (la regla del ADR 027 se mantiene).
4. **Resolución en la guardia.** Tras verificar el token, la guardia busca la empresa activa del `sid`; si existe y la pertenencia **sigue vigente**, esa es la empresa de la petición (para la base, el límite de frecuencia y los permisos); si no, la del token. Si la pertenencia desaparece (se quita el rol o la fila), la petición vuelve a la empresa del token: no queda un acceso colgado.
5. **Dónde vive.** Tabla `empresa_activa (sid, usuario_id, empresa_id, expira_en)` sin RLS por empresa (la consulta ocurre **antes** de conocer la empresa), accesible solo al rol de plataforma con permisos mínimos (la aplicación del negocio no la toca). El `sid` es el de Keycloak (opaco) y vence con la sesión máxima (8 h); lo vencido se ignora y se limpia al escribir. Para listar las empresas de una persona, el rol de plataforma lee solo `usuario(id, empresa_id, rol)` y `empresa(id, slug, nombre)`.
6. **Cierre de sesión.** Al cerrar la sesión se borra la empresa activa de ese `sid`; una cuenta que vuelve a entrar empieza en la empresa de su token.
7. **Web.** La barra muestra la empresa activa y, si la persona tiene más de una, un selector. Cambiar es un POST a la web, que llama a la API y **actualiza la empresa de la sesión** (`/e/<slug>` de la nueva empresa); la web no decide pertenencia.
8. **Consecuencias para los datos.** Todo lo demás (RLS, `conTenant`, claves foráneas compuestas, bitácora) funciona sin cambios: la petición ya llega con **una** empresa. El identificador opaco de la persona es el mismo en todas sus empresas (necesario para que sea una sola cuenta); la correlación entre empresas solo la puede hacer la plataforma.

## Consecuencias

- Un consultor entra una vez, ve sus empresas y cambia sin cerrar sesión; sus datos y roles quedan separados por empresa.
- Cada petición agrega una consulta (empresa activa y pertenencia) en la guardia. Aceptable para el MVP; si pesa, se guarda en la caché de la instancia con vencimiento corto.
- La API de negocio sigue sin aceptar empresa del cliente; la superficie nueva es una sola operación, con prueba de que una persona no puede activar una empresa ajena.
- Mientras no haya pantalla de administración de usuarios, las filas `usuario` y los roles de un consultor se crean con el mantenimiento (siembra), como hoy.
