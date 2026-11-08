// Manejadores de las rutas /auth/login, /auth/callback, /auth/logout y /auth/sesion. Reciben la fábrica de dependencias para poder
// probarse sin Next ni red. Un error de configuración responde 500 SIN detalles (el detalle, que solo nombra variables, va al
// registro del servidor).
import type { AlmacenAcceso } from './almacen-acceso';
import { completarCallback, iniciarLogin, respuestaDeFallo, type DependenciasFlujo } from './flujo';
import { crearServicioSesion } from './sesion';

export type DependenciasWeb = DependenciasFlujo & { readonly almacen: AlmacenAcceso };
export type FabricaDependencias = () => DependenciasWeb;
export type Registrar = (mensaje: string) => void;

const SIN_CACHE = { 'Cache-Control': 'no-store' };
const noDisponible = (): Response =>
  new Response('El ingreso no está disponible en este momento.', {
    status: 500,
    headers: { ...SIN_CACHE, 'Content-Type': 'text/plain; charset=utf-8' },
  });

const conDependencias =
  (
    nombre: string,
    fabrica: FabricaDependencias,
    registrar: Registrar,
    usar: (deps: DependenciasWeb, peticion: Request) => Promise<Response>,
  ) =>
  async (peticion: Request): Promise<Response> => {
    let deps: DependenciasWeb;
    try {
      deps = fabrica();
    } catch (e) {
      registrar(`${nombre}: ${e instanceof Error ? e.message : 'error desconocido'}`);
      return noDisponible();
    }
    return usar(deps, peticion);
  };

export const crearManejadorLogin = (fabrica: FabricaDependencias, registrar: Registrar) =>
  conDependencias('auth/login', fabrica, registrar, (deps, peticion) => iniciarLogin(peticion, deps));

export const crearManejadorCallback = (fabrica: FabricaDependencias, registrar: Registrar) =>
  conDependencias('auth/callback', fabrica, registrar, async (deps, peticion) => {
    const resultado = await completarCallback(peticion, deps);
    if (!resultado.ok) {
      registrar(`auth/callback: ingreso rechazado (${resultado.motivo})`);
      return respuestaDeFallo(resultado, deps.config);
    }
    // La sesión solo se emite si la API registró el inicio (ADR 027); si no, vuelve al inicio con un error genérico.
    return crearServicioSesion(deps).iniciar(resultado);
  });

export const crearManejadorLogout = (fabrica: FabricaDependencias, registrar: Registrar) =>
  conDependencias('auth/logout', fabrica, registrar, (deps, peticion) => crearServicioSesion(deps).cerrar(peticion));

/** ¿Hay sesión vigente? Renueva el access token si hace falta (y reemite la cookie si el refresh rotó). No devuelve datos de la persona. */
export const crearManejadorSesion = (fabrica: FabricaDependencias, registrar: Registrar) =>
  conDependencias('auth/sesion', fabrica, registrar, async (deps, peticion) => {
    const servicio = crearServicioSesion(deps);
    const json = (estado: number, cuerpo: unknown, cookies: string[] = []): Response => {
      const cabeceras = new Headers({ ...SIN_CACHE, 'Content-Type': 'application/json' });
      for (const c of cookies) cabeceras.append('Set-Cookie', c);
      return new Response(JSON.stringify(cuerpo), { status: estado, headers: cabeceras });
    };
    const sesion = await servicio.leer(peticion);
    if (!sesion) return json(401, { autenticado: false });
    const acceso = await servicio.obtenerAcceso(sesion);
    if (acceso.ok) return json(200, { autenticado: true }, acceso.nuevaCookie ? [acceso.nuevaCookie] : []);
    if (acceso.motivo === 'expirada') {
      registrar('auth/sesion: sesión expirada o revocada');
      return json(401, { autenticado: false }, acceso.limpiarCookie ? [acceso.limpiarCookie] : []);
    }
    return json(503, { autenticado: false });
  });
