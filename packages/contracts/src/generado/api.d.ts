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
            codigo: "no_autenticado" | "sin_permiso" | "no_encontrado" | "parametro_invalido" | "limite_excedido" | "error_interno";
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
            capitulo: number;
            /** @enum {integer} */
            nivel: 1 | 2;
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
}
