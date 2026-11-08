// Manejadores de las rutas /auth/login y /auth/callback. Reciben la fábrica de dependencias para poder probarse sin Next ni red.
// Un error de configuración responde 500 SIN detalles (el detalle, que solo nombra variables, va al registro del servidor).
import { completarCallback, iniciarLogin, respuestaDeFallo, type DependenciasFlujo } from './flujo';

export type FabricaDependencias = () => DependenciasFlujo;
export type Registrar = (mensaje: string) => void;

const SIN_CACHE = { 'Cache-Control': 'no-store' };
const noDisponible = (): Response =>
  new Response('El ingreso no está disponible en este momento.', {
    status: 500,
    headers: { ...SIN_CACHE, 'Content-Type': 'text/plain; charset=utf-8' },
  });

export const crearManejadorLogin =
  (fabrica: FabricaDependencias, registrar: Registrar) =>
  async (peticion: Request): Promise<Response> => {
    try {
      return await iniciarLogin(peticion, fabrica());
    } catch (e) {
      registrar(`auth/login: ${e instanceof Error ? e.message : 'error desconocido'}`);
      return noDisponible();
    }
  };

export const crearManejadorCallback =
  (fabrica: FabricaDependencias, registrar: Registrar) =>
  async (peticion: Request): Promise<Response> => {
    let deps: DependenciasFlujo;
    try {
      deps = fabrica();
    } catch (e) {
      registrar(`auth/callback: ${e instanceof Error ? e.message : 'error desconocido'}`);
      return noDisponible();
    }
    const resultado = await completarCallback(peticion, deps);
    if (!resultado.ok) {
      registrar(`auth/callback: ingreso rechazado (${resultado.motivo})`);
      return respuestaDeFallo(resultado, deps.config);
    }
    // Tarea 10.3: aquí se registra el inicio de sesión en la API y se emite la cookie de sesión. Hasta entonces el ingreso
    // queda VALIDADO pero sin sesión: los tokens se descartan (no se guardan, no se registran, no salen en la respuesta).
    const cabeceras = new Headers({ ...SIN_CACHE, 'Content-Type': 'text/plain; charset=utf-8' });
    cabeceras.append('Set-Cookie', resultado.limpiarCookie);
    return new Response('Ingreso validado. La sesión se implementa en la tarea 10.3.', {
      status: 501,
      headers: cabeceras,
    });
  };
