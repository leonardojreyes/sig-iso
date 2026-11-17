# ADR 036 — Alta, baja y cambio de rol de personas: solicitud de acceso con código corto

- **Estado:** Aprobado (2026-11-16) por el responsable, como hito M7 del MVP de certificación. Completa el ADR 029 (que dejaba el rol fijado por la siembra) y el ADR 035 (que dejaba las filas `usuario` al mantenimiento). **No contradice** ninguno de los dos.
- **Fecha:** 2026-11-16
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

Hoy las personas y sus roles se crean con la siembra y con `keycloak:cuentas`; no hay pantalla. Las acciones `usuario.alta`, `usuario.baja` y `rol.cambiado` existen en el catálogo de la bitácora, pero nada las emite. El responsable pidió una pantalla mínima para que el administrador SIG dé de alta, cambie el rol y dé de baja.

Restricciones que mandan:

- El **token trae solo** `sub`, `empresa_id` y `sid`. La API no conoce nombres ni correos y no debe aprenderlos del token (ADR 027 y 028).
- `usuario.id` debe ser igual al `sub` de Keycloak. Crear una cuenta con la API normal de Keycloak ignora el `id` (por eso `keycloak:cuentas` usa la importación parcial).
- La API no debe recibir **credenciales de administración de Keycloak**: es el secreto más sensible del sistema.
- Nombre y correo son datos personales; el ADR 028 sigue provisional y **bloquea el uso con personas reales** hasta que lo valide el asesor legal.

## Decisión

1. **La cuenta se sigue creando en Keycloak, por fuera de la aplicación.** «Alta» en la aplicación significa **dar acceso a una cuenta que ya existe**, no crearla. La aplicación no guarda ninguna credencial de administración de Keycloak.
2. **Solicitud de acceso.** Una persona autenticada cuya empresa del token no la tiene con un rol activo puede pedir acceso con `POST /acceso/solicitud` (sin cuerpo; la persona y la empresa salen del token). La API crea **una solicitud vigente por persona y empresa** (idempotente: pedir de nuevo devuelve la misma) con un **código corto** de 8 caracteres en formato `XXXX-XXXX`, de un alfabeto sin caracteres ambiguos (sin 0, O, 1, I, L), generado con aleatoriedad criptográfica. Vence a los **7 días**. Hay un tope de **50 solicitudes vigentes por empresa** y se aplica el límite de frecuencia que ya protege la API. El código **no es una credencial**: solo permite al administrador reconocer la solicitud; aprobar exige siempre un administrador SIG.
3. **Sin nombre ni correo del token.** La persona ve su código y se lo entrega al administrador por su canal habitual. Al **aprobar**, el administrador escribe el nombre y el correo y elige el rol; son datos que escribe una persona de la empresa, igual que hoy en la siembra. Nunca se leen del token ni van a la bitácora.
4. **Operaciones del administrador** (permisos nuevos `personas.ver` y `personas.gestionar`, **solo `administrador_sig`**): listar personas y solicitudes vigentes; **aprobar** una solicitud (crea o reactiva la fila `usuario` con `id` = persona de la solicitud, con rol, nombre y correo); **descartar** una solicitud; **cambiar el rol**; y **dar de baja**.
5. **Baja.** La fila `usuario` **no se borra** (las claves foráneas de autoría la necesitan y la bitácora referencia a la persona): se deja `rol` en nulo y se anota `baja_en`. Sin rol, la autorización ya falla cerrada (ADR 029): la persona deja de poder todo desde la siguiente petición, sin esperar a que venza el token. Volver a darle acceso es aprobar una solicitud nueva.
6. **Salvaguardas.** Una empresa **no puede quedarse sin administrador SIG**: no se puede quitar el rol ni dar de baja al **último** administrador, ni a sí mismo si es el único. Cambiar el rol o dar de baja usa la **versión** de la fila (concurrencia optimista, como las demás pantallas).
7. **Bitácora** (en la misma transacción que el cambio): `acceso.solicitado` (solo la primera vez), `usuario.alta` (aprobación; el rol dado), `rol.cambiado` (rol anterior y nuevo), `usuario.baja` (el rol que tenía) y `acceso.rechazado` (descarte). Solo identificadores opacos y roles: **nunca** nombre, correo ni el código; la solicitud se nombra por su identificador (`solicitud:<uuid>`).
8. **Datos y RLS.** Tabla nueva `solicitud_acceso` con `empresa_id`, RLS forzada y prueba de aislamiento. La solicitud se crea con un camino acotado (la persona aún no tiene rol, así que no pasa por la autorización por rol): solo inserta su propia solicitud en su propia empresa. `usuario` gana `baja_en` y la aplicación puede insertar y actualizar solo las columnas necesarias, por empresa.
9. **Web.** `POST /sesion/inicio` **sigue respondiendo 401 a una cuenta sin rol** (decisión de H6.1, con sus pruebas): **una cuenta sin rol no recibe sesión**. Para que aun así vea su código, el *callback* de la web, al recibir ese 401, pide la solicitud con el token que acaba de obtener (`POST /acceso/solicitud`) y la muestra en `/acceso-pendiente` desde una **cookie sellada de corta vida** (cifrada, HttpOnly, SameSite=Lax, a lo sumo 10 minutos y nunca más que la propia solicitud; trae solo el código y el plazo). Esa pantalla no tiene empresa en la dirección ni sesión; si la cookie falta o venció, invita a ingresar de nuevo (se vuelve a ver el mismo código mientras la solicitud siga vigente). Si la solicitud no se puede pedir, el ingreso responde «no disponible», como antes. El administrador ve `/e/<empresa>/personas` (personas con su rol y estado, y solicitudes vigentes con su código y fecha). Las escrituras son formularios `POST` hacia rutas propias de la web, con la guardia común de formularios (método, `Origin`, empresa verificada) y avisos de una lista cerrada.

## Alternativas

- **Crear la cuenta de Keycloak desde la aplicación.** Es la experiencia completa, pero la API necesitaría una credencial de administración de Keycloak y envío de invitaciones por correo. Se descarta: concentra el mayor secreto en el servicio expuesto y agranda la superficie de ataque. Se retoma si hay despliegue de servidor.
- **Pedir nombre y correo a la persona.** Más cómodo, pero quien se identifica lo escribe a mano (puede hacerse pasar por otra) y se guardarían datos personales de alguien aún no aprobado.
- **Consultar a Keycloak por nombre y correo del `sub`.** Requiere una credencial de lectura de Keycloak en la API: el mismo problema.

## Estándar y licencia

Sin dependencias nuevas (el código se genera con `node:crypto`). Se mantiene OWASP ASVS nivel 2 (control de acceso cerrado por omisión, límite de frecuencia, sin enumeración).

## Consecuencias

- El administrador SIG gestiona accesos sin tocar Keycloak ni la base, pero **crear la cuenta** sigue siendo un paso aparte.
- Un cambio de rol o una baja surte efecto de inmediato, porque el rol se lee de la base en cada petición (ADR 029).
- Se hace visible lo que el ADR 028 dejó pendiente: la aplicación guardará **nombre y correo de personas**. Siguen siendo **solo datos de prueba** hasta que el asesor legal valide el ADR 028; se agrega a sus insumos el tratamiento «solicitud de acceso con código».
- Una persona dada de baja puede volver a crear solicitudes; el tope por empresa y el límite de frecuencia acotan el abuso.
- La decisión de no dar sesión a una cuenta sin rol se **conserva**: quien está de baja no tiene sesión (solo ve su código), y el rol se sigue leyendo de la base en cada petición, así que una baja o un cambio rigen de inmediato también para una sesión ya abierta.
- Una cuenta sin rol que ingresa **crea una solicitud** (con tope y límite de frecuencia): es el único efecto que puede tener sin permiso, y no da acceso por sí solo.
- Para probarlo de extremo a extremo hay una cuenta de siembra que existe en Keycloak pero no como persona (`pendiente`, empresa A) y `pnpm web:verify-personas`.
- Los roles múltiples por persona y la relación persona–proceso (M3 de la Fase 1) quedan fuera: sigue habiendo **un rol por persona y empresa**.
- **Riesgo aceptado: la base ya no impide por sí sola asignar roles.** La migración 0005 había quitado a la aplicación esa posibilidad; la 0015 se la devuelve (por columnas). Lo contiene el permiso `personas.gestionar` (solo administrador SIG), que **se decide antes que cualquier otra cosa** (hay una prueba por caso de uso de que sin permiso no se toca la base), más la RLS por empresa. Un *trigger* no ayudaría: la misma aplicación podría fijar la variable que lo habilita. La solución de fondo son roles de base de datos separados por módulo (Fase 1). La migración 0016 acota la inserción de solicitudes a las **pendientes** (por columnas).
- **La baja conserva nombre y correo sin plazo y sin anonimizar**, lo que contradice el diseño previsto en el ADR 028 §2 (anonimizar y eliminar la cuenta de Keycloak). Es una decisión pendiente del asesor legal, anotada en sus insumos (ADR 028, punto 11), igual que la falta de rectificación (un error de tipeo se arregla con baja y una solicitud nueva, que sobrescribe nombre y correo) y la de un aviso de privacidad en la pantalla del código.
- `solicitud_acceso` conserva sin plazo el identificador opaco y el código de solicitudes no aprobadas; su retención también queda para el asesor.
- **Límites aceptados:** un descarte **no impide** que la misma cuenta vuelva a pedir acceso (no hay enfriamiento: lo acotan el tope de 50 y el límite de frecuencia, y un enfriamiento bloquearía a quien se descartó por error); el paso de una solicitud a «vencida» se **deriva** de su plazo y no deja un hecho propio en la bitácora (no hay actor ni decisión que auditar); el permiso se comprueba un instante antes de abrir la transacción (no hay escalada: el último administrador está protegido dentro de ella); y quien ingresa sin rol no puede cerrar su sesión de Keycloak desde la pantalla del código.
