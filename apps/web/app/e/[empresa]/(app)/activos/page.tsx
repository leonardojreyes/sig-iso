import { redirect } from 'next/navigation';
import { cargarActivos } from '../../../../../src/activos/cargar';
import { leerFiltrosActivos } from '../../../../../src/activos/filtros';
import { crearDependencias } from '../../../../../src/auth/dependencias';
import { leerAvisoEscritura } from '../../../../../src/certificacion/escribir';
import { cargarDirectorio } from '../../../../../src/documentos/cargar';
import { contextoActual } from '../../../../../src/marca/servidor';
import { PantallaActivos } from '../../../../../src/pantallas/activos';
import { PantallaSinPermiso } from '../../../../../src/pantallas/sin-permiso';

// Activos REALES de la empresa de la sesión, pedidos a la API con el token de la sesión.
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const slug = (await params).empresa;
  const { empresa, persona, acceso } = await contextoActual(slug);
  const parametros = await searchParams;
  const { filtros, invalidos } = leerFiltrosActivos(parametros);
  const deps = crearDependencias(process.env);
  const base = { acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn };
  const retorno = `/auth/login?retorno=${encodeURIComponent(`/e/${slug}/activos`)}`;
  const r = await cargarActivos({ ...base, filtros });
  if (r.tipo === 'ingresar') redirect(retorno);
  if (r.tipo === 'sin_permiso') return <PantallaSinPermiso empresa={empresa} persona={persona} activo="activos" />;
  if (r.tipo !== 'ok') throw new Error('No se pudieron cargar los activos');
  // Los nombres de las personas salen del directorio (también para quien solo consulta); si falla, la pantalla se muestra sin ellos.
  const directorio = await cargarDirectorio(base);
  if (directorio.tipo === 'ingresar') redirect(retorno);
  return <PantallaActivos empresa={empresa} persona={persona} activos={r.datos} personas={directorio.tipo === 'ok' ? directorio.datos : []} filtros={filtros} filtrosInvalidos={invalidos} aviso={leerAvisoEscritura(parametros)} />;
}
