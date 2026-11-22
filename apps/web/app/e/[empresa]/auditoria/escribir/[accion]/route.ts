import { crearDependencias, registrarEnServidor } from '../../../../../../src/auth/dependencias';
import { ENCABEZADO_EMPRESA } from '../../../../../../src/auth/proxy-adaptador';
import { escribirAuditoria } from '../../../../../../src/auditoria/escribir';

// Escrituras de la auditoría interna SIN recurso en la dirección (alta de un proceso o de un programa): solo POST, con `Origin` propio.
// La acción es de una lista cerrada; una desconocida responde 404. Un GET responde 405.
export const dynamic = 'force-dynamic';

const manejar = async (peticion: Request, { params }: { params: Promise<{ empresa: string; accion: string }> }): Promise<Response> => {
  const { empresa, accion } = await params;
  let deps: ReturnType<typeof crearDependencias>;
  try {
    deps = crearDependencias(process.env);
  } catch (e) {
    registrarEnServidor(`auditoria/escribir: ${e instanceof Error ? e.message : 'error desconocido'}`);
    return new Response('El servicio no está disponible en este momento.', { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
  return escribirAuditoria(peticion, { slugDeLaDireccion: empresa, slugVerificado: peticion.headers.get(ENCABEZADO_EMPRESA), deps }, accion);
};
export const POST = manejar;
export const GET = manejar;
