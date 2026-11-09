import { crearDependencias, registrarEnServidor } from '../../../../../../src/auth/dependencias';
import { ENCABEZADO_EMPRESA } from '../../../../../../src/auth/proxy-adaptador';
import { adoptarLibreria } from '../../../../../../src/librerias/adoptar';

// Adoptar cambia estado: solo POST, con `Origin` propio. Un GET responde 405.
export const dynamic = 'force-dynamic';

const manejar = async (
  peticion: Request,
  { params }: { params: Promise<{ empresa: string; id: string }> },
): Promise<Response> => {
  const { empresa, id } = await params;
  let deps: ReturnType<typeof crearDependencias>;
  try {
    deps = crearDependencias(process.env);
  } catch (e) {
    registrarEnServidor(`adopcion: ${e instanceof Error ? e.message : 'error desconocido'}`);
    return new Response('El servicio no está disponible en este momento.', {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  return adoptarLibreria(
    peticion,
    { slugDeLaDireccion: empresa, slugVerificado: peticion.headers.get(ENCABEZADO_EMPRESA), libreriaId: id },
    deps,
  );
};
export const POST = manejar;
export const GET = manejar;
