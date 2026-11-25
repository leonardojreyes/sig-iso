import { redirect } from 'next/navigation';
import { crearDependencias } from '../../../../../../src/auth/dependencias';
import { cargarProcesos } from '../../../../../../src/auditoria/cargar';
import { leerAvisoEscritura } from '../../../../../../src/certificacion/escribir';
import { cargarDirectorio } from '../../../../../../src/documentos/cargar';
import { contextoActual } from '../../../../../../src/marca/servidor';
import { PantallaProcesos } from '../../../../../../src/pantallas/auditoria-procesos';
import { PantallaSinPermiso } from '../../../../../../src/pantallas/sin-permiso';

// Procesos REALES de la empresa de la sesión, pedidos a la API con el token de la sesión.
export default async function Page({ params, searchParams }: { params: Promise<{ empresa: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const slug = (await params).empresa;
  const { empresa, persona, acceso } = await contextoActual(slug);
  const parametros = await searchParams;
  const deps = crearDependencias(process.env);
  const base = { acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn };
  const retorno = `/auth/login?retorno=${encodeURIComponent(`/e/${slug}/auditoria/procesos`)}`;

  const r = await cargarProcesos(base);
  if (r.tipo === 'ingresar') redirect(retorno);
  if (r.tipo === 'sin_permiso') return <PantallaSinPermiso empresa={empresa} persona={persona} activo="auditoria" />;
  if (r.tipo !== 'ok') throw new Error('No se pudieron cargar los procesos');
  // El directorio es de apoyo (nombres de las personas): si falla, la pantalla se muestra sin nombres, nunca con datos inventados.
  const directorio = await cargarDirectorio(base);
  if (directorio.tipo === 'ingresar') redirect(retorno);
  return <PantallaProcesos empresa={empresa} persona={persona} lista={r.datos} personas={directorio.tipo === 'ok' ? directorio.datos : []} aviso={leerAvisoEscritura(parametros)} />;
}
