import { crearDependencias, registrarEnServidor } from '../../../src/auth/dependencias';
import { elegirEmpresa } from '../../../src/cambio-empresa/cambiar';

// Elegir la empresa con la que se va a trabajar al entrar: solo POST, con `Origin` propio. Un GET responde 405.
export const dynamic = 'force-dynamic';

const manejar = async (peticion: Request): Promise<Response> => {
  let deps: ReturnType<typeof crearDependencias>;
  try {
    deps = crearDependencias(process.env);
  } catch (e) {
    registrarEnServidor(`elegirEmpresa: ${e instanceof Error ? e.message : 'error desconocido'}`);
    return new Response('El servicio no está disponible en este momento.', { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
  return elegirEmpresa(peticion, deps);
};
export const POST = manejar;
export const GET = manejar;
