import { notFound, redirect } from 'next/navigation';
import { crearDependencias } from '../../../../../../../../src/auth/dependencias';
import { cargarAuditoria, cargarHallazgos, cargarLista, cargarProcesos } from '../../../../../../../../src/auditoria/cargar';
import { leerAvisoEscritura } from '../../../../../../../../src/certificacion/escribir';
import { cargarDirectorio } from '../../../../../../../../src/documentos/cargar';
import { contextoActual } from '../../../../../../../../src/marca/servidor';
import { PantallaEjecucion } from '../../../../../../../../src/pantallas/auditoria-ejecucion';
import { PantallaSinPermiso } from '../../../../../../../../src/pantallas/sin-permiso';

// Lista de verificación y hallazgos de una auditoría. Una de otra empresa o inexistente responde 404.
export default async function Page({ params, searchParams }: { params: Promise<{ empresa: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { empresa: slug, id } = await params;
  const { empresa, persona, acceso } = await contextoActual(slug);
  const parametros = await searchParams;
  const deps = crearDependencias(process.env);
  const base = { acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn };
  const retorno = `/auth/login?retorno=${encodeURIComponent(`/e/${slug}/auditoria/auditorias/${id}/ejecucion`)}`;

  const [a, lista, hallazgos] = await Promise.all([cargarAuditoria({ ...base, id }), cargarLista({ ...base, id }), cargarHallazgos({ ...base, id })]);
  if (a.tipo === 'ingresar' || lista.tipo === 'ingresar' || hallazgos.tipo === 'ingresar') redirect(retorno);
  if (a.tipo === 'sin_permiso' || lista.tipo === 'sin_permiso' || hallazgos.tipo === 'sin_permiso') return <PantallaSinPermiso empresa={empresa} persona={persona} activo="auditoria" />;
  if (a.tipo === 'no_encontrado' || lista.tipo === 'no_encontrado' || hallazgos.tipo === 'no_encontrado') notFound();
  if (a.tipo !== 'ok' || lista.tipo !== 'ok' || hallazgos.tipo !== 'ok') throw new Error('No se pudo cargar la lista de verificación');
  const [procesos, directorio] = await Promise.all([cargarProcesos(base), cargarDirectorio(base)]);
  if (procesos.tipo === 'ingresar' || directorio.tipo === 'ingresar') redirect(retorno);
  return (
    <PantallaEjecucion
      empresa={empresa}
      persona={persona}
      auditoria={a.datos}
      lista={lista.datos}
      hallazgos={hallazgos.datos}
      procesos={procesos.tipo === 'ok' ? procesos.datos : { procesos: [], gestionSigVigente: false }}
      personas={directorio.tipo === 'ok' ? directorio.datos : []}
      aviso={leerAvisoEscritura(parametros)}
    />
  );
}
