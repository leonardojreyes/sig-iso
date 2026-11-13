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
        put?: never;
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
         * @description Todas las librerías del catálogo GLOBAL con sus metadatos, e indica cuáles adoptó la empresa. Las entradas solo se ven si
         *     se adoptó. El catálogo es acotado por diseño y de solo lectura; una librería privada de una empresa exigiría su propia
         *     tabla con `empresa_id` y RLS, y no aparecería aquí.
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
         *     cobertura de las evidencias; no se guarda nada. Trae también la última versión aprobada, si hay. Orden: 401, 403.
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
         *     aprobar: queda señalado en el documento. Orden: 401, 403, 409.
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
            /** @description Solo `https` sin credenciales en la URL, o una ruta propia (nunca `//host`). Si no es válido se devuelve nulo y se muestra el monograma. */
            logoUrl: string | null;
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
            /** @description Si la empresa de quien consulta ya la adoptó. */
            adoptada: boolean;
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
            /** @description Hay filas y ninguna está por decidir. */
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
}
