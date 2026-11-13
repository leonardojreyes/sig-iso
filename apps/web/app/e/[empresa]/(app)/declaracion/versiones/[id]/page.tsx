import { notFound, redirect } from 'next/navigation';
import { crearDependencias } from '../../../../../../../src/auth/dependencias';
import { cargarVersionDeclaracion } from '../../../../../../../src/certificacion/cargar';
import { contextoActual } from '../../../../../../../src/marca/servidor';
import { PantallaVersionDeclaracion } from '../../../../../../../src/pantallas/declaracion-version';
import { PantallaSinPermiso } from '../../../../../../../src/pantallas/sin-permiso';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Una versión aprobada de la declaración (copia congelada). Una versión que no existe o es de otra empresa es un 404 (la API responde
// igual en los dos casos).
export default async function Page({ params }: { params: Promise<{ empresa: string; id: string }> }) {
  const { empresa: slug, id } = await params;
  if (!UUID.test(id)) notFound();
  const { empresa, persona, acceso } = await contextoActual(slug);
  const deps = crearDependencias(process.env);
  const r = await cargarVersionDeclaracion({ acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn, id });
  if (r.tipo === 'ingresar') redirect(`/auth/login?retorno=${encodeURIComponent(`/e/${slug}/declaracion/versiones/${id}`)}`);
  if (r.tipo === 'sin_permiso') return <PantallaSinPermiso empresa={empresa} persona={persona} activo="declaracion" />;
  if (r.tipo === 'no_encontrado') notFound();
  if (r.tipo === 'no_disponible') throw new Error('No se pudo cargar la versión de la declaración');
  return <PantallaVersionDeclaracion empresa={empresa} persona={persona} version={r.datos} />;
}
