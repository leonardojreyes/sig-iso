import { notFound, redirect } from 'next/navigation';
import { crearDependencias } from '../../../../../../src/auth/dependencias';
import { cargarControles, cargarEvidencias } from '../../../../../../src/certificacion/cargar';
import { leerAvisoEscritura } from '../../../../../../src/certificacion/escribir';
import { hoyEnEcuador } from '../../../../../../src/certificacion/formato';
import { contextoActual } from '../../../../../../src/marca/servidor';
import { PantallaEvidenciasControl } from '../../../../../../src/pantallas/evidencias-control';
import { PantallaSinPermiso } from '../../../../../../src/pantallas/sin-permiso';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Evidencias REALES de un control de la empresa de la sesión, pedidas a la API con el token de la sesión. Un control que no existe o
// es de otra empresa es un 404 (la API responde igual en los dos casos).
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { empresa: slug, id } = await params;
  if (!UUID.test(id)) notFound();
  const { empresa, persona, acceso } = await contextoActual(slug);
  const parametros = await searchParams;
  const historial = parametros.historicas === 'true';
  const deps = crearDependencias(process.env);
  const base = { acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn };
  const retorno = `/auth/login?retorno=${encodeURIComponent(`/e/${slug}/controles/${id}`)}`;

  // El control se busca entre los de la empresa (incluidos los retirados): la API no tiene una consulta por identificador.
  const marco = await cargarControles({ ...base, filtros: { retirados: true } });
  if (marco.tipo === 'ingresar') redirect(retorno);
  if (marco.tipo === 'sin_permiso') return <PantallaSinPermiso empresa={empresa} persona={persona} activo="controles" />;
  if (marco.tipo === 'no_disponible') throw new Error('No se pudo cargar el control');
  const control = marco.datos.controles.find((c) => c.id === id.toLowerCase());
  if (!control) notFound();

  const e = await cargarEvidencias({ ...base, controlId: id, incluirHistoricas: historial });
  if (e.tipo === 'ingresar') redirect(retorno);
  if (e.tipo === 'sin_permiso') return <PantallaSinPermiso empresa={empresa} persona={persona} activo="controles" />;
  if (e.tipo === 'no_encontrado') notFound();
  if (e.tipo === 'no_disponible') throw new Error('No se pudieron cargar las evidencias');
  return <PantallaEvidenciasControl empresa={empresa} persona={persona} control={control} evidencias={e.datos} historial={historial} hoy={hoyEnEcuador()} aviso={leerAvisoEscritura(parametros)} />;
}
