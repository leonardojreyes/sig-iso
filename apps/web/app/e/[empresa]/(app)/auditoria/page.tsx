import { redirect } from 'next/navigation';
import { crearDependencias } from '../../../../../src/auth/dependencias';
import { cargarNormasAdoptadas, cargarProgramas } from '../../../../../src/auditoria/cargar';
import { leerAvisoEscritura } from '../../../../../src/certificacion/escribir';
import { contextoActual } from '../../../../../src/marca/servidor';
import { PantallaAuditoria } from '../../../../../src/pantallas/auditoria-programa';
import { PantallaSinPermiso } from '../../../../../src/pantallas/sin-permiso';

// Entrada a la auditoría interna: los programas REALES de la empresa de la sesión, pedidos a la API con el token de la sesión.
export default async function Page({ params, searchParams }: { params: Promise<{ empresa: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const slug = (await params).empresa;
  const { empresa, persona, acceso } = await contextoActual(slug);
  const parametros = await searchParams;
  const deps = crearDependencias(process.env);
  const base = { acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn };
  const retorno = `/auth/login?retorno=${encodeURIComponent(`/e/${slug}/auditoria`)}`;

  const r = await cargarProgramas(base);
  if (r.tipo === 'ingresar') redirect(retorno);
  if (r.tipo === 'sin_permiso') return <PantallaSinPermiso empresa={empresa} persona={persona} activo="auditoria" />;
  if (r.tipo !== 'ok') throw new Error('No se pudieron cargar los programas');
  const normas = await cargarNormasAdoptadas(base);
  if (normas.tipo === 'ingresar') redirect(retorno);
  return <PantallaAuditoria empresa={empresa} persona={persona} programas={r.datos.programas} normasAdoptadas={normas.tipo === 'ok' ? normas.datos : []} aviso={leerAvisoEscritura(parametros)} />;
}
