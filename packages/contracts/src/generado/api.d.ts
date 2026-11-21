// ARCHIVO GENERADO desde openapi.yaml con `pnpm --filter @sig/contracts generar`. No editar a mano.

export interface paths {
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Comprueba que la API responde */
        get: operations["comprobarSalud"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Identidad de quien consulta
         * @description Devuelve la persona, sus roles y su empresa (nombre y slug), tomados del token verificado.
         */
        get: operations["obtenerIdentidad"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/sesion/empresas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Las empresas a las que pertenece quien consulta
         * @description Una persona puede pertenecer a varias empresas (un consultor), cada una con su propio rol (ADR 035). Solo se listan las suyas,
         *     con el nombre y el slug (el de la URL `/e/<slug>`), por nombre; `activa` marca la de esta sesión. Quien pertenece a una sola
         *     empresa recibe una lista de un elemento.
         */
        get: operations["listarMisEmpresas"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/sesion/empresa": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cambia la empresa activa de la sesión
         * @description ÚNICA operación que nombra una empresa (ADR 035). La API toma la persona y la sesión del token verificado y comprueba en la base
         *     que la persona **pertenece** a la empresa pedida con un rol; si no, responde 404 (igual que una empresa que no existe) y deja un
         *     `acceso.cruzado`. Si pertenece, registra `empresa.cambiada` en la empresa destino y recién entonces guarda la empresa activa de
         *     ESA sesión (vence con la sesión máxima, 8 h). Desde la siguiente petición, todo se evalúa con esa empresa y con el rol que la
         *     persona tiene allí. Ninguna otra operación acepta una empresa del cliente.
         *
         *     Orden de evaluación: 401, 400 (slug mal formado) y 404 (no pertenece).
         */
        post: operations["cambiarEmpresa"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/empresa/marca": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Marca de la empresa de quien consulta
         * @description Solo devuelve la marca de la empresa del token; la de otra empresa no viaja nunca. Si el color de la empresa no cumple el
         *     contraste mínimo se devuelve el color ajustado y `ajustadoPorContraste` en verdadero. El servidor nunca resuelve `logoUrl`:
         *     el navegador la carga con `referrerpolicy="no-referrer"` y una política de contenido restrictiva.
         */
        get: operations["obtenerMarcaEmpresa"];
        /**
         * Edita el color y el logo de la empresa de quien consulta
         * @description Solo la persona con rol de administrador SIG (`marca.editar`). La empresa y la persona salen del token; el cuerpo solo trae el
         *     color y el logo. El color elegido se guarda tal cual: si no cumple el contraste mínimo (AA), la marca que se APLICA se ajusta y
         *     la respuesta lo dice (`ajustadoPorContraste`). El logo es una dirección `https` sin credenciales, una ruta propia o nulo (vuelve
         *     el monograma); uno no permitido se RECHAZA con 400 (no se descarta en silencio). No cambia el nombre ni el slug. Si no cambia
         *     nada, responde la marca vigente y no registra nada; si cambia algo, la bitácora guarda solo QUÉ cambió (color, logo), nunca los
         *     valores. Orden de evaluación: 401, 403, 400.
         */
        put: operations["actualizarMarcaEmpresa"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/sesion/inicio": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Registra el inicio de sesión
         * @description El hecho se deriva del token verificado, nunca de datos enviados por el cliente, y es idempotente por sesión: repetirlo con
         *     la misma sesión responde 204 sin escribir otro registro. La sesión del navegador solo se emite cuando este registro se ha
         *     escrito.
         */
        post: operations["registrarInicioSesion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/sesion/cierre": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Registra el cierre de sesión
         * @description Idempotente por sesión, como el inicio. Un token ya revocado responde 401.
         */
        post: operations["registrarCierreSesion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/librerias": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Librerías del catálogo
         * @description Las librerías del catálogo GLOBAL (de solo lectura) y las PROPIAS de la empresa de quien consulta (ADR 034), con sus
         *     metadatos, e indica cuáles adoptó la empresa. Las entradas solo se ven si se adoptó. Una librería propia de otra empresa
         *     nunca aparece. Cada versión es una fila.
         */
        get: operations["listarLibrerias"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/librerias/carga": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Sube una librería de norma propia de la empresa (archivo YAML)
         * @description Solo la persona con rol de administrador SIG (`normas.cargar`). `multipart/form-data` con **un solo archivo** (campo `archivo`)
         *     YAML de hasta 1 MB, sin alias ni anclas, con el esquema v3 de las librerías (sin texto de la norma). El código debe empezar con
         *     `propia-` y la librería no puede ser de ejemplo. La librería queda **propia de la empresa del token** y nunca es visible para
         *     otra; cada versión es inmutable (la misma versión con otro contenido se rechaza).
         *
         *     Un archivo que no pasa la validación **no es un error HTTP**: responde 200 con `estado: rechazada`, el motivo y la lista de
         *     errores por ruta (nunca el contenido), y el rechazo queda en la bitácora. 201 si se cargó ahora; 200 si ya estaba cargada
         *     (mismo contenido) o si se rechazó. 413 si declara más de 1 MB (sin leerlo) y 400 si no llega el archivo.
         *     Orden de evaluación: 401, 403, 400, 413, y después la validación del contenido.
         */
        post: operations["cargarLibreria"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/librerias/{id}/adopcion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Adopta una librería para la empresa
         * @description Solo la persona con rol de administrador SIG. No hay cuerpo: la empresa y la persona salen del token. La autorización se
         *     decide en OpenFGA (relación `administrador_sig` sobre la empresa del token) y se evalúa ANTES de cualquier efecto; los
         *     rechazos por permiso también se registran en la bitácora.
         *
         *     Orden de evaluación: 401, 403 (solo por rol, sin mirar el identificador: un colaborador recibe siempre el mismo 403, exista
         *     o no la librería), 404 (la función está apagada para la empresa por el flag `adopcion-habilitada`: se presenta como una
         *     operación inexistente, sin importar el identificador), 400 (UUID mal formado) y 404 (no existe). Adoptar una librería ya
         *     adoptada no es un error: responde 200 sin cambios.
         */
        post: operations["adoptarLibreria"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/requisitos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Entradas de las librerías adoptadas
         * @description Solo incluye entradas de librerías que la empresa adoptó. Sin adopciones devuelve una lista vacía. Orden: por librería y,
         *     dentro de cada una, el orden de la librería (el cliente no puede reordenar). El catálogo es acotado por diseño: si
         *     algún día superara el tope de `maxItems`, se revisará este contrato (paginación) en lugar de truncar sin avisar.
         *     El servidor usa consultas parametrizadas; los filtros no admiten comodines.
         */
        get: operations["listarRequisitos"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/requisitos/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Una entrada de una librería adoptada
         * @description Orden de evaluación: 401, 400 (UUID mal formado) y 404 (única respuesta para «no existe», «es de otra empresa» y «su librería no está adoptada»).
         */
        get: operations["obtenerRequisito"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alcances": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Alcance de cada norma adoptada
         * @description Una fila por norma de las librerías adoptadas; el alcance no definido llega con `texto` nulo.
         */
        get: operations["listarAlcances"];
        /**
         * Define o cambia el texto del alcance de una norma
         * @description Cambiar el texto de un alcance aprobado lo devuelve a «sin aprobar». Orden de evaluación: 401, 403, 400, 404 (norma no adoptada).
         */
        put: operations["guardarAlcance"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alcances/aprobacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Aprueba el texto vigente del alcance de una norma
         * @description Queda quién y cuándo. Orden de evaluación: 401, 403, 400, 404 (norma no adoptada o sin alcance definido), 409 (ya aprobado).
         */
        post: operations["aprobarAlcance"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/diagnostico": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Entradas de las librerías adoptadas con su evaluación y la madurez
         * @description La madurez se calcula sobre todas las entradas de la norma elegida (o de todas), sin importar los demás filtros.
         *     Es la madurez de la autoevaluación, no una probabilidad de certificarse. Orden: 401, 403, 400.
         */
        get: operations["obtenerDiagnostico"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/diagnostico/evaluaciones": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Evalúa (o vuelve a evaluar) una cláusula o un control
         * @description Concurrencia optimista: `versionEsperada` es la versión que la persona vio (0 o ausente la primera vez). Si otra persona
         *     la cambió antes, responde 409 y no pisa su trabajo. Orden: 401, 403, 400, 404 (la entrada no existe para esta empresa), 409.
         */
        put: operations["evaluarEntrada"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/acceso/solicitud": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Pide acceso a la empresa del token y recibe un código corto
         * @description Para una persona autenticada que todavía no tiene un rol en la empresa (ADR 036). No exige permiso: justo lo que pide es tenerlo.
         *     La persona y la empresa salen del token verificado y no hay cuerpo. Crea UNA solicitud vigente por persona y empresa, que vence a
         *     los 7 días: pedir de nuevo devuelve la misma, con 200. El código solo sirve para que el administrador SIG reconozca la solicitud;
         *     no es una credencial. El nombre y el correo nunca se leen del token. Orden de evaluación: 401, 409 (la persona ya tiene acceso o la
         *     empresa tiene demasiadas solicitudes vigentes).
         */
        post: operations["solicitarAcceso"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/personas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Personas de la empresa y solicitudes de acceso vigentes
         * @description Para el administrador SIG. Incluye a quienes están dados de baja (con rol nulo y la fecha de baja) y las solicitudes vigentes con
         *     su código. Orden de evaluación: 401, 403.
         */
        get: operations["listarPersonas"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/personas/solicitudes/{id}/aprobacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Aprueba una solicitud de acceso con un rol
         * @description Crea a la persona de la solicitud con el rol, el nombre y el correo que escribe el administrador, o la reactiva si estaba dada de
         *     baja. Una solicitud inexistente, vencida, ya resuelta o de otra empresa responde 404 (indistinguibles). Un correo que ya usa otra
         *     persona de la empresa, o una persona que ya tiene rol, responde 409. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["aprobarSolicitudAcceso"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/personas/solicitudes/{id}/descarte": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Descarta una solicitud de acceso
         * @description La solicitud no se borra: queda resuelta como descartada. Sin cuerpo. Una solicitud que no está vigente responde 404. Orden de
         *     evaluación: 401, 403, 400, 404.
         */
        post: operations["descartarSolicitudAcceso"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/personas/{id}/rol": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Cambia el rol de una persona con acceso
         * @description Con la versión que vio el administrador (409 si cambió). No deja a la empresa sin administrador SIG (409). Una persona dada de
         *     baja o que no existe responde 404: para volver necesita una solicitud nueva. Pedir el mismo rol no cambia nada. Orden de
         *     evaluación: 401, 403, 400, 404, 409.
         */
        put: operations["cambiarRolPersona"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/personas/{id}/baja": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Da de baja a una persona
         * @description Deja el rol en nulo y anota la baja; la persona no se borra (la autoría la referencia). Desde la siguiente petición no puede
         *     nada. No se da de baja al último administrador SIG (409). Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["darDeBajaPersona"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/controles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Marco de controles unificado de la empresa
         * @description Cada control con las entradas de las normas que cubre y las normas que alcanza. Por omisión solo los vigentes. Un mapeo a una
         *     entrada que la empresa ya no tiene adoptada llega con `entrada` nula y no suma normas. Orden de evaluación: 401, 403, 400.
         */
        get: operations["listarControles"];
        put?: never;
        /**
         * Crea un control de la empresa
         * @description El código es propio de la empresa y no se repite, ni siquiera con el de un control retirado (409). Orden de evaluación: 401, 403, 400, 409.
         */
        post: operations["crearControl"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/controles/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Cambia el nombre, la descripción o el responsable de un control vigente
         * @description Concurrencia optimista: `versionEsperada` es la versión que la persona vio. Si otra persona lo cambió antes, o el control
         *     está retirado, responde 409. Lo que no se envía se conserva; `null` quita la descripción o el responsable. Orden de evaluación:
         *     401, 403, 400, 404 (no existe o es de otra empresa), 409.
         */
        put: operations["cambiarControl"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/controles/{id}/retiro": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Retira un control
         * @description Un control no se borra: se retira y queda su rastro. Deja de cambiarse y de recibir mapeos, y su código no se reutiliza.
         *     Orden de evaluación: 401, 403, 400, 404, 409 (versión distinta o ya retirado).
         */
        post: operations["retirarControl"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/controles/{id}/mapeos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Relaciona un control con una entrada de una norma adoptada
         * @description 201 la primera vez y 200 si el mapeo ya existía (no es un error). Un control retirado o con el tope de 50 mapeos responde 409.
         *     La entrada que la empresa no adoptó responde 404, igual que un control inexistente o de otra empresa. Orden de evaluación:
         *     401, 403, 400, 404, 409.
         */
        post: operations["agregarMapeo"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/controles/{id}/mapeos/eliminacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Quita la relación entre un control y una entrada
         * @description No exige que la entrada siga adoptada. Un mapeo que no existe responde 404 y un control retirado, 409. Orden de evaluación:
         *     401, 403, 400, 404, 409.
         */
        post: operations["quitarMapeo"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/controles/{id}/evidencias": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Evidencias de un control
         * @description De la más nueva a la más antigua. Por omisión solo las activas; con `incluirHistoricas` también las reemplazadas y eliminadas.
         *     Cada una indica si está vigente o vencida según la fecha de hoy en Ecuador. Orden de evaluación: 401, 403, 400, 404.
         */
        get: operations["listarEvidencias"];
        put?: never;
        /**
         * Sube una evidencia con su archivo a un control vigente
         * @description `multipart/form-data` con **un solo archivo** (campo `archivo`) de hasta 25 MB. **Los campos de texto van ANTES del archivo**: la API
         *     decide el permiso, los datos y el control antes de leer un solo byte del archivo. El tipo se decide por el **contenido** (PDF, PNG,
         *     JPEG, TXT, DOCX, XLSX o PPTX; sin macros ni SVG ni HTML), nunca por la extensión ni por el tipo que declare el cliente: un archivo
         *     de otro tipo responde 415 y uno de más de 25 MB, 413. Una petición sin archivo responde 400. Un control retirado o con 100
         *     evidencias activas responde 409. Orden de evaluación: 401, 403, 400, 404, 409, 413 o 415.
         */
        post: operations["subirEvidencia"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/evidencias/{id}/reemplazo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reemplaza una evidencia activa por otra con un archivo nuevo
         * @description Misma subida que `subirEvidencia` (campos antes del archivo, un archivo de hasta 25 MB, tipo por contenido). La anterior queda
         *     «reemplazada», con su archivo intacto, y la nueva apunta a ella. El título y el tipo se heredan si no se envían; la fecha del
         *     hecho es obligatoria. Reemplazar una evidencia que ya no está activa, o de un control retirado, responde 409. Si el archivo
         *     nuevo se rechaza, la original sigue activa.
         */
        post: operations["reemplazarEvidencia"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/evidencias/{id}/eliminacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Elimina una evidencia activa
         * @description Cambia su estado a «eliminada» y queda el rastro; el archivo **no se borra**. Solo se elimina una evidencia activa (409 si ya no
         *     lo está). Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["eliminarEvidencia"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/evidencias/{id}/archivo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Descarga el archivo de una evidencia
         * @description Siempre como **adjunto** (`Content-Disposition: attachment`), con el tipo que se detectó al subir, `X-Content-Type-Options: nosniff`
         *     y sin caché. La extensión del nombre es la que corresponde a ese tipo. La descarga **queda en la bitácora antes** de entregar el
         *     archivo y, si no se puede registrar, no se entrega. Una evidencia reemplazada se descarga (es el historial); una eliminada no
         *     (404). Orden de evaluación: 401, 403, 400, 404.
         */
        get: operations["descargarEvidencia"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/cobertura": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Cobertura documental de las entradas de las normas adoptadas
         * @description Para cada entrada que no se evaluó como «no aplica»: cubierta (algún control vigente que la cubre tiene una evidencia activa y
         *     vigente), evidencia vencida, sin evidencia o sin control. Se resume por norma. Mide la cobertura documental, no la eficacia de
         *     los controles. Orden de evaluación: 401, 403, 400.
         */
        get: operations["obtenerCobertura"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/declaracion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Borrador de la Declaración de Aplicabilidad de ISO/IEC 27001
         * @description Una fila por control del Anexo A de las librerías adoptadas, DERIVADA del diagnóstico, de los controles de la empresa y de la
         *     cobertura de las evidencias; no se guarda nada. Trae también la última versión aprobada, si hay, y la justificación: por fila, los
         *     motivos registrados y los riesgos que la tratan (derivado), y qué impide aprobar. Orden: 401, 403.
         */
        get: operations["obtenerDeclaracion"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/declaracion/aprobacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Aprueba la declaración y congela una versión nueva
         * @description Congela, en una sola transacción, lo que la API lee en ese momento: las filas, el alcance de 27001 y los conteos. La versión es
         *     inmutable y su número es correlativo por empresa. Responde 409 si queda algún control por decidir (o no hay controles de la norma
         *     adoptados) y 409 si otra persona aprobó al mismo tiempo. Un control que aplica sin control de la empresa asignado SÍ se puede
         *     aprobar: queda señalado en el documento. También responde 409 si un control que aplica no tiene motivo de inclusión (ni riesgo
         *     que lo trate ni motivo registrado). Congela además los motivos, los riesgos tal como estaban, las referencias al tratamiento y la
         *     escala del nivel de riesgo. Orden: 401, 403, 409.
         */
        post: operations["aprobarDeclaracion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/declaracion/versiones": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Versiones aprobadas de la declaración
         * @description De la más nueva a la más antigua; como máximo las 100 más recientes. Orden de evaluación 401, 403.
         */
        get: operations["listarVersionesDeclaracion"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/declaracion/versiones/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Una versión aprobada con sus filas congeladas
         * @description Una versión de otra empresa responde 404, igual que una inexistente. Orden de evaluación 401, 403, 400, 404.
         */
        get: operations["obtenerVersionDeclaracion"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/declaracion/documento": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Descarga el borrador de la declaración en Word
         * @description Siempre como **adjunto**, con el rótulo de documento preliminar. Queda en la bitácora, con la huella SHA-256 del documento,
         *     **antes** de entregarlo; si no se puede registrar, no se entrega. Orden: 401, 403.
         */
        get: operations["exportarBorradorDeclaracion"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/declaracion/versiones/{id}/documento": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Descarga una versión aprobada de la declaración en Word
         * @description Siempre como **adjunto** y SIEMPRE desde la copia congelada de esa versión, no desde los datos de hoy. Queda en la bitácora con la
         *     huella del documento antes de entregarlo. Una versión de otra empresa responde 404. Orden: 401, 403, 400, 404.
         */
        get: operations["exportarVersionDeclaracion"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/riesgos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Riesgos de la empresa
         * @description Por omisión solo los vigentes. Cada uno trae cuántos controles vigentes de la empresa y cuántos tratamientos previstos tiene, y `sinTratamiento` si su decisión es «mitigar» y no tiene ninguno. Orden de evaluación: 401, 403, 400.
         */
        get: operations["listarRiesgos"];
        put?: never;
        /**
         * Crea un riesgo de la empresa
         * @description El código («R-001») es correlativo por empresa, lo asigna el sistema y no se reutiliza. El nivel inicial se calcula (probabilidad por impacto) y no se envía. La decisión «aceptar» exige responsable (400). Los textos no deben llevar datos personales ni texto de las normas. Orden de evaluación: 401, 403, 400, 409.
         */
        post: operations["crearRiesgo"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/riesgos/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Un riesgo con los controles que lo tratan
         * @description Los controles de la empresa (los retirados se marcan, el vínculo se conserva) y los tratamientos previstos del Anexo A. Un riesgo de otra empresa responde 404, igual que uno inexistente. Orden de evaluación: 401, 403, 400, 404.
         */
        get: operations["obtenerRiesgo"];
        /**
         * Cambia un riesgo vigente
         * @description Concurrencia optimista: `versionEsperada` es la versión que la persona vio. Si otra persona lo cambió antes, o el riesgo está retirado, responde 409. Lo que no se envía se conserva; `null` quita la descripción o el responsable. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        put: operations["cambiarRiesgo"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/riesgos/{id}/aviso-retiro": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Qué controles quedarían sin motivo si se retira el riesgo
         * @description Solo informa; no cambia nada. Lista los controles del Anexo A que aplican y que, al retirar el riesgo, quedarían sin riesgo vigente ni motivo registrado. Orden de evaluación: 401, 403, 400, 404.
         */
        get: operations["avisarRetiroRiesgo"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/riesgos/{id}/retiro": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Retira un riesgo
         * @description Un riesgo no se borra: se retira y conserva su historia; deja de contarse como vigente y su código no se reutiliza. Orden de evaluación: 401, 403, 400, 404, 409 (versión distinta o ya retirado).
         */
        post: operations["retirarRiesgo"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/riesgos/{id}/controles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Vincula un riesgo con un control de la empresa
         * @description 201 la primera vez y 200 si el vínculo ya existía (no es un error). Un riesgo o un control retirado, o el tope de 50 vínculos, responden 409. Un control de otra empresa responde 404. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["vincularRiesgoControl"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/riesgos/{id}/controles/eliminacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Quita el vínculo de un riesgo con un control de la empresa
         * @description Se puede quitar el vínculo con un control ya retirado. Un vínculo que no existe responde 404 y un riesgo retirado, 409. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["desvincularRiesgoControl"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/riesgos/{id}/tratamientos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Vincula un riesgo con un control del Anexo A («tratamiento previsto»)
         * @description Para cuando la empresa aún no tiene el control propio. Cuenta como motivo «riesgo» pero se distingue en la Declaración. 201 la primera vez y 200 si ya existía. La entrada que no es un control del Anexo A de las librerías adoptadas responde 404. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["preverTratamientoRiesgo"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/riesgos/{id}/tratamientos/eliminacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Quita un tratamiento previsto
         * @description No exige que la entrada siga adoptada. Un tratamiento que no existe responde 404 y un riesgo retirado, 409. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["quitarTratamientoPrevisto"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/controles/{id}/riesgos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Riesgos vigentes que trata un control de la empresa
         * @description Un control de otra empresa o inexistente responde 404. Orden de evaluación: 401, 403, 400, 404.
         */
        get: operations["listarRiesgosDeControl"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/declaracion/motivos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Motivos de inclusión registrados
         * @description Solo los que se escriben (legal, contractual, negocio u otro, cada uno con su nota). El motivo «riesgo» no está aquí: se deriva de los riesgos. Orden de evaluación: 401, 403.
         */
        get: operations["listarMotivosDeclaracion"];
        /**
         * Registra o cambia un motivo de inclusión de un control del Anexo A
         * @description Sin `versionEsperada` se crea; con ella se cambia. Si otra persona lo creó, cambió o quitó antes, responde 409. La nota es obligatoria y en palabras propias. Solo controles del Anexo A de las librerías adoptadas (si no, 404). Orden de evaluación: 401, 403, 400, 404, 409.
         */
        put: operations["registrarMotivoDeclaracion"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/declaracion/motivos/eliminacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Quita un motivo de inclusión
         * @description Exige la versión que la persona vio. Un motivo que no existe responde 404 y una versión distinta, 409. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["quitarMotivoDeclaracion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/declaracion/referencias": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Referencias al análisis y al plan de tratamiento de riesgos
         * @description A lo sumo una de cada tipo. Solo se nombra el documento; el producto no lo guarda. Orden de evaluación: 401, 403.
         */
        get: operations["listarReferenciasDeclaracion"];
        /**
         * Registra o cambia la referencia al análisis o al plan de tratamiento
         * @description Sin `versionEsperada` se crea; con ella se cambia. Si otra persona la creó, cambió o quitó antes, responde 409. Orden de evaluación: 401, 403, 400, 409.
         */
        put: operations["guardarReferenciaDeclaracion"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/declaracion/referencias/eliminacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Quita una referencia
         * @description Exige la versión que la persona vio. Una referencia que no existe responde 404 y una versión distinta, 409. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["quitarReferenciaDeclaracion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/documentos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Documentos de la empresa
         * @description Con filtros opcionales. Marca los que no tienen versión vigente, con revisión vencida o por vencer en 30 días y con lecturas pendientes. Orden de evaluación: 401, 403, 400.
         */
        get: operations["listarDocumentos"];
        put?: never;
        /**
         * Crea un documento
         * @description El código lo asigna el sistema por tipo (POL-001). No tiene versión vigente hasta aprobar la primera. El responsable debe ser una persona activa de la empresa. Orden de evaluación: 401, 403, 400, 409.
         */
        post: operations["crearDocumento"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/documentos/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Un documento con sus versiones, distribución y vínculos
         * @description Trae el historial completo de versiones (quién redactó, quién aprobó, cuándo, huella), la distribución, los vínculos y la retención del tipo. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        get: operations["obtenerDocumento"];
        /**
         * Cambia los datos de un documento
         * @description Lo cambia quien gestiona documentos o su responsable. Exige la versión que la persona vio (409 si otra persona cambió antes). Un documento retirado responde 409. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        put: operations["cambiarDocumento"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/documentos/{id}/retiro": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Retira un documento
         * @description Queda sin versión vigente (la aprobada pasa a obsoleta) y conserva su historia y su código; nada se borra. Un documento ya retirado responde 409. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["retirarDocumento"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/documentos/{id}/revision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Registra «revisado sin cambios»
         * @description Lo registra el responsable del documento o quien gestiona. Reinicia la fecha de próxima revisión sin crear versión. Sin versión vigente responde 409. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["revisarDocumento"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/documentos/{id}/distribucion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Define los destinatarios del documento
         * @description Reemplaza la lista. «Todas las personas de un rol» se resuelve en este momento. Solo cuentan personas activas de la empresa (400 si no). Orden de evaluación: 401, 403, 400, 404, 409.
         */
        put: operations["cambiarDistribucion"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/documentos/{id}/vinculos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Liga el documento a un control o a una entrada de una norma adoptada
         * @description Crea el vínculo (201) o responde 200 si ya existía. Una entrada de una librería no adoptada, o un control de otra empresa, responde 404. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["vincularDocumento"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/documentos/{id}/vinculos/eliminacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Quita un vínculo del documento
         * @description Un vínculo que no existe responde 404. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["desvincularDocumento"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/documentos/{id}/versiones": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Sube una versión nueva (borrador) de un documento
         * @description `multipart/form-data` con la nota y **un solo archivo** (campo `archivo`) de hasta 25 MB. **La nota va ANTES del archivo**: la API decide permiso, datos y documento antes de leer un solo byte. El tipo se decide por el **contenido** (PDF, PNG, JPEG, TXT, DOCX, XLSX o PPTX; sin macros ni SVG ni HTML): otro tipo responde 415 y más de 25 MB, 413. Solo puede haber una versión abierta (borrador o en revisión) a la vez: otra responde 409. Orden de evaluación: 401, 403, 400, 404, 409, 413 o 415.
         */
        post: operations["subirVersion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/versiones/{id}/envio": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Envía un borrador a revisión
         * @description Lo envía su autor o quien gestiona documentos, nombrando quién lo aprueba: una persona activa con permiso de aprobar y distinta del autor (salvo el único administrador). Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["enviarARevision"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/versiones/{id}/devolucion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Devuelve una versión en revisión a borrador
         * @description Solo la persona nombrada como aprobadora, con un motivo de lista cerrada y una nota breve opcional. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["devolverVersion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/versiones/{id}/aprobacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Aprueba una versión en revisión
         * @description Solo la persona nombrada como aprobadora, **distinta del autor**. Con un solo administrador activo puede aprobar la suya con `motivoExcepcion` obligatorio; queda marcada. La versión anterior pasa a obsoleta en el mismo acto: siempre una sola vigente. Rige desde ahora (no hay vigencia futura). Crea las lecturas pendientes de los destinatarios: siempre en la primera versión y, en las siguientes, solo con `requiereLectura`. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["aprobarVersion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/versiones/{id}/descarte": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Descarta un borrador
         * @description Queda registrado, no se borra. Solo su autor o quien gestiona documentos. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["descartarVersion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/versiones/{id}/archivo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Descarga el archivo de una versión
         * @description Siempre como **adjunto**, con el tipo detectado al subir, `X-Content-Type-Options: nosniff` y sin caché. La descarga **queda en la bitácora antes** de entregar el archivo y, si no se puede registrar, no se entrega. Una versión obsoleta o en borrador se descarga; la pantalla la rotula «no vigente» (el archivo no se altera). Una descartada no se descarga (404). Orden de evaluación: 401, 403, 400, 404.
         */
        get: operations["descargarVersion"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/versiones/{id}/lectura": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Confirma que leyó la versión vigente
         * @description Solo la propia persona; nadie confirma por otra. Es una constancia de conocimiento, no una capacitación. Una versión que ya no rige, una lectura inexistente o ya confirmada responde 409. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["confirmarLectura"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/lecturas/pendientes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Mis lecturas pendientes
         * @description Versiones vigentes que la persona aún no confirmó. Orden de evaluación: 401, 403.
         */
        get: operations["listarLecturasPendientes"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/cobertura-documental": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Entradas de las normas adoptadas con y sin documento vigente
         * @description Informativa: no bloquea nada y es distinta de la cobertura de evidencias. Orden de evaluación: 401, 403, 400.
         */
        get: operations["obtenerCoberturaDocumental"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/retencion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Período de conservación por tipo de documento
         * @description Solo los tipos que la empresa definió: sin valor por omisión (la pantalla muestra «retención no definida»). Orden de evaluación: 401, 403.
         */
        get: operations["listarRetencion"];
        /**
         * Fija los años y el motivo de conservación de un tipo
         * @description Sin `versionEsperada` crea; con ella cambia (409 si otra persona cambió antes). Pasado el período, una versión obsoleta solo se **marca** como elegible: el sistema no borra nada. Orden de evaluación: 401, 403, 400, 409.
         */
        put: operations["guardarRetencion"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/certificacion/personas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Directorio de personas de la empresa
         * @description Solo identificador, nombre y si sigue activa, para mostrar responsables sin pedir más datos. Sin correo ni rol. Orden de evaluación: 401, 403.
         */
        get: operations["listarDirectorioPersonas"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/procesos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Procesos de la empresa
         * @description Con su dueña, importancia, frecuencia prevista, cuántas personas están relacionadas y avisos (sin relaciones registradas o dueña dada de baja). Orden de evaluación: 401, 403.
         */
        get: operations["listarProcesos"];
        put?: never;
        /**
         * Crea un proceso
         * @description El código lo asigna el sistema (PR-001). La dueña debe ser una persona activa de la empresa y queda con la relación «dueña». Orden de evaluación: 401, 403, 400, 409.
         */
        post: operations["crearProceso"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/procesos/gestion-sig": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Crea el proceso transversal «Gestión del SIG»
         * @description Quien llama queda como dueña. Entra al alcance de toda auditoría que cubra las cláusulas 4 a 10. Solo puede haber uno vigente (409). Orden de evaluación: 401, 403, 409.
         */
        post: operations["crearProcesoGestionSig"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/procesos/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Cambia un proceso
         * @description Lo ausente no se toca. Exige `versionEsperada` (si otra persona lo cambió antes, 409). Un proceso retirado no se cambia. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        put: operations["cambiarProceso"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/procesos/{id}/retiro": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Retira un proceso
         * @description Queda fuera de las nuevas auditorías y conserva su historia y su código; nada se borra. Un proceso ya retirado responde 409. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["retirarProceso"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/procesos/{id}/relaciones": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Personas relacionadas con un proceso
         * @description Las relaciones registradas (dueña, participa, diseñó, supervisa); con ellas se comprueba la independencia de quien audita. Orden de evaluación: 401, 403, 400, 404.
         */
        get: operations["listarRelacionesProceso"];
        put?: never;
        /**
         * Relaciona una persona con un proceso
         * @description Idempotente: 201 si se creó y 200 si ya existía. La persona debe estar activa en la empresa. Un proceso retirado responde 409. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["agregarRelacionProceso"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/procesos/{id}/relaciones/eliminacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Quita la relación de una persona con un proceso
         * @description Con rastro en la bitácora. La dueña vigente conserva su relación «dueña» (409): primero se cambia la dueña del proceso. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["quitarRelacionProceso"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/programas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Programas anuales de auditoría de la empresa
         * @description Uno por año, con su estado y las normas que cubre. Orden de evaluación: 401, 403.
         */
        get: operations["listarProgramas"];
        put?: never;
        /**
         * Crea el programa anual de un año
         * @description Uno por año y empresa (409 si ya existe). Las normas deben ser librerías que la empresa adoptó. Nace «sin aprobar». Orden de evaluación: 401, 403, 400, 409.
         */
        post: operations["crearPrograma"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/programas/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Un programa con sus auditorías, motivos y ayudas
         * @description Trae las auditorías del año (con su trimestre), los motivos de lo que no entra, lo que falta por incluir o justificar y, por proceso, la importancia, la frecuencia prevista, la última auditoría cerrada y los hallazgos abiertos. Orden de evaluación: 401, 403, 400, 404.
         */
        get: operations["obtenerPrograma"];
        /**
         * Cambia el objetivo o las normas de un programa
         * @description Exige `versionEsperada`. Cambiar el objetivo o las normas de un programa aprobado lo devuelve a «sin aprobar». Orden de evaluación: 401, 403, 400, 404, 409.
         */
        put: operations["cambiarPrograma"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/programas/{id}/aprobacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Aprueba el programa
         * @description Solo el administrador SIG. Cada proceso vigente y cada capítulo o tema de las normas del programa debe estar en alguna auditoría del año o llevar un motivo de por qué no entra; si falta alguno responde 409. Deja constancia de quién y cuándo. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["aprobarPrograma"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/programas/{id}/exclusiones": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Registra por qué un proceso o capítulo no entra en el año
         * @description Un proceso (por su identificador) o un capítulo o tema de una de las normas del programa, con su motivo (por ejemplo «auditado el año pasado sin hallazgos»). Solo mientras el programa no está aprobado (409). Uno por proceso o capítulo. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["agregarExclusionPrograma"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/programas/{id}/exclusiones/eliminacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Quita un motivo de exclusión
         * @description Solo mientras el programa no está aprobado (409). Con rastro en la bitácora. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["quitarExclusionPrograma"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/programas/{id}/auditorias": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Planifica una auditoría dentro de un programa
         * @description El código lo asigna el sistema por año (AI-2027-01). Criterios: una o varias normas del programa (con más de una es combinada). Alcance: procesos vigentes y, si se quiere, capítulos o temas de las normas. El inicio debe caer en el año del programa. En un programa aprobado exige `motivo` (lista cerrada) y nota breve. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["crearAuditoria"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auditorias/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Una auditoría con su alcance y su equipo
         * @description Incluye los procesos del alcance (con «Gestión del SIG» cuando cubre las cláusulas 4 a 10) y, de cada integrante, si lleva una excepción de independencia. Orden de evaluación: 401, 403, 400, 404.
         */
        get: operations["obtenerAuditoria"];
        /**
         * Cambia objetivo, fechas, reuniones o alcance
         * @description Lo ausente no se toca. Exige `versionEsperada`. Solo antes de pasar a «en ejecución» (409). Si cambia el alcance, el equipo se vuelve a comprobar: un integrante que dejaría de ser independiente (y no tiene excepción) lo impide con 409. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        put: operations["cambiarAuditoria"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auditorias/{id}/reprogramacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reprograma las fechas de una auditoría
         * @description Cambia las fechas con un motivo (lista cerrada) y una nota breve; no crea otra auditoría y suma una reprogramación. No procede en una auditoría con informe emitido, cerrada o cancelada (409). Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["reprogramarAuditoria"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auditorias/{id}/cancelacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cancela una auditoría
         * @description Conserva todo lo registrado, no cuenta para la cobertura y no se reabre. Solo hasta estar en ejecución (409). Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["cancelarAuditoria"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auditorias/{id}/avance": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Pasa a «en preparación» o a «en ejecución»
         * @description Solo avanza. «En preparación» exige un líder y criterios; «en ejecución» exige haber llegado la fecha de inicio y la fecha de la reunión de apertura. El informe y el cierre tienen sus propias operaciones. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["avanzarAuditoria"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auditorias/{id}/independencia": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Comprueba si una persona puede auditar este alcance
         * @description Por cada proceso del alcance dice si la persona tiene una relación registrada (lo que impide designarla) y si ya lo auditó en los últimos 12 meses (solo un aviso). Solo consulta. Orden de evaluación: 401, 403, 400, 404.
         */
        get: operations["comprobarIndependencia"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auditorias/{id}/equipo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Designa a una persona en el equipo
         * @description Debe ser una persona activa con rol de administrador SIG o auditor interno. Con un conflicto de independencia solo se designa con una excepción (motivo y medida compensatoria); nadie autoriza su propia excepción salvo el único administrador activo. Un solo líder por auditoría. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["designarMiembroAuditoria"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auditorias/{id}/equipo/eliminacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Quita a una persona del equipo
         * @description Solo antes de «en ejecución». En preparación el líder no se quita (409). Con rastro en la bitácora. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["quitarMiembroAuditoria"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auditorias/{id}/lista": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * La lista de verificación de una auditoría
         * @description Una fila por entrada de las normas adoptadas (título breve y guía propia, nunca texto de la norma), con su resultado, las preguntas propias del equipo y, como contexto, el estado del diagnóstico. Trae el avance. Orden de evaluación: 401, 403, 400, 404.
         */
        get: operations["obtenerListaVerificacion"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auditorias/{id}/lista/regeneracion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Regenera la lista a propósito
         * @description Solo en preparación. Agrega las filas que faltan, quita las «por evaluar» que ya no corresponden y conserva lo ya evaluado (avisa cuántas quedaron fuera del alcance). La lista se genera sola al pasar a «en preparación». Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["regenerarListaVerificacion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auditorias/{id}/lista/resultado": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Asigna el resultado de una fila
         * @description Solo con la auditoría en ejecución y solo el equipo designado (los demás reciben 403). Un resultado distinto de «conforme» y «no verificado» exige la nota con la evidencia objetiva; «no aplica» exige justificación. Concurrencia por `versionEsperada`. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        put: operations["evaluarFilaLista"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auditorias/{id}/lista/preguntas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Agrega una pregunta propia a una fila
         * @description Hasta 5 por fila, en preparación o en ejecución y solo el equipo designado. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["agregarPreguntaLista"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auditorias/{id}/lista/preguntas/eliminacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Quita una pregunta propia
         * @description En preparación o en ejecución y solo el equipo designado. Con rastro en la bitácora. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["quitarPreguntaLista"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auditorias/{id}/hallazgos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Hallazgos de una auditoría
         * @description Con los abiertos contados por tipo. Orden de evaluación: 401, 403, 400, 404.
         */
        get: operations["listarHallazgos"];
        /**
         * Cambia un hallazgo
         * @description Lo ausente se conserva y el resultado debe cumplir las reglas completas. Exige `versionEsperada`. Pasar a NC mayor, dejar de serlo o cambiar su justificación es del líder. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        put: operations["cambiarHallazgo"];
        /**
         * Registra un hallazgo
         * @description Solo con la auditoría en ejecución y solo el equipo designado. Una no conformidad lleva el proceso (del alcance), el requisito incumplido (o la fila de la que sale), la evidencia objetiva y el enunciado; la mayor, además, la justificación de la gravedad y solo la registra el líder. Observación y oportunidad no son incumplimientos. Queda abierto: su tratamiento es de otro módulo. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["registrarHallazgo"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auditorias/{id}/hallazgos/anulacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Anula un hallazgo
         * @description Un hallazgo no se borra: se anula con un motivo cerrado mientras la auditoría está en ejecución. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["anularHallazgo"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auditorias/{id}/informe": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * El informe emitido (copia congelada)
         * @description La copia que se congeló al emitir, con su huella SHA-256. Es inmutable. 404 si todavía no se emitió. Orden de evaluación: 401, 403, 400, 404.
         */
        get: operations["obtenerInforme"];
        put?: never;
        /**
         * Emite el informe de la auditoría
         * @description Lo emite el administrador SIG o el auditor líder, con la auditoría en ejecución. Exige todas las filas evaluadas, «no verificado» con su nota, un hallazgo activo por cada fila con resultado distinto de conforme y la fecha de la reunión de cierre; vuelve a comprobar la independencia del equipo. Congela una copia con conclusión y limitaciones y la deja inmutable. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["emitirInforme"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auditorias/{id}/cierre": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cierra la auditoría
         * @description Solo el administrador SIG, después de emitir el informe. Cerrar no cierra los hallazgos: siguen abiertos hasta tratarse en el módulo de no conformidades. Orden de evaluación: 401, 403, 400, 404, 409.
         */
        post: operations["cerrarAuditoria"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auditoria/panel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Prerrequisito de la Etapa 2 y cobertura de las auditorías
         * @description Calcula y muestra si se cumple el prerrequisito (al menos una auditoría cerrada con informe que, con las demás cerradas del programa, cubra las cláusulas 4 a 10, los procesos del alcance y los controles aplicables de la Declaración aprobada) y qué falta como brecha. No decide la etapa. Orden de evaluación: 401, 403.
         */
        get: operations["obtenerPanelAuditoria"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @description Error según RFC 9457, deliberadamente cerrado. No lleva `detail` ni campos libres para no filtrar datos de la solicitud. */
        Problema: {
            /** @constant */
            type: "about:blank";
            title: string;
            status: number;
            /** @enum {string} */
            codigo: "no_autenticado" | "sin_permiso" | "no_encontrado" | "parametro_invalido" | "conflicto" | "archivo_demasiado_grande" | "tipo_no_permitido" | "limite_excedido" | "error_interno";
        };
        Salud: {
            /** @constant */
            status: "ok";
            /** Format: date-time */
            time: string;
        };
        EmpresaDePersona: {
            slug: string;
            nombre: string;
            /** @description Es la empresa de esta sesión ahora. */
            activa: boolean;
        };
        EmpresaElegida: {
            slug: string;
        };
        EmpresaActual: {
            slug: string;
            nombre: string;
        };
        /** @description La persona que consulta, tomada del token verificado. */
        Identidad: {
            /**
             * Format: uuid
             * @description Identificador opaco de la cuenta.
             */
            usuarioId: string;
            nombre: string;
            roles: ("administrador_sig" | "dueno_proceso" | "auditor_interno" | "auditor_externo" | "colaborador" | "alta_direccion")[];
            /** @description La empresa del token. Solo el nombre y el slug (el de la URL `/e/<slug>`); no se expone su identificador interno. */
            empresa: {
                slug: string;
                nombre: string;
            };
        };
        Marca: {
            nombre: string;
            /** @description Color que se aplica (ya ajustado si no cumplía el contraste mínimo). */
            colorPrimario: string;
            /** @description Color configurado por la empresa (es la marca de la propia empresa, no un dato de otra). */
            colorOriginal: string;
            /** @description Verdadero si el color original se ajustó para cumplir el contraste mínimo; el administrador SIG ve un aviso. */
            ajustadoPorContraste: boolean;
            /** @description Solo `https` sin credenciales en la URL, o un archivo de imagen bajo `/logos/` (nunca otra ruta del sitio). Si no es válido se devuelve nulo y se muestra el monograma. */
            logoUrl: string | null;
        };
        /** @description Lo que la empresa elige. La empresa nunca viaja aquí, sale del token. */
        MarcaEdicion: {
            colorPrimario: string;
            /** @description Solo `https` sin credenciales, un archivo de imagen bajo `/logos/` o nulo para quitarlo. */
            logoUrl: string | null;
        };
        /** @enum {string} */
        RolPersona: "administrador_sig" | "dueno_proceso" | "auditor_interno" | "auditor_externo" | "colaborador" | "alta_direccion";
        /** @description Lo que la persona le entrega al administrador. No lleva nombre ni correo. */
        SolicitudAcceso: {
            codigo: string;
            /** Format: date-time */
            venceEn: string;
        };
        SolicitudPendiente: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            usuarioId: string;
            codigo: string;
            /** Format: date-time */
            creadaEn: string;
            /** Format: date-time */
            venceEn: string;
        };
        /** @description Una persona de la empresa. El rol nulo es una persona sin acceso (dada de baja). Nombre y correo son datos personales. */
        Persona: {
            /** Format: uuid */
            id: string;
            nombre: string;
            correo: string;
            /**
             * @description Nulo si la persona está dada de baja (sin acceso).
             * @enum {string|null}
             */
            rol: "administrador_sig" | "dueno_proceso" | "auditor_interno" | "auditor_externo" | "colaborador" | "alta_direccion" | null;
            /** Format: date-time */
            bajaEn: string | null;
            version: number;
        };
        Personas: {
            personas: components["schemas"]["Persona"][];
            solicitudes: components["schemas"]["SolicitudPendiente"][];
        };
        /** @description Lo que escribe el administrador. La empresa y la persona de la solicitud no viajan aquí. */
        AprobacionSolicitud: {
            nombre: string;
            correo: string;
            rol: components["schemas"]["RolPersona"];
        };
        CambioDeRol: {
            rol: components["schemas"]["RolPersona"];
            versionEsperada: number;
        };
        PersonaVersion: {
            versionEsperada: number;
        };
        LibreriaResumen: {
            /** Format: uuid */
            id: string;
            codigo: string;
            nombre: string;
            version: string;
            /** @description Una librería de ejemplo se muestra rotulada como tal. */
            esEjemplo: boolean;
            fuente: string;
            /** @description Verdadero si la subió la empresa de quien consulta (ADR 034); falso si es del catálogo global. */
            propia: boolean;
            /** @description Si la empresa de quien consulta ya la adoptó. */
            adoptada: boolean;
        };
        LibreriaSubida: {
            /**
             * Format: binary
             * @description El YAML de la librería (hasta 1 MB).
             */
            archivo: string;
        };
        /** @description Qué falló y dónde. Nunca repite el contenido del archivo. */
        ErrorCargaLibreria: {
            /** @description Identificador de la entrada afectada, si aplica. */
            entrada: string | null;
            indice: number | null;
            ruta: string;
            codigo: string;
        };
        CargaLibreria: {
            /** @enum {string} */
            estado: "cargada" | "ya_cargada" | "rechazada";
            /**
             * @description Solo si el estado es `rechazada`.
             * @enum {string|null}
             */
            motivo: "tipo_no_permitido" | "tamano_excedido" | "formato_invalido" | "contenido_no_permitido" | "codigo_no_permitido" | "hash_distinto" | null;
            codigo: string | null;
            version: string | null;
            entradas: number | null;
            /** @description SHA-256 del contenido canónico (si es válida) o de los bytes del archivo (si no). */
            huella: string;
            errores: components["schemas"]["ErrorCargaLibreria"][];
        };
        Adopcion: {
            /** Format: uuid */
            libreriaId: string;
            /** @description Cantidad de entradas que quedaron disponibles para la empresa. */
            entradas: number;
            /** @description Verdadero si la librería ya estaba adoptada (respuesta 200, sin cambios). */
            yaAdoptada: boolean;
            /** Format: date-time */
            adoptadaEn: string;
        };
        /** @description Una entrada (apartado) de una librería adoptada. Una cláusula real puede descomponerse en varios requisitos evaluables. */
        EntradaLibreria: {
            /** Format: uuid */
            id: string;
            /** @description Identificador estable propio de la librería (no depende de la numeración de una norma). */
            idEstable: string;
            /** Format: uuid */
            libreriaId: string;
            /** @description Capítulo de la Estructura Armonizada; nulo en un control del Anexo A. */
            capitulo: number | null;
            /** @enum {integer} */
            nivel: 1 | 2;
            /** @enum {string} */
            tipo: "clausula" | "control";
            /** @description Tema del control del Anexo A; nulo en una cláusula. */
            grupo: string | null;
            titulo: string;
            guia: string;
            /** @enum {string} */
            alcanceComun: "comun" | "parcial" | "especifico";
            /** @description Cláusula que corresponde a la entrada en cada norma y edición (el identificador puede diferir entre normas). */
            aplicaA: {
                norma: string;
                edicion: string;
                clausula: string;
            }[];
            /** @description Si la librería es de ejemplo, la interfaz lo rotula y remite al ejemplar oficial de la empresa. */
            esEjemplo: boolean;
        };
        AlcanceNorma: {
            norma: string;
        };
        AlcanceEntrada: {
            norma: string;
            texto: string;
        };
        Alcance: {
            norma: string;
            /** @description Nulo mientras el alcance no se haya definido. */
            texto: string | null;
            aprobado: boolean;
            /** Format: date-time */
            aprobadoEn: string | null;
            /** Format: date-time */
            actualizadoEn: string | null;
        };
        /** @enum {string} */
        EstadoEvaluacion: "cumple" | "parcial" | "no_cumple" | "no_aplica";
        EvaluacionEntrada: {
            libreriaCodigo: string;
            idEstable: string;
            estado: components["schemas"]["EstadoEvaluacion"];
            /** @description Obligatorio (mínimo 5 caracteres) para «no aplica». */
            comentario?: string | null;
            /** Format: uuid */
            responsableId?: string | null;
            /** Format: date */
            fechaObjetivo?: string | null;
            versionEsperada?: number;
        };
        Evaluacion: {
            libreriaCodigo: string;
            idEstable: string;
            estado: components["schemas"]["EstadoEvaluacion"];
            comentario: string | null;
            /** Format: uuid */
            responsableId: string | null;
            /** Format: date */
            fechaObjetivo: string | null;
            version: number;
        };
        EvaluacionVigente: {
            estado: components["schemas"]["EstadoEvaluacion"];
            comentario: string | null;
            /** Format: date */
            fechaObjetivo: string | null;
            version: number;
        };
        FilaDiagnostico: {
            libreriaCodigo: string;
            idEstable: string;
            /** @enum {string} */
            tipo: "clausula" | "control";
            capitulo: number | null;
            grupo: string | null;
            titulo: string;
            guia: string;
            aplicaA: {
                norma: string;
                edicion: string;
                clausula: string;
            }[];
            /** @description Nulo = sin evaluar. */
            evaluacion: components["schemas"]["EvaluacionVigente"] | null;
        };
        Desglose: {
            cumple: number;
            parcial: number;
            noCumple: number;
            noAplica: number;
            sinEvaluar: number;
            total: number;
            /** @description Nulo si no hay nada evaluado que cuente (no es 0). */
            porcentaje: number | null;
        };
        MadurezNorma: {
            norma: string;
            desglose: components["schemas"]["Desglose"];
        };
        MadurezAgrupador: {
            /** @enum {string} */
            tipo: "capitulo" | "tema";
            /** @description Capítulo (por ejemplo «4») o tema del Anexo A. */
            nombre: string;
            desglose: components["schemas"]["Desglose"];
        };
        Madurez: {
            porNorma: components["schemas"]["MadurezNorma"][];
            porAgrupador: components["schemas"]["MadurezAgrupador"][];
            clausulas: components["schemas"]["Desglose"];
        };
        Diagnostico: {
            filas: components["schemas"]["FilaDiagnostico"][];
            madurez: components["schemas"]["Madurez"];
            normas: string[];
        };
        /** @enum {string} */
        EstadoControl: "vigente" | "retirado";
        Control: {
            /** Format: uuid */
            id: string;
            codigo: string;
            nombre: string;
            descripcion: string | null;
            /** Format: uuid */
            responsableId: string | null;
            estado: components["schemas"]["EstadoControl"];
            version: number;
        };
        ControlEntrada: {
            codigo: string;
            nombre: string;
            descripcion?: string | null;
            /** Format: uuid */
            responsableId?: string | null;
        };
        ControlCambios: {
            versionEsperada: number;
            nombre?: string;
            descripcion?: string | null;
            /** Format: uuid */
            responsableId?: string | null;
        };
        ControlVersion: {
            versionEsperada: number;
        };
        MapeoEntrada: {
            libreriaCodigo: string;
            idEstable: string;
        };
        MapeoResultado: {
            libreriaCodigo: string;
            idEstable: string;
            /** @description Verdadero si se creó (201); falso si ya existía (200). */
            creado: boolean;
        };
        EntradaDeMapeo: {
            /** @enum {string} */
            tipo: "clausula" | "control";
            titulo: string;
            aplicaA: {
                norma: string;
                edicion: string;
                clausula: string;
            }[];
        };
        MapeoDeControl: {
            libreriaCodigo: string;
            idEstable: string;
            /** @description Nula si la entrada ya no está entre las librerías que la empresa adoptó. */
            entrada: components["schemas"]["EntradaDeMapeo"] | null;
        };
        ControlMarco: {
            /** Format: uuid */
            id: string;
            codigo: string;
            nombre: string;
            descripcion: string | null;
            /** Format: uuid */
            responsableId: string | null;
            estado: components["schemas"]["EstadoControl"];
            version: number;
            mapeos: components["schemas"]["MapeoDeControl"][];
            /** @description Normas que alcanza por los mapeos cuyas entradas siguen adoptadas. */
            normas: string[];
        };
        MarcoControles: {
            controles: components["schemas"]["ControlMarco"][];
            normas: string[];
        };
        /** @enum {string} */
        TipoEvidencia: "documento" | "registro";
        /** @enum {string} */
        EstadoEvidencia: "activa" | "reemplazada" | "eliminada";
        /** @enum {string} */
        TipoArchivo: "application/pdf" | "image/png" | "image/jpeg" | "text/plain" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document" | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" | "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        ArchivoEvidencia: {
            /** @description Etiqueta normalizada (sin carpetas ni símbolos); en el almacén el archivo es un UUID del servidor. */
            nombre: string;
            tipo: components["schemas"]["TipoArchivo"];
            bytes: number;
            sha256: string;
        };
        Evidencia: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            controlId: string;
            tipo: components["schemas"]["TipoEvidencia"];
            titulo: string;
            /** Format: date */
            fechaHecho: string;
            /** Format: date */
            vigenteHasta: string | null;
            estado: components["schemas"]["EstadoEvidencia"];
            /** Format: uuid */
            reemplazaId: string | null;
            /** @description Activa y con la vigencia al día (fecha de hoy en Ecuador). */
            vigente: boolean;
            /** @description Activa pero con la vigencia ya pasada. */
            vencida: boolean;
            /** Format: date-time */
            creadaEn: string;
            archivo: components["schemas"]["ArchivoEvidencia"];
        };
        /** @description Los campos de texto van antes del archivo. */
        EvidenciaSubida: {
            tipo: components["schemas"]["TipoEvidencia"];
            titulo: string;
            /**
             * Format: date
             * @description El día en que ocurrió lo que la evidencia demuestra; no puede ser futuro.
             */
            fechaHecho: string;
            /**
             * Format: date
             * @description Opcional; no anterior a la fecha del hecho.
             */
            vigenteHasta?: string;
            /** Format: binary */
            archivo: string;
        };
        /** @description Los campos de texto van antes del archivo. */
        EvidenciaReemplazo: {
            tipo?: components["schemas"]["TipoEvidencia"];
            titulo?: string;
            /** Format: date */
            fechaHecho: string;
            /** Format: date */
            vigenteHasta?: string;
            /** Format: binary */
            archivo: string;
        };
        /** @enum {string} */
        AplicabilidadDeclaracion: "aplica" | "no_aplica" | "por_decidir";
        FilaDeclaracion: {
            libreriaCodigo: string;
            idEstable: string;
            orden: number;
            titulo: string;
            grupo: string | null;
            aplicabilidad: components["schemas"]["AplicabilidadDeclaracion"];
            /** @description implementado, parcial o no_implementado; nula si no aplica o está por decidir. */
            implementacion: string | null;
            /** @description Solo si no aplica; es la que la empresa escribió al evaluar. */
            justificacion: string | null;
            /** @description Códigos de los controles vigentes de la empresa que la cubren. */
            controles: string[];
            cobertura: components["schemas"]["EstadoCobertura"];
        };
        ResumenDeclaracion: {
            total: number;
            aplican: number;
            noAplican: number;
            porDecidir: number;
            /** @description Aplican y ningún control de la empresa los cubre; no impide aprobar. */
            sinControl: number;
            /** @description Hay filas */
            aprobable: boolean;
        };
        VersionDeclaracion: {
            /** Format: uuid */
            id: string;
            numero: number;
            total: number;
            aplican: number;
            noAplican: number;
            sinControl: number;
            /** Format: uuid */
            aprobadaPor: string;
            /** Format: date-time */
            aprobadaEn: string;
        };
        VersionDeclaracionConFilas: {
            /** Format: uuid */
            id: string;
            numero: number;
            total: number;
            aplican: number;
            noAplican: number;
            sinControl: number;
            /** Format: uuid */
            aprobadaPor: string;
            /** Format: date-time */
            aprobadaEn: string;
            /** @description El alcance de la norma tal como estaba al aprobar. */
            alcance: string | null;
            filas: components["schemas"]["FilaDeclaracion"][];
            justificacion: components["schemas"]["JustificacionVersion"];
        };
        Declaracion: {
            norma: string;
            /**
             * Format: date
             * @description La fecha de hoy en Ecuador con la que se calculó la cobertura.
             */
            hoy: string;
            resumen: components["schemas"]["ResumenDeclaracion"];
            filas: components["schemas"]["FilaDeclaracion"][];
            /** @description El alcance de la norma tal como está hoy (aprobado o no); nulo si no se definió. */
            alcance: {
                texto: string;
                aprobado: boolean;
            } | null;
            /** @description La última versión aprobada; nula si todavía no hay ninguna. */
            ultimaVersion: {
                /** Format: uuid */
                id: string;
                numero: number;
                total: number;
                aplican: number;
                noAplican: number;
                sinControl: number;
                /** Format: uuid */
                aprobadaPor: string;
                /** Format: date-time */
                aprobadaEn: string;
            } | null;
            justificacion: components["schemas"]["JustificacionBorrador"];
        };
        /** @enum {string} */
        EstadoCobertura: "cubierta" | "evidencia_vencida" | "sin_evidencia" | "sin_control" | "no_aplica";
        ResumenCobertura: {
            total: number;
            cubiertas: number;
            evidenciaVencida: number;
            sinEvidencia: number;
            sinControl: number;
            /** @description Nulo si no hay ninguna entrada a la que pedir cobertura (no es 0). */
            porcentaje: number | null;
        };
        CoberturaNorma: {
            norma: string;
            total: number;
            cubiertas: number;
            evidenciaVencida: number;
            sinEvidencia: number;
            sinControl: number;
            porcentaje: number | null;
        };
        CoberturaEntrada: {
            libreriaCodigo: string;
            idEstable: string;
            /** @enum {string} */
            tipo: "clausula" | "control";
            capitulo: number | null;
            grupo: string | null;
            titulo: string;
            normas: string[];
            estado: components["schemas"]["EstadoCobertura"];
            /** @description Controles vigentes que la cubren por un mapeo. */
            controles: number;
            /** @description Evidencias activas de esos controles (vigentes o no). */
            evidencias: number;
        };
        Cobertura: {
            /**
             * Format: date
             * @description La fecha de hoy en Ecuador con la que se calculó el vencimiento.
             */
            hoy: string;
            entradas: components["schemas"]["CoberturaEntrada"][];
            porNorma: components["schemas"]["CoberturaNorma"][];
            total: components["schemas"]["ResumenCobertura"];
            normas: string[];
        };
        /**
         * @description Nivel inicial calculado de probabilidad por impacto con los cortes de `EscalaRiesgo`; la persona no lo escribe.
         * @enum {string}
         */
        NivelRiesgo: "bajo" | "medio" | "alto" | "critico";
        /**
         * @description Equivale a modificar, retener, compartir o evitar el riesgo. «aceptar» exige responsable.
         * @enum {string}
         */
        DecisionTratamiento: "mitigar" | "aceptar" | "transferir" | "evitar";
        /** @enum {string} */
        EstadoRiesgo: "vigente" | "retirado";
        /**
         * @description Los motivos que se registran. El motivo «riesgo» no se escribe; se deriva de los riesgos vigentes.
         * @enum {string}
         */
        TipoMotivo: "legal" | "contractual" | "negocio" | "otro";
        /**
         * @description «analisis» es el documento de análisis de riesgos; «plan» es el plan de tratamiento.
         * @enum {string}
         */
        TipoReferencia: "analisis" | "plan";
        /**
         * @description «control» si lo trata un control vigente de la empresa; «previsto» si solo es un tratamiento previsto sin control propio.
         * @enum {string}
         */
        ViaRiesgo: "control" | "previsto";
        Riesgo: {
            /** Format: uuid */
            id: string;
            codigo: string;
            titulo: string;
            descripcion: string | null;
            probabilidad: number;
            impacto: number;
            /** @description Probabilidad por impacto. */
            puntaje: number;
            nivel: components["schemas"]["NivelRiesgo"];
            decision: components["schemas"]["DecisionTratamiento"];
            /** Format: uuid */
            responsableId: string | null;
            estado: components["schemas"]["EstadoRiesgo"];
            version: number;
        };
        RiesgoListado: {
            /** Format: uuid */
            id: string;
            codigo: string;
            titulo: string;
            descripcion: string | null;
            probabilidad: number;
            impacto: number;
            puntaje: number;
            nivel: components["schemas"]["NivelRiesgo"];
            decision: components["schemas"]["DecisionTratamiento"];
            /** Format: uuid */
            responsableId: string | null;
            estado: components["schemas"]["EstadoRiesgo"];
            version: number;
            /** @description Controles VIGENTES de la empresa que lo tratan. */
            controles: number;
            /** @description Controles del Anexo A vinculados directo. */
            tratamientosPrevistos: number;
            /** @description Está vigente */
            sinTratamiento: boolean;
        };
        ControlDeRiesgo: {
            /** Format: uuid */
            id: string;
            codigo: string;
            nombre: string;
            estado: components["schemas"]["EstadoControl"];
        };
        TratamientoPrevisto: {
            libreriaCodigo: string;
            idEstable: string;
            /** @description Nulo si la entrada ya no está entre las librerías adoptadas por la empresa. */
            titulo: string | null;
        };
        RiesgoDetalle: {
            /** Format: uuid */
            id: string;
            codigo: string;
            titulo: string;
            descripcion: string | null;
            probabilidad: number;
            impacto: number;
            puntaje: number;
            nivel: components["schemas"]["NivelRiesgo"];
            decision: components["schemas"]["DecisionTratamiento"];
            /** Format: uuid */
            responsableId: string | null;
            estado: components["schemas"]["EstadoRiesgo"];
            version: number;
            /** @description Controles de la empresa que lo tratan; los retirados se marcan y el vínculo se conserva. */
            controles: components["schemas"]["ControlDeRiesgo"][];
            tratamientosPrevistos: components["schemas"]["TratamientoPrevisto"][];
        };
        RiesgoEntrada: {
            titulo: string;
            descripcion?: string | null;
            probabilidad: number;
            impacto: number;
            decision: components["schemas"]["DecisionTratamiento"];
            /** Format: uuid */
            responsableId?: string | null;
        };
        RiesgoCambios: {
            versionEsperada: number;
            titulo?: string;
            descripcion?: string | null;
            probabilidad?: number;
            impacto?: number;
            decision?: components["schemas"]["DecisionTratamiento"];
            /** Format: uuid */
            responsableId?: string | null;
        };
        RiesgoVersion: {
            versionEsperada: number;
        };
        VinculoControlEntrada: {
            /** Format: uuid */
            controlId: string;
        };
        VinculoResultado: {
            /** @description Verdadero si se creó (201); falso si ya existía (200). */
            creado: boolean;
        };
        AvisoRetiroRiesgo: {
            /** Format: uuid */
            riesgoId: string;
            codigo: string;
            /** @description Controles del Anexo A que aplican y quedarían sin motivo al retirar el riesgo. Vacío si el retiro no deja nada sin motivo. */
            controlesSinMotivo: {
                libreriaCodigo: string;
                idEstable: string;
                titulo: string;
            }[];
        };
        MotivoDeclaracion: {
            libreriaCodigo: string;
            idEstable: string;
            tipo: components["schemas"]["TipoMotivo"];
            /** @description En palabras de la empresa; no debe llevar datos personales ni texto de las normas. */
            nota: string;
            version: number;
        };
        MotivoEntrada: {
            libreriaCodigo: string;
            idEstable: string;
            tipo: components["schemas"]["TipoMotivo"];
            nota: string;
            /** @description Ausente = crear; presente = la versión que la persona vio. */
            versionEsperada?: number;
        };
        MotivoQuitar: {
            libreriaCodigo: string;
            idEstable: string;
            tipo: components["schemas"]["TipoMotivo"];
            versionEsperada: number;
        };
        ReferenciaDeclaracion: {
            tipo: components["schemas"]["TipoReferencia"];
            titulo: string;
            versionDoc: string;
            /** Format: date */
            fecha: string;
            /** @description Dónde o con qué código conserva la empresa el documento. */
            ubicacion: string;
            version: number;
        };
        ReferenciaEntrada: {
            tipo: components["schemas"]["TipoReferencia"];
            titulo: string;
            versionDoc: string;
            /** Format: date */
            fecha: string;
            ubicacion: string;
            /** @description Ausente = crear; presente = la versión que la persona vio. */
            versionEsperada?: number;
        };
        ReferenciaQuitar: {
            tipo: components["schemas"]["TipoReferencia"];
            versionEsperada: number;
        };
        /** @description La escala de probabilidad e impacto (1 a escalaMax) y el primer puntaje de cada nivel. Es el método por omisión de la herramienta, no el criterio de aceptación de la empresa. */
        EscalaRiesgo: {
            escalaMax: number;
            corteMedio: number;
            corteAlto: number;
            corteCritico: number;
        };
        MotivoDeFila: {
            tipo: components["schemas"]["TipoMotivo"];
            nota: string;
        };
        RiesgoDeFila: {
            codigo: string;
            titulo: string;
            nivel: components["schemas"]["NivelRiesgo"];
            via: components["schemas"]["ViaRiesgo"];
        };
        FilaJustificacion: {
            libreriaCodigo: string;
            idEstable: string;
            /** @description Aplica y no tiene ningún riesgo ni motivo registrado; impide aprobar. */
            sinMotivo: boolean;
            motivos: components["schemas"]["MotivoDeFila"][];
            riesgos: components["schemas"]["RiesgoDeFila"][];
        };
        /** @enum {string} */
        BloqueoDeclaracion: "sin_filas" | "por_decidir" | "sin_motivo";
        /** @description Lo que justifica el borrador, derivado en vivo de los riesgos, los motivos y las referencias. */
        JustificacionBorrador: {
            /** @description Controles que aplican y tienen un riesgo derivado o un motivo registrado. */
            conMotivo: number;
            /** @description Controles que aplican y no tienen motivo; impiden aprobar. */
            sinMotivo: number;
            riesgosVigentes: number;
            /** @description Advertencia */
            riesgosSinTratamiento: number;
            /** @description Qué impide aprobar; vacío si se puede aprobar. */
            bloqueos: components["schemas"]["BloqueoDeclaracion"][];
            filas: components["schemas"]["FilaJustificacion"][];
            referencias: components["schemas"]["ReferenciaDeclaracion"][];
            escala: components["schemas"]["EscalaRiesgo"];
            /** @description Hay riesgos «mitigar» y no hay referencia al plan de tratamiento (advierte */
            faltaPlanTratamiento: boolean;
        };
        RiesgoCongelado: {
            codigo: string;
            titulo: string;
            probabilidad: number;
            impacto: number;
            nivel: components["schemas"]["NivelRiesgo"];
            decision: components["schemas"]["DecisionTratamiento"];
            /** Format: uuid */
            responsableId: string | null;
            /** @description Códigos de los controles vigentes de la empresa que lo trataban. */
            controles: string[];
        };
        /** @description Lo que justificaba la versión al aprobarla, tal como se congeló. Cambiar después un riesgo, un motivo o una referencia no la altera. Nula en las versiones aprobadas antes de la Declaración justificada (sin motivos ni riesgos). */
        JustificacionVersion: {
            escala: components["schemas"]["EscalaRiesgo"];
            conMotivo: number;
            riesgosVigentes: number;
            motivos: {
                libreriaCodigo: string;
                idEstable: string;
                tipo: components["schemas"]["TipoMotivo"];
                nota: string;
            }[];
            riesgos: components["schemas"]["RiesgoCongelado"][];
            riesgosPorFila: {
                libreriaCodigo: string;
                idEstable: string;
                riesgoCodigo: string;
                via: components["schemas"]["ViaRiesgo"];
            }[];
            referencias: {
                tipo: components["schemas"]["TipoReferencia"];
                titulo: string;
                versionDoc: string;
                /** Format: date */
                fecha: string;
                ubicacion: string;
            }[];
        } | null;
        /** @enum {string} */
        TipoDocumento: "politica" | "procedimiento" | "instructivo" | "formato" | "manual" | "externo" | "otro";
        /** @enum {string} */
        ClasificacionDocumento: "publica" | "interna" | "confidencial" | "restringida";
        /** @enum {string} */
        EstadoVersionDocumento: "borrador" | "en_revision" | "aprobada" | "obsoleta" | "descartada";
        /** @enum {string} */
        MotivoDevolucion: "incompleta" | "incorrecta" | "otro";
        /** @enum {string} */
        MotivoRevision: "periodica" | "auditoria" | "cambio_de_contexto";
        /** @enum {string} */
        EstadoRevision: "vencida" | "por_vencer" | "al_dia";
        /** @description «12 de 15»: solo cuentan las personas que siguen en la empresa. Es una constancia de conocimiento, no una capacitación. */
        LecturasDocumento: {
            confirmadas: number;
            total: number;
        };
        /** @description La clasificación es informativa: no limita quién lee (ADR 039). */
        Documento: {
            /** Format: uuid */
            id: string;
            codigo: string;
            tipo: components["schemas"]["TipoDocumento"];
            titulo: string;
            area: string | null;
            clasificacion: components["schemas"]["ClasificacionDocumento"];
            /** Format: uuid */
            responsableId: string;
            emisor: string | null;
            edicionFuente: string | null;
            /** @enum {string} */
            estado: "activo" | "retirado";
            /** Format: date */
            proximaRevision: string | null;
            revision: components["schemas"]["EstadoRevision"] | null;
            /** Format: date-time */
            ultimaRevisionEn: string | null;
            vigente: {
                /** Format: uuid */
                versionId: string;
                numero: number;
                /** Format: date-time */
                aprobadaEn: string;
            } | null;
            sinVigente: boolean;
            lecturas: components["schemas"]["LecturasDocumento"] | null;
            /** @description La persona que consulta tiene una lectura pendiente de la versión vigente. */
            lecturaPendiente: boolean;
            version: number;
        };
        ListaDocumentos: {
            /** Format: date */
            hoy: string;
            documentos: components["schemas"]["Documento"][];
        };
        VersionDocumento: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            documentoId: string;
            numero: number;
            estado: components["schemas"]["EstadoVersionDocumento"];
            vigente: boolean;
            nota: string;
            archivo: {
                nombre: string;
                tipo: string;
                bytes: number;
                sha256: string;
            };
            /** Format: uuid */
            autorId: string;
            /** Format: uuid */
            aprobadorId: string | null;
            /** Format: uuid */
            aprobadaPor: string | null;
            /** Format: date-time */
            aprobadaEn: string | null;
            /** @description Aprobada por su propio autor (único administrador): queda marcada en el historial. */
            porSuAutor: boolean;
            motivoExcepcion: string | null;
            requiereLectura: boolean;
            devueltaMotivo: components["schemas"]["MotivoDevolucion"] | null;
            devueltaNota: string | null;
            /** Format: date-time */
            obsoletaEn: string | null;
            /** @description Solo marca: el sistema no borra nada (ADR 039). */
            elegibleParaDisposicion: boolean;
            lecturas: components["schemas"]["LecturasDocumento"] | null;
            /** Format: date-time */
            creadaEn: string;
        };
        DocumentoDetalle: {
            /** Format: uuid */
            id: string;
            codigo: string;
            tipo: components["schemas"]["TipoDocumento"];
            titulo: string;
            area: string | null;
            clasificacion: components["schemas"]["ClasificacionDocumento"];
            /** Format: uuid */
            responsableId: string;
            emisor: string | null;
            edicionFuente: string | null;
            /** @enum {string} */
            estado: "activo" | "retirado";
            /** Format: date */
            proximaRevision: string | null;
            revision: components["schemas"]["EstadoRevision"] | null;
            /** Format: date-time */
            ultimaRevisionEn: string | null;
            vigente: {
                /** Format: uuid */
                versionId: string;
                numero: number;
                /** Format: date-time */
                aprobadaEn: string;
            } | null;
            sinVigente: boolean;
            lecturas: components["schemas"]["LecturasDocumento"] | null;
            /** @description La persona que consulta tiene una lectura pendiente de la versión vigente. */
            lecturaPendiente: boolean;
            version: number;
            versiones: components["schemas"]["VersionDocumento"][];
            destinatarios: string[];
            controles: string[];
            entradas: {
                libreriaCodigo: string;
                idEstable: string;
            }[];
            retencion: {
                anios: number;
                motivo: string;
            } | null;
            /** @description La empresa tiene un solo administrador activo: puede aprobar su propia versión con motivo. */
            unicoAdministrador: boolean;
        };
        /** @description Solo un documento de tipo «externo» lleva emisor y edición de la fuente. El código lo asigna el sistema. */
        DocumentoEntrada: {
            tipo: components["schemas"]["TipoDocumento"];
            titulo: string;
            area?: string;
            clasificacion: components["schemas"]["ClasificacionDocumento"];
            /** Format: uuid */
            responsableId: string;
            emisor?: string;
            edicionFuente?: string;
        };
        /** @description El tipo y el código no cambian. Lo ausente no se toca; `null` borra el área, el emisor o la edición. */
        DocumentoCambios: {
            titulo?: string;
            area?: string | null;
            clasificacion?: components["schemas"]["ClasificacionDocumento"];
            /** Format: uuid */
            responsableId?: string;
            emisor?: string | null;
            edicionFuente?: string | null;
            versionEsperada: number;
        };
        /** @description Revisado sin cambios. Sin fecha, un año después de hoy. */
        RevisionDocumento: {
            motivo?: components["schemas"]["MotivoRevision"];
            /** Format: date */
            proximaRevision?: string;
        };
        /** @description Personas y/o «todas las personas de un rol»: el rol se resuelve en este momento y no se guarda. */
        DistribucionEntrada: {
            usuarioIds?: string[];
            roles?: string[];
        };
        Distribucion: {
            destinatarios: string[];
        };
        /** @description Un control de la empresa (`controlId`) o una entrada de una librería adoptada (`libreriaCodigo` e `idEstable`), no ambos. */
        VinculoDocumentoEntrada: {
            /** Format: uuid */
            controlId?: string;
            libreriaCodigo?: string;
            idEstable?: string;
        };
        VinculoDocumentoResultado: {
            creado: boolean;
        };
        /** @description La nota va antes del archivo. */
        VersionSubida: {
            nota: string;
            /** Format: binary */
            archivo: string;
        };
        /** @description Una persona activa con permiso de aprobar, distinta del autor (salvo el único administrador). */
        EnvioRevision: {
            /** Format: uuid */
            aprobadorId: string;
        };
        DevolucionVersion: {
            motivo: components["schemas"]["MotivoDevolucion"];
            nota?: string;
        };
        /** @description `motivoExcepcion` solo aplica al único administrador que aprueba su propia versión y es obligatorio entonces. */
        AprobacionVersion: {
            /** Format: date */
            proximaRevision?: string;
            requiereLectura?: boolean;
            motivoExcepcion?: string;
        };
        LecturaPendiente: {
            /** Format: uuid */
            versionId: string;
            /** Format: uuid */
            documentoId: string;
            codigo: string;
            titulo: string;
            numeroVersion: number;
        };
        /** @description Informativa: no bloquea nada. Solo cuenta documentos con versión vigente. */
        CoberturaDocumental: {
            normas: string[];
            total: number;
            cubiertas: number;
            entradas: {
                libreriaCodigo: string;
                idEstable: string;
                /** @enum {string} */
                tipo: "clausula" | "control";
                titulo: string;
                normas: string[];
                documentos: {
                    /** Format: uuid */
                    id: string;
                    codigo: string;
                }[];
                cubierta: boolean;
            }[];
        };
        Retencion: {
            tipo: components["schemas"]["TipoDocumento"];
            anios: number;
            motivo: string;
            version: number;
        };
        /** @description Sin `versionEsperada` crea; con ella cambia (409 si otra persona cambió antes). */
        RetencionEntrada: {
            tipo: components["schemas"]["TipoDocumento"];
            anios: number;
            motivo: string;
            versionEsperada?: number;
        };
        /** @description Solo para mostrar responsables y elegir a quién enviar una versión a revisión: sin correo ni rol. */
        PersonaDirectorio: {
            /** Format: uuid */
            id: string;
            nombre: string;
            activa: boolean;
            /** @description Es una persona activa con permiso de aprobar documentos. */
            puedeAprobar: boolean;
        };
        /** @enum {string} */
        ImportanciaProceso: "alta" | "media" | "baja";
        /**
         * @description Cada cuánto conviene auditar el proceso (ayuda para armar el programa).
         * @enum {string}
         */
        FrecuenciaProceso: "semestral" | "anual" | "cada_dos_anios" | "cada_tres_anios";
        /**
         * @description Marca manual del administrador: el proceso cambió o tuvo un incidente.
         * @enum {string}
         */
        CambioRelevanteProceso: "cambio" | "incidente";
        /**
         * @description Relación de una persona con un proceso: quien la tiene no puede auditarlo.
         * @enum {string}
         */
        TipoRelacionProceso: "duena" | "participa" | "diseno" | "supervisa";
        /** @enum {string} */
        AvisoProceso: "sin_relaciones" | "duena_inactiva";
        ProcesoEntrada: {
            nombre: string;
            descripcion?: string | null;
            /**
             * Format: uuid
             * @description Persona activa de la empresa.
             */
            duenaId: string;
            importancia?: components["schemas"]["ImportanciaProceso"];
            frecuencia?: components["schemas"]["FrecuenciaProceso"];
        };
        ProcesoCambios: {
            versionEsperada: number;
            nombre?: string;
            descripcion?: string | null;
            /** Format: uuid */
            duenaId?: string;
            importancia?: components["schemas"]["ImportanciaProceso"];
            frecuencia?: components["schemas"]["FrecuenciaProceso"];
            /** @description Nulo quita la marca. */
            cambioRelevante?: components["schemas"]["CambioRelevanteProceso"] | null;
        };
        Proceso: {
            /** Format: uuid */
            id: string;
            codigo: string;
            nombre: string;
            descripcion: string | null;
            /** Format: uuid */
            duenaId: string;
            importancia: components["schemas"]["ImportanciaProceso"];
            frecuencia: components["schemas"]["FrecuenciaProceso"];
            /** @description «Gestión del SIG»: entra al alcance de toda auditoría que cubra las cláusulas 4 a 10. */
            transversal: boolean;
            cambioRelevante: components["schemas"]["CambioRelevanteProceso"] | null;
            /** @enum {string} */
            estado: "vigente" | "retirado";
            version: number;
            personasRelacionadas: number;
            avisos: components["schemas"]["AvisoProceso"][];
        };
        ListaProcesos: {
            procesos: components["schemas"]["Proceso"][];
            /** @description Ya hay un proceso «Gestión del SIG» vigente (si no, la pantalla ofrece crearlo). */
            gestionSigVigente: boolean;
        };
        RelacionEntrada: {
            /**
             * Format: uuid
             * @description Persona activa de la empresa.
             */
            personaId: string;
            relacion: components["schemas"]["TipoRelacionProceso"];
        };
        RelacionProceso: {
            /** Format: uuid */
            procesoId: string;
            /** Format: uuid */
            personaId: string;
            relacion: components["schemas"]["TipoRelacionProceso"];
        };
        ListaRelaciones: {
            relaciones: components["schemas"]["RelacionProceso"][];
        };
        /** @enum {string} */
        EstadoPrograma: "sin_aprobar" | "aprobado";
        /** @enum {string} */
        EstadoAuditoria: "planificada" | "en_preparacion" | "en_ejecucion" | "informe_emitido" | "cerrada" | "cancelada";
        ProgramaEntrada: {
            anio: number;
            objetivo: string;
            /** @description Códigos de librerías que la empresa adoptó. */
            normas: string[];
        };
        ProgramaCambios: {
            versionEsperada: number;
            objetivo?: string;
            normas?: string[];
        };
        ProgramaVersion: {
            versionEsperada: number;
        };
        Programa: {
            /** Format: uuid */
            id: string;
            anio: number;
            objetivo: string;
            estado: components["schemas"]["EstadoPrograma"];
            aprobadoPor: string | null;
            aprobadoEn: string | null;
            version: number;
            normas: string[];
        };
        ListaProgramas: {
            programas: components["schemas"]["Programa"][];
        };
        ExclusionEntrada: {
            /** @enum {string} */
            tipo: "proceso" | "capitulo";
            /**
             * Format: uuid
             * @description Solo con tipo «proceso».
             */
            procesoId?: string;
            /** @description Solo con tipo «capitulo»: una de las normas del programa. */
            libreriaCodigo?: string;
            /** @description Solo con tipo «capitulo»: capítulo (`9`) o tema del Anexo A. */
            capitulo?: string;
            motivo: string;
        };
        ExclusionQuitar: {
            /** Format: uuid */
            exclusionId: string;
        };
        ExclusionPrograma: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            tipo: "proceso" | "capitulo";
            procesoId: string | null;
            libreriaCodigo: string | null;
            capitulo: string | null;
            motivo: string;
        };
        AuditoriaDePrograma: {
            /** Format: uuid */
            id: string;
            codigo: string;
            objetivo: string;
            estado: components["schemas"]["EstadoAuditoria"];
            /** Format: date */
            inicio: string;
            /** Format: date */
            fin: string;
            trimestre: number;
            normas: string[];
            /** @description Los criterios abarcan más de una norma. */
            combinada: boolean;
            procesosIds: string[];
            liderId: string | null;
        };
        ProcesoDePrograma: {
            /** Format: uuid */
            procesoId: string;
            codigo: string;
            nombre: string;
            importancia: components["schemas"]["ImportanciaProceso"];
            frecuencia: components["schemas"]["FrecuenciaProceso"];
            cambioRelevante: components["schemas"]["CambioRelevanteProceso"] | null;
            /** @description Fin de la última auditoría cerrada que incluyó el proceso. */
            ultimaAuditoria: string | null;
            hallazgosAbiertos: number;
            /** @description Alguna auditoría no cancelada del programa lo incluye. */
            incluido: boolean;
        };
        PendientesPrograma: {
            /** @description Procesos vigentes que ninguna auditoría incluye y que no tienen motivo. */
            procesos: string[];
            capitulos: {
                libreriaCodigo: string;
                capitulo: string;
            }[];
            procesosIncluidos: number;
            capitulosIncluidos: number;
        };
        DetallePrograma: {
            programa: components["schemas"]["Programa"];
            auditorias: components["schemas"]["AuditoriaDePrograma"][];
            exclusiones: components["schemas"]["ExclusionPrograma"][];
            procesos: components["schemas"]["ProcesoDePrograma"][];
            pendientes: components["schemas"]["PendientesPrograma"];
        };
        /**
         * @description Con «otro» la nota es obligatoria.
         * @enum {string}
         */
        MotivoCambioAuditoria: "sin_recursos" | "cambio_de_alcance" | "reprogramada" | "otro";
        CapituloAlcance: {
            libreriaCodigo: string;
            capitulo: string;
        };
        AuditoriaEntrada: {
            objetivo: string;
            /** Format: date */
            inicio: string;
            /** Format: date */
            fin: string;
            /** Format: date */
            reunionApertura?: string;
            /** Format: date */
            reunionCierre?: string;
            normas: string[];
            procesosIds?: string[];
            /** @description Si se omite para una norma, la auditoría cubre todos sus capítulos y temas. */
            capitulos?: components["schemas"]["CapituloAlcance"][];
            /** @description Obligatorio si el programa está aprobado. */
            motivo?: components["schemas"]["MotivoCambioAuditoria"];
            nota?: string;
        };
        AuditoriaCambios: {
            versionEsperada: number;
            objetivo?: string;
            /** Format: date */
            inicio?: string;
            /** Format: date */
            fin?: string;
            reunionApertura?: string | null;
            reunionCierre?: string | null;
            normas?: string[];
            procesosIds?: string[];
            /** @description Si se omite para una norma, la auditoría cubre todos sus capítulos y temas. */
            capitulos?: components["schemas"]["CapituloAlcance"][];
        };
        AuditoriaReprogramacion: {
            versionEsperada: number;
            /** Format: date */
            inicio: string;
            /** Format: date */
            fin: string;
            reunionApertura?: string | null;
            reunionCierre?: string | null;
            motivo: components["schemas"]["MotivoCambioAuditoria"];
            nota?: string;
        };
        AuditoriaCancelacion: {
            versionEsperada: number;
            motivo: components["schemas"]["MotivoCambioAuditoria"];
            nota?: string;
        };
        AuditoriaAvance: {
            versionEsperada: number;
            /** @enum {string} */
            estado: "en_preparacion" | "en_ejecucion";
        };
        /** @description Excepción de independencia: texto de la empresa; no va a la bitácora. */
        ExcepcionEntrada: {
            motivo: string;
            /** @description Medida compensatoria, por ejemplo que otra persona revise el informe. */
            medida: string;
        };
        MiembroEntrada: {
            /** Format: uuid */
            personaId: string;
            /** @enum {string} */
            rol: "lider" | "auditor";
            excepcion?: components["schemas"]["ExcepcionEntrada"];
        };
        MiembroQuitar: {
            /** Format: uuid */
            personaId: string;
        };
        MiembroEquipo: {
            /** Format: uuid */
            personaId: string;
            /** @enum {string} */
            rol: "lider" | "auditor";
            excepcion: boolean;
            autoautorizada: boolean;
            excepcionMotivo: string | null;
            excepcionMedida: string | null;
            excepcionAutorizadaPor: string | null;
        };
        Auditoria: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            programaId: string;
            codigo: string;
            anio: number;
            objetivo: string;
            estado: components["schemas"]["EstadoAuditoria"];
            /** Format: date */
            inicio: string;
            /** Format: date */
            fin: string;
            reunionApertura: string | null;
            reunionCierre: string | null;
            reprogramaciones: number;
            cancelacionMotivo: components["schemas"]["MotivoCambioAuditoria"] | null;
            informeEmitidoEn: string | null;
            cerradaEn: string | null;
            version: number;
            normas: string[];
            combinada: boolean;
            procesosIds: string[];
            /** @description Los procesos elegidos más «Gestión del SIG» cuando se cubren las cláusulas 4 a 10. */
            procesosDelAlcance: string[];
            capitulos: components["schemas"]["CapituloAlcance"][];
            equipo: components["schemas"]["MiembroEquipo"][];
        };
        Independencia: {
            /** Format: uuid */
            personaId: string;
            /** @description Falso si tiene relación con algún proceso del alcance: solo se designa con una excepción. */
            independiente: boolean;
            conflictos: {
                /** Format: uuid */
                procesoId: string;
                relaciones: components["schemas"]["TipoRelacionProceso"][];
            }[];
            avisos: {
                /** Format: uuid */
                procesoId: string;
                /** Format: date */
                ultimaFecha: string;
            }[];
            procesosDelAlcance: string[];
        };
        /** @enum {string} */
        ResultadoItem: "por_evaluar" | "conforme" | "no_conforme" | "observacion" | "oportunidad" | "no_aplica" | "no_verificado";
        /**
         * @description Solo la no conformidad (mayor o menor) es un incumplimiento.
         * @enum {string}
         */
        TipoHallazgo: "nc_mayor" | "nc_menor" | "observacion" | "oportunidad";
        /** @enum {string} */
        MotivoAnulacionHallazgo: "duplicado" | "error_de_registro" | "otro";
        PreguntaLista: {
            /** Format: uuid */
            id: string;
            texto: string;
        };
        FilaLista: {
            /** Format: uuid */
            id: string;
            libreriaCodigo: string;
            idEstable: string;
            titulo: string | null;
            guia: string | null;
            agrupador: string | null;
            resultado: components["schemas"]["ResultadoItem"];
            nota: string | null;
            version: number;
            evaluadoPor: string | null;
            evaluadoEn: string | null;
            diagnostico: components["schemas"]["EstadoEvaluacion"] | null;
            preguntas: components["schemas"]["PreguntaLista"][];
        };
        ListaVerificacion: {
            /** Format: uuid */
            auditoriaId: string;
            filas: components["schemas"]["FilaLista"][];
            avance: {
                total: number;
                evaluadas: number;
                porResultado: {
                    por_evaluar: number;
                    conforme: number;
                    no_conforme: number;
                    observacion: number;
                    oportunidad: number;
                    no_aplica: number;
                    no_verificado: number;
                };
            };
        };
        RegeneracionLista: {
            total: number;
            agregadas: number;
            quitadas: number;
            conservadas: number;
            conservadasFueraDeAlcance: number;
        };
        ResultadoFilaEntrada: {
            /** Format: uuid */
            filaId: string;
            versionEsperada: number;
            /** @enum {string} */
            resultado: "conforme" | "no_conforme" | "observacion" | "oportunidad" | "no_aplica" | "no_verificado";
            nota?: string;
        };
        PreguntaEntrada: {
            /** Format: uuid */
            filaId: string;
            texto: string;
        };
        PreguntaQuitar: {
            /** Format: uuid */
            preguntaId: string;
        };
        Hallazgo: {
            /** Format: uuid */
            id: string;
            codigo: string;
            itemId: string | null;
            tipo: components["schemas"]["TipoHallazgo"];
            procesoId: string | null;
            libreriaCodigo: string | null;
            idEstable: string | null;
            enunciado: string;
            evidencia: string;
            justificacionGravedad: string | null;
            /** @enum {string} */
            estado: "abierto" | "anulado";
            anulacionMotivo: components["schemas"]["MotivoAnulacionHallazgo"] | null;
            /** Format: uuid */
            registradoPor: string;
            version: number;
        };
        ListaHallazgos: {
            hallazgos: components["schemas"]["Hallazgo"][];
            abiertos: {
                nc_mayor: number;
                nc_menor: number;
                observacion: number;
                oportunidad: number;
            };
        };
        HallazgoEntrada: {
            tipo: components["schemas"]["TipoHallazgo"];
            /**
             * Format: uuid
             * @description Fila de la lista de la que sale; de ella se toma el requisito.
             */
            itemId?: string;
            /** Format: uuid */
            procesoId?: string;
            libreriaCodigo?: string;
            idEstable?: string;
            enunciado: string;
            evidencia: string;
            /** @description Obligatoria en una NC mayor y solo en ella. */
            justificacionGravedad?: string;
        };
        HallazgoCambios: {
            /** Format: uuid */
            hallazgoId: string;
            versionEsperada: number;
            tipo?: components["schemas"]["TipoHallazgo"];
            procesoId?: string | null;
            libreriaCodigo?: string | null;
            idEstable?: string | null;
            enunciado?: string;
            evidencia?: string;
            justificacionGravedad?: string | null;
        };
        HallazgoAnulacion: {
            /** Format: uuid */
            hallazgoId: string;
            versionEsperada: number;
            motivo: components["schemas"]["MotivoAnulacionHallazgo"];
        };
        InformeEntrada: {
            versionEsperada: number;
            /** @description Conclusión del equipo en palabras propias. */
            conclusion: string;
            /** @description Qué no se verificó y por qué. */
            limitaciones?: string;
        };
        /** @description Copia congelada e inmutable del informe. Puede contener datos personales de un texto libre sin vía de rectificación (ADR 028). */
        InformeContenido: {
            version: number;
            auditoria: {
                codigo: string;
                anio: number;
                objetivo: string;
                /** Format: date */
                inicio: string;
                /** Format: date */
                fin: string;
                reunionApertura: string | null;
                reunionCierre: string | null;
                combinada: boolean;
                normas: string[];
                capitulos: components["schemas"]["CapituloAlcance"][];
                procesos: {
                    codigo: string;
                    nombre: string;
                    transversal: boolean;
                }[];
            };
            programa: {
                anio: number;
                objetivo: string;
            };
            equipo: {
                /** Format: uuid */
                personaId: string;
                nombre: string;
                /** @enum {string} */
                rol: "lider" | "auditor";
                excepcion: boolean;
                autoautorizada: boolean;
                excepcionMotivo: string | null;
                excepcionMedida: string | null;
            }[];
            conteos: {
                por_evaluar: number;
                conforme: number;
                no_conforme: number;
                observacion: number;
                oportunidad: number;
                no_aplica: number;
                no_verificado: number;
                total: number;
                cubiertas: number;
            };
            filas: {
                libreriaCodigo: string;
                idEstable: string;
                titulo: string | null;
                resultado: components["schemas"]["ResultadoItem"];
                nota: string | null;
            }[];
            noVerificadas: {
                libreriaCodigo: string;
                idEstable: string;
                nota: string | null;
            }[];
            hallazgos: {
                codigo: string;
                tipo: components["schemas"]["TipoHallazgo"];
                proceso: string | null;
                requisito: string | null;
                enunciado: string;
                evidencia: string;
                justificacionGravedad: string | null;
                /** @enum {string} */
                estado: "abierto" | "anulado";
            }[];
            conclusion: string;
            limitaciones: string | null;
            emitidoPor: {
                /** Format: uuid */
                personaId: string;
                nombre: string;
            };
            /** Format: date-time */
            emitidoEn: string;
        };
        InformeAuditoria: {
            /** Format: uuid */
            auditoriaId: string;
            codigo: string;
            /** @description SHA-256 de la copia congelada. */
            huella: string;
            /** Format: uuid */
            emitidoPor: string;
            /** Format: date-time */
            emitidoEn: string;
            contenido: components["schemas"]["InformeContenido"];
        };
        CierreEntrada: {
            versionEsperada: number;
        };
        CierreAuditoria: {
            /** Format: uuid */
            id: string;
            codigo: string;
            estado: components["schemas"]["EstadoAuditoria"];
            /** Format: date-time */
            cerradaEn: string;
            version: number;
        };
        PanelAuditoria: {
            programaAnio: number | null;
            prerrequisito: {
                /** @description Solo informa: este módulo no decide la etapa. */
                cumple: boolean;
                auditoriasCerradas: number;
                brechas: {
                    clausulas: string[];
                    procesos: string[];
                    controles: string[];
                    /** @description Todavía no hay una Declaración de Aplicabilidad aprobada. */
                    sinDeclaracion: boolean;
                };
            };
            cobertura12Meses: {
                clausulas: {
                    total: number;
                    cubiertas: number;
                };
                controles: {
                    total: number;
                    cubiertos: number;
                    sinDeclaracion: boolean;
                };
                procesos: {
                    total: number;
                    cubiertos: number;
                };
            };
            auditorias: {
                total: number;
                cerradas: number;
                porEstado: {
                    planificada: number;
                    en_preparacion: number;
                    en_ejecucion: number;
                    informe_emitido: number;
                    cerrada: number;
                    cancelada: number;
                };
            };
        };
    };
    responses: {
        /** @description Falta el token, está vencido, alterado o no trae empresa. */
        NoAutenticado: {
            headers: {
                "Cache-Control": components["headers"]["CacheControlNoStore"];
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "about:blank",
                 *       "title": "No autenticado",
                 *       "status": 401,
                 *       "codigo": "no_autenticado"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problema"];
            };
        };
        /** @description La persona no tiene permiso para esta acción. */
        SinPermiso: {
            headers: {
                "Cache-Control": components["headers"]["CacheControlNoStore"];
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "about:blank",
                 *       "title": "Sin permiso",
                 *       "status": 403,
                 *       "codigo": "sin_permiso"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problema"];
            };
        };
        /**
         * @description El recurso no se puede ver. En el detalle de una entrada: no existe, es de otra empresa o pertenece a una librería que la
         *     empresa no adoptó; en la adopción: la librería no existe. Los casos son indistinguibles: misma respuesta, mismo cuerpo,
         *     mismas cabeceras.
         */
        NoEncontrado: {
            headers: {
                "Cache-Control": components["headers"]["CacheControlNoStore"];
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "about:blank",
                 *       "title": "No encontrado",
                 *       "status": 404,
                 *       "codigo": "no_encontrado"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problema"];
            };
        };
        /** @description Un parámetro no cumple el formato o los límites indicados. No se repite el valor recibido. */
        ParametrosInvalidos: {
            headers: {
                "Cache-Control": components["headers"]["CacheControlNoStore"];
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "about:blank",
                 *       "title": "Parámetros no válidos",
                 *       "status": 400,
                 *       "codigo": "parametro_invalido"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problema"];
            };
        };
        /** @description Demasiadas solicitudes en poco tiempo. Se puede reintentar después de `Retry-After` segundos. */
        LimiteExcedido: {
            headers: {
                "Cache-Control": components["headers"]["CacheControlNoStore"];
                "Retry-After": components["headers"]["RetryAfter"];
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "about:blank",
                 *       "title": "Límite de solicitudes excedido",
                 *       "status": 429,
                 *       "codigo": "limite_excedido"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problema"];
            };
        };
        /** @description El estado actual no permite la acción (alcance ya aprobado) o otra persona cambió la evaluación mientras se editaba. */
        Conflicto: {
            headers: {
                "Cache-Control": components["headers"]["CacheControlNoStore"];
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "about:blank",
                 *       "title": "Conflicto",
                 *       "status": 409,
                 *       "codigo": "conflicto"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problema"];
            };
        };
        /** @description El archivo pasa de 25 MB. No se guarda nada y el rechazo queda en la bitácora. */
        ArchivoDemasiadoGrande: {
            headers: {
                "Cache-Control": components["headers"]["CacheControlNoStore"];
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "about:blank",
                 *       "title": "Archivo demasiado grande",
                 *       "status": 413,
                 *       "codigo": "archivo_demasiado_grande"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problema"];
            };
        };
        /** @description El archivo de la librería pasa de 1 MB. No se lee ni se guarda nada. */
        LibreriaDemasiadoGrande: {
            headers: {
                "Cache-Control": components["headers"]["CacheControlNoStore"];
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "about:blank",
                 *       "title": "Archivo demasiado grande",
                 *       "status": 413,
                 *       "codigo": "archivo_demasiado_grande"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problema"];
            };
        };
        /**
         * @description El contenido del archivo no es de un tipo permitido o está dañado (PDF, PNG, JPEG, TXT, DOCX, XLSX o PPTX; sin macros, SVG ni HTML).
         *     El tipo se decide por el contenido, no por la extensión. No se guarda nada y el rechazo queda en la bitácora.
         */
        TipoNoPermitido: {
            headers: {
                "Cache-Control": components["headers"]["CacheControlNoStore"];
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "about:blank",
                 *       "title": "Tipo de archivo no permitido",
                 *       "status": 415,
                 *       "codigo": "tipo_no_permitido"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problema"];
            };
        };
        /** @description Error interno. Si falla el registro en la bitácora de una acción, la acción no se completa y se responde con este error. */
        ErrorInterno: {
            headers: {
                "Cache-Control": components["headers"]["CacheControlNoStore"];
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "about:blank",
                 *       "title": "Error interno",
                 *       "status": 500,
                 *       "codigo": "error_interno"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problema"];
            };
        };
    };
    parameters: {
        /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
        IdRuta: string;
    };
    requestBodies: never;
    headers: {
        /** @description Las respuestas autenticadas no se guardan en caché (al volver con «atrás» no se muestran datos de una sesión cerrada). */
        CacheControlNoStore: "no-store";
        /** @description Segundos que hay que esperar antes de volver a intentarlo. */
        RetryAfter: number;
    };
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    comprobarSalud: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description La API responde. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Salud"];
                };
            };
        };
    };
    obtenerIdentidad: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Identidad de la persona. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Identidad"];
                };
            };
            401: components["responses"]["NoAutenticado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    listarMisEmpresas: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Las empresas de la persona. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmpresaDePersona"][];
                };
            };
            401: components["responses"]["NoAutenticado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    cambiarEmpresa: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EmpresaElegida"];
            };
        };
        responses: {
            /** @description La empresa activa de la sesión es ahora la pedida. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmpresaActual"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            404: components["responses"]["NoEncontrado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    obtenerMarcaEmpresa: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Marca de la empresa. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Marca"];
                };
            };
            401: components["responses"]["NoAutenticado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    actualizarMarcaEmpresa: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MarcaEdicion"];
            };
        };
        responses: {
            /** @description La marca vigente después del cambio. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Marca"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    registrarInicioSesion: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Inicio de sesión registrado. */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["NoAutenticado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    registrarCierreSesion: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Cierre de sesión registrado. */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["NoAutenticado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    listarLibrerias: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Librerías del catálogo. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LibreriaResumen"][];
                };
            };
            401: components["responses"]["NoAutenticado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    cargarLibreria: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["LibreriaSubida"];
            };
        };
        responses: {
            /** @description Ya estaba cargada (mismo contenido) o el archivo se rechazó; ver `estado`. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CargaLibreria"];
                };
            };
            /** @description La librería se cargó ahora. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CargaLibreria"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            413: components["responses"]["LibreriaDemasiadoGrande"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    adoptarLibreria: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description La librería ya estaba adoptada; no hubo cambios. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Adopcion"];
                };
            };
            /** @description Librería adoptada ahora. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Adopcion"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    listarRequisitos: {
        parameters: {
            query?: {
                /** @description Texto a buscar en el identificador o el título. */
                q?: string;
                /** @description Capítulo de la Estructura Armonizada (4 a 10). */
                capitulo?: number;
                /** @description Norma a la que aplica la entrada, por ejemplo «ISO 9001». */
                norma?: string;
                /** @description Cláusulas (capítulos 4 a 10) o controles del Anexo A. */
                tipo?: "clausula" | "control";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Entradas que cumplen el filtro. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EntradaLibreria"][];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    obtenerRequisito: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description La entrada. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EntradaLibreria"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            404: components["responses"]["NoEncontrado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    listarAlcances: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Alcances de la empresa. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Alcance"][];
                };
            };
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    guardarAlcance: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AlcanceEntrada"];
            };
        };
        responses: {
            /** @description El alcance guardado. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Alcance"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    aprobarAlcance: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AlcanceNorma"];
            };
        };
        responses: {
            /** @description El alcance aprobado. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Alcance"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    obtenerDiagnostico: {
        parameters: {
            query?: {
                q?: string;
                norma?: string;
                tipo?: "clausula" | "control";
                estado?: "cumple" | "parcial" | "no_cumple" | "no_aplica" | "sin_evaluar";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description El diagnóstico. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Diagnostico"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    evaluarEntrada: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EvaluacionEntrada"];
            };
        };
        responses: {
            /** @description La evaluación guardada (o la vigente si no hubo cambios). */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Evaluacion"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    solicitarAcceso: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Ya había una solicitud vigente; es la misma. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SolicitudAcceso"];
                };
            };
            /** @description La solicitud creada. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SolicitudAcceso"];
                };
            };
            401: components["responses"]["NoAutenticado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    listarPersonas: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Las personas y las solicitudes vigentes. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Personas"];
                };
            };
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    aprobarSolicitudAcceso: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AprobacionSolicitud"];
            };
        };
        responses: {
            /** @description La persona con acceso. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Persona"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    descartarSolicitudAcceso: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description La solicitud se descartó. */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    cambiarRolPersona: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CambioDeRol"];
            };
        };
        responses: {
            /** @description La persona con su rol vigente. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Persona"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    darDeBajaPersona: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PersonaVersion"];
            };
        };
        responses: {
            /** @description La persona dada de baja. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Persona"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    listarControles: {
        parameters: {
            query?: {
                /** @description Solo los controles que alcanzan esta norma. */
                norma?: string;
                incluirRetirados?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description El marco de controles. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MarcoControles"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    crearControl: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ControlEntrada"];
            };
        };
        responses: {
            /** @description El control creado. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Control"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    cambiarControl: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ControlCambios"];
            };
        };
        responses: {
            /** @description El control con los cambios, o tal como estaba si no hubo cambios. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Control"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    retirarControl: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ControlVersion"];
            };
        };
        responses: {
            /** @description El control retirado. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Control"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    agregarMapeo: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MapeoEntrada"];
            };
        };
        responses: {
            /** @description El mapeo ya existía; no hubo cambios. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MapeoResultado"];
                };
            };
            /** @description El mapeo creado. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MapeoResultado"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    quitarMapeo: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MapeoEntrada"];
            };
        };
        responses: {
            /** @description El mapeo se quitó. */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    listarEvidencias: {
        parameters: {
            query?: {
                incluirHistoricas?: boolean;
            };
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Las evidencias del control. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Evidencia"][];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    subirEvidencia: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["EvidenciaSubida"];
            };
        };
        responses: {
            /** @description La evidencia creada. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Evidencia"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            413: components["responses"]["ArchivoDemasiadoGrande"];
            415: components["responses"]["TipoNoPermitido"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    reemplazarEvidencia: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["EvidenciaReemplazo"];
            };
        };
        responses: {
            /** @description La evidencia nueva. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Evidencia"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            413: components["responses"]["ArchivoDemasiadoGrande"];
            415: components["responses"]["TipoNoPermitido"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    eliminarEvidencia: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description La evidencia se eliminó. */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    descargarEvidencia: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description El archivo, como adjunto. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    /** @description Siempre `attachment`, con el nombre normalizado y la extensión del tipo detectado. */
                    "Content-Disposition"?: string;
                    "X-Content-Type-Options"?: "nosniff";
                    [name: string]: unknown;
                };
                content: {
                    "application/pdf": string;
                    "image/png": string;
                    "image/jpeg": string;
                    "text/plain": string;
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": string;
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": string;
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation": string;
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    obtenerCobertura: {
        parameters: {
            query?: {
                /** @description Solo las entradas que aplican a esta norma. */
                norma?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description La cobertura. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Cobertura"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    obtenerDeclaracion: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description El borrador derivado con lo que hay hoy. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Declaracion"];
                };
            };
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    aprobarDeclaracion: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description La versión aprobada. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VersionDeclaracion"];
                };
            };
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    listarVersionesDeclaracion: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Las versiones aprobadas. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VersionDeclaracion"][];
                };
            };
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    obtenerVersionDeclaracion: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description La versión con sus filas. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VersionDeclaracionConFilas"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    exportarBorradorDeclaracion: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description El documento Word, como adjunto. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    /** @description Siempre `attachment`, con un nombre fijado por el servidor. */
                    "Content-Disposition"?: string;
                    "X-Content-Type-Options"?: "nosniff";
                    [name: string]: unknown;
                };
                content: {
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": string;
                };
            };
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    exportarVersionDeclaracion: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description El documento Word, como adjunto. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    /** @description Siempre `attachment`, con un nombre fijado por el servidor. */
                    "Content-Disposition"?: string;
                    "X-Content-Type-Options"?: "nosniff";
                    [name: string]: unknown;
                };
                content: {
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": string;
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    listarRiesgos: {
        parameters: {
            query?: {
                incluirRetirados?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Los riesgos de la empresa. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RiesgoListado"][];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    crearRiesgo: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RiesgoEntrada"];
            };
        };
        responses: {
            /** @description El riesgo creado. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Riesgo"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    obtenerRiesgo: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description El riesgo con sus vínculos. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RiesgoDetalle"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    cambiarRiesgo: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RiesgoCambios"];
            };
        };
        responses: {
            /** @description El riesgo con los cambios, o tal como estaba si no hubo cambios. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Riesgo"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    avisarRetiroRiesgo: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description El aviso previo al retiro. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AvisoRetiroRiesgo"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    retirarRiesgo: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RiesgoVersion"];
            };
        };
        responses: {
            /** @description El riesgo retirado. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Riesgo"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    vincularRiesgoControl: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VinculoControlEntrada"];
            };
        };
        responses: {
            /** @description El vínculo ya existía; no hubo cambios. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VinculoResultado"];
                };
            };
            /** @description El vínculo creado. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VinculoResultado"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    desvincularRiesgoControl: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VinculoControlEntrada"];
            };
        };
        responses: {
            /** @description El vínculo se quitó. */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    preverTratamientoRiesgo: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MapeoEntrada"];
            };
        };
        responses: {
            /** @description El tratamiento ya estaba previsto; no hubo cambios. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MapeoResultado"];
                };
            };
            /** @description El tratamiento previsto. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MapeoResultado"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    quitarTratamientoPrevisto: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MapeoEntrada"];
            };
        };
        responses: {
            /** @description El tratamiento previsto se quitó. */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    listarRiesgosDeControl: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Los riesgos vigentes que trata el control. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Riesgo"][];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    listarMotivosDeclaracion: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Los motivos registrados. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MotivoDeclaracion"][];
                };
            };
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    registrarMotivoDeclaracion: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MotivoEntrada"];
            };
        };
        responses: {
            /** @description El motivo creado o cambiado, o tal como estaba si no hubo cambios. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MotivoDeclaracion"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    quitarMotivoDeclaracion: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MotivoQuitar"];
            };
        };
        responses: {
            /** @description El motivo se quitó. */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    listarReferenciasDeclaracion: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Las referencias. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReferenciaDeclaracion"][];
                };
            };
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    guardarReferenciaDeclaracion: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReferenciaEntrada"];
            };
        };
        responses: {
            /** @description La referencia creada o cambiada, o tal como estaba si no hubo cambios. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReferenciaDeclaracion"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    quitarReferenciaDeclaracion: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReferenciaQuitar"];
            };
        };
        responses: {
            /** @description La referencia se quitó. */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    listarDocumentos: {
        parameters: {
            query?: {
                tipo?: components["schemas"]["TipoDocumento"];
                estado?: "activo" | "retirado";
                responsableId?: string;
                /** @description Texto contenido en el área o proceso. */
                area?: string;
                /** @description Solo documentos ligados a entradas de esta norma. */
                norma?: string;
                sinVigente?: boolean;
                revisionVencida?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description La lista. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ListaDocumentos"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    crearDocumento: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DocumentoEntrada"];
            };
        };
        responses: {
            /** @description El documento creado. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Documento"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    obtenerDocumento: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description El documento. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DocumentoDetalle"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    cambiarDocumento: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DocumentoCambios"];
            };
        };
        responses: {
            /** @description El documento cambiado. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Documento"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    retirarDocumento: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description El documento se retiró. */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    revisarDocumento: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RevisionDocumento"];
            };
        };
        responses: {
            /** @description El documento con la nueva fecha. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Documento"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    cambiarDistribucion: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DistribucionEntrada"];
            };
        };
        responses: {
            /** @description Los destinatarios. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Distribucion"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    vincularDocumento: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VinculoDocumentoEntrada"];
            };
        };
        responses: {
            /** @description El vínculo ya existía. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VinculoDocumentoResultado"];
                };
            };
            /** @description El vínculo se creó. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VinculoDocumentoResultado"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    desvincularDocumento: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VinculoDocumentoEntrada"];
            };
        };
        responses: {
            /** @description El vínculo se quitó. */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    subirVersion: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["VersionSubida"];
            };
        };
        responses: {
            /** @description La versión creada, en borrador. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VersionDocumento"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            413: components["responses"]["ArchivoDemasiadoGrande"];
            415: components["responses"]["TipoNoPermitido"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    enviarARevision: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EnvioRevision"];
            };
        };
        responses: {
            /** @description La versión en revisión. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VersionDocumento"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    devolverVersion: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DevolucionVersion"];
            };
        };
        responses: {
            /** @description La versión, de vuelta en borrador. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VersionDocumento"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    aprobarVersion: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AprobacionVersion"];
            };
        };
        responses: {
            /** @description La versión aprobada. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VersionDocumento"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    descartarVersion: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description El borrador se descartó. */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    descargarVersion: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description El archivo, como adjunto. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    /** @description Siempre `attachment`, con el nombre normalizado y la extensión del tipo detectado. */
                    "Content-Disposition"?: string;
                    "X-Content-Type-Options"?: "nosniff";
                    [name: string]: unknown;
                };
                content: {
                    "application/pdf": string;
                    "image/png": string;
                    "image/jpeg": string;
                    "text/plain": string;
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": string;
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": string;
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation": string;
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    confirmarLectura: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description La lectura quedó confirmada. */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    listarLecturasPendientes: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Las lecturas pendientes. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LecturaPendiente"][];
                };
            };
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    obtenerCoberturaDocumental: {
        parameters: {
            query?: {
                norma?: string;
                soloSinDocumento?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description La cobertura. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CoberturaDocumental"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    listarRetencion: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Las retenciones definidas. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Retencion"][];
                };
            };
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    guardarRetencion: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RetencionEntrada"];
            };
        };
        responses: {
            /** @description La retención guardada. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Retencion"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    listarDirectorioPersonas: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Las personas de la empresa. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PersonaDirectorio"][];
                };
            };
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    listarProcesos: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description La lista. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ListaProcesos"];
                };
            };
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    crearProceso: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProcesoEntrada"];
            };
        };
        responses: {
            /** @description El proceso creado. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Proceso"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    crearProcesoGestionSig: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description El proceso creado. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Proceso"];
                };
            };
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    cambiarProceso: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProcesoCambios"];
            };
        };
        responses: {
            /** @description El proceso actualizado. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Proceso"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    retirarProceso: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description El proceso se retiró. */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    listarRelacionesProceso: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Las relaciones. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ListaRelaciones"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    agregarRelacionProceso: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RelacionEntrada"];
            };
        };
        responses: {
            /** @description La relación ya existía. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RelacionProceso"];
                };
            };
            /** @description La relación creada. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RelacionProceso"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    quitarRelacionProceso: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RelacionEntrada"];
            };
        };
        responses: {
            /** @description La relación se quitó. */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    listarProgramas: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description La lista. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ListaProgramas"];
                };
            };
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    crearPrograma: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProgramaEntrada"];
            };
        };
        responses: {
            /** @description El programa creado. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Programa"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    obtenerPrograma: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description El detalle. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DetallePrograma"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    cambiarPrograma: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProgramaCambios"];
            };
        };
        responses: {
            /** @description El programa actualizado. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Programa"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    aprobarPrograma: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProgramaVersion"];
            };
        };
        responses: {
            /** @description El programa aprobado. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Programa"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    agregarExclusionPrograma: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExclusionEntrada"];
            };
        };
        responses: {
            /** @description El motivo registrado. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExclusionPrograma"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    quitarExclusionPrograma: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExclusionQuitar"];
            };
        };
        responses: {
            /** @description El motivo se quitó. */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    crearAuditoria: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AuditoriaEntrada"];
            };
        };
        responses: {
            /** @description La auditoría planificada. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auditoria"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    obtenerAuditoria: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description La auditoría. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auditoria"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    cambiarAuditoria: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AuditoriaCambios"];
            };
        };
        responses: {
            /** @description La auditoría actualizada. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auditoria"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    reprogramarAuditoria: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AuditoriaReprogramacion"];
            };
        };
        responses: {
            /** @description La auditoría reprogramada. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auditoria"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    cancelarAuditoria: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AuditoriaCancelacion"];
            };
        };
        responses: {
            /** @description La auditoría cancelada. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auditoria"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    avanzarAuditoria: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AuditoriaAvance"];
            };
        };
        responses: {
            /** @description La auditoría actualizada. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Auditoria"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    comprobarIndependencia: {
        parameters: {
            query: {
                personaId: string;
            };
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description El resultado. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Independencia"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    designarMiembroAuditoria: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MiembroEntrada"];
            };
        };
        responses: {
            /** @description La persona designada. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MiembroEquipo"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    quitarMiembroAuditoria: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MiembroQuitar"];
            };
        };
        responses: {
            /** @description La persona se quitó del equipo. */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    obtenerListaVerificacion: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description La lista. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ListaVerificacion"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    regenerarListaVerificacion: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Lo que cambió. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RegeneracionLista"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    evaluarFilaLista: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ResultadoFilaEntrada"];
            };
        };
        responses: {
            /** @description La fila evaluada. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FilaLista"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    agregarPreguntaLista: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PreguntaEntrada"];
            };
        };
        responses: {
            /** @description La pregunta agregada. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PreguntaLista"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    quitarPreguntaLista: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PreguntaQuitar"];
            };
        };
        responses: {
            /** @description La pregunta se quitó. */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    listarHallazgos: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Los hallazgos. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ListaHallazgos"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    cambiarHallazgo: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["HallazgoCambios"];
            };
        };
        responses: {
            /** @description El hallazgo actualizado. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Hallazgo"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    registrarHallazgo: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["HallazgoEntrada"];
            };
        };
        responses: {
            /** @description El hallazgo registrado. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Hallazgo"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    anularHallazgo: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["HallazgoAnulacion"];
            };
        };
        responses: {
            /** @description El hallazgo anulado. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Hallazgo"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    obtenerInforme: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description El informe. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InformeAuditoria"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    emitirInforme: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InformeEntrada"];
            };
        };
        responses: {
            /** @description El informe emitido. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InformeAuditoria"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    cerrarAuditoria: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Identificador del recurso (UUID en forma canónica; sin llaves ni guiones omitidos). */
                id: components["parameters"]["IdRuta"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CierreEntrada"];
            };
        };
        responses: {
            /** @description La auditoría cerrada. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CierreAuditoria"];
                };
            };
            400: components["responses"]["ParametrosInvalidos"];
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            404: components["responses"]["NoEncontrado"];
            409: components["responses"]["Conflicto"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
    obtenerPanelAuditoria: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description El panel. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControlNoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PanelAuditoria"];
                };
            };
            401: components["responses"]["NoAutenticado"];
            403: components["responses"]["SinPermiso"];
            429: components["responses"]["LimiteExcedido"];
            500: components["responses"]["ErrorInterno"];
        };
    };
}
