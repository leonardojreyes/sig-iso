import { ENCABEZADO_EMPRESA } from '../../../../../src/auth/proxy-adaptador';
import { descargarPlantilla } from '../../../../../src/librerias/subir';
import { NOMBRE_PLANTILLA, PLANTILLA_LIBRERIA } from '../../../../../src/librerias/plantilla';

// Plantilla de librería (YAML) para completar. Solo GET; no usa datos de la petición.
export const dynamic = 'force-dynamic';

export const GET = async (peticion: Request, { params }: { params: Promise<{ empresa: string }> }): Promise<Response> => {
  const { empresa } = await params;
  return descargarPlantilla(peticion, { slugDeLaDireccion: empresa, slugVerificado: peticion.headers.get(ENCABEZADO_EMPRESA) }, PLANTILLA_LIBRERIA, NOMBRE_PLANTILLA);
};
export const POST = GET;
