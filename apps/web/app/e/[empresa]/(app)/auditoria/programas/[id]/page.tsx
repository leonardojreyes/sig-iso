import { notFound, redirect } from 'next/navigation';
import { crearDependencias } from '../../../../../../../src/auth/dependencias';
import { cargarNormasAdoptadas, cargarPrograma } from '../../../../../../../src/auditoria/cargar';
import { leerAvisoEscritura } from '../../../../../../../src/certificacion/escribir';
import { cargarDirectorio } from '../../../../../../../src/documentos/cargar';
import { contextoActual } from '../../../../../../../src/marca/servidor';
import { PantallaPrograma } from '../../../../../../../src/pantallas/auditoria-programa';
import { PantallaSinPermiso } from '../../../../../../../src/pantallas/sin-permiso';

// Un programa anual. Uno de otra empresa o inexistente responde 404.
export default async function Page({ params, searchParams }: { params: Promise<{ empresa: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { empresa: slug, id } = await params;
  const { empresa, persona, acceso } = await contextoActual(slug);
  const parametros = await searchParams;
  const deps = crearDependencias(process.env);
  const base = { acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn };
  const retorno = `/auth/login?retorno=${encodeURIComponent(`/e/${slug}/auditoria/programas/${id}`)}`;

  const r = await cargarPrograma({ ...base, id });
  if (r.tipo === 'ingresar') redirect(retorno);
  if (r.tipo === 'sin_permiso') return <PantallaSinPermiso empresa={empresa} persona={persona} activo="auditoria" />;
  if (r.tipo === 'no_encontrado') notFound();
  if (r.tipo !== 'ok') throw new Error('No se pudo cargar el programa');
  const [directorio, normas] = await Promise.all([cargarDirectorio(base), cargarNormasAdoptadas(base)]);
  if (directorio.tipo === 'ingresar' || normas.tipo === 'ingresar') redirect(retorno);
  return (
    <PantallaPrograma
      empresa={empresa}
      persona={persona}
      detalle={r.datos}
      personas={directorio.tipo === 'ok' ? directorio.datos : []}
      normasAdoptadas={normas.tipo === 'ok' ? normas.datos : r.datos.programa.normas}
      aviso={leerAvisoEscritura(parametros)}
    />
  );
}
