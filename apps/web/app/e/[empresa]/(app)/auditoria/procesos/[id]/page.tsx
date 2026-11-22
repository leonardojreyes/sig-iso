import { notFound, redirect } from 'next/navigation';
import { crearDependencias } from '../../../../../../../src/auth/dependencias';
import { cargarProcesos, cargarRelaciones } from '../../../../../../../src/auditoria/cargar';
import { leerAvisoEscritura } from '../../../../../../../src/certificacion/escribir';
import { cargarDirectorio } from '../../../../../../../src/documentos/cargar';
import { contextoActual } from '../../../../../../../src/marca/servidor';
import { PantallaProceso } from '../../../../../../../src/pantallas/auditoria-procesos';
import { PantallaSinPermiso } from '../../../../../../../src/pantallas/sin-permiso';

// Un proceso y las personas relacionadas con él. Uno de otra empresa o inexistente responde 404.
export default async function Page({ params, searchParams }: { params: Promise<{ empresa: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { empresa: slug, id } = await params;
  const { empresa, persona, acceso } = await contextoActual(slug);
  const parametros = await searchParams;
  const deps = crearDependencias(process.env);
  const base = { acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn };
  const retorno = `/auth/login?retorno=${encodeURIComponent(`/e/${slug}/auditoria/procesos/${id}`)}`;

  const [lista, relaciones] = await Promise.all([cargarProcesos(base), cargarRelaciones({ ...base, id })]);
  if (lista.tipo === 'ingresar' || relaciones.tipo === 'ingresar') redirect(retorno);
  if (lista.tipo === 'sin_permiso' || relaciones.tipo === 'sin_permiso') return <PantallaSinPermiso empresa={empresa} persona={persona} activo="auditoria" />;
  if (relaciones.tipo === 'no_encontrado') notFound();
  if (lista.tipo !== 'ok' || relaciones.tipo !== 'ok') throw new Error('No se pudo cargar el proceso');
  const proceso = lista.datos.procesos.find((x) => x.id === id.toLowerCase());
  if (!proceso) notFound();
  const directorio = await cargarDirectorio(base);
  if (directorio.tipo === 'ingresar') redirect(retorno);
  return (
    <PantallaProceso
      empresa={empresa}
      persona={persona}
      proceso={proceso}
      relaciones={relaciones.datos.relaciones}
      personas={directorio.tipo === 'ok' ? directorio.datos : []}
      aviso={leerAvisoEscritura(parametros)}
    />
  );
}
