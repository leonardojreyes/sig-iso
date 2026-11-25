import { notFound, redirect } from 'next/navigation';
import { crearDependencias } from '../../../../../../../../src/auth/dependencias';
import { cargarAuditoria, cargarInforme, cargarLista } from '../../../../../../../../src/auditoria/cargar';
import { leerAvisoEscritura } from '../../../../../../../../src/certificacion/escribir';
import { cargarDirectorio } from '../../../../../../../../src/documentos/cargar';
import { contextoActual } from '../../../../../../../../src/marca/servidor';
import { PantallaInforme } from '../../../../../../../../src/pantallas/auditoria-informe';
import { PantallaSinPermiso } from '../../../../../../../../src/pantallas/sin-permiso';

// Informe de una auditoría. Una de otra empresa o inexistente responde 404; sin informe emitido se muestra lo que falta para emitirlo.
export default async function Page({ params, searchParams }: { params: Promise<{ empresa: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { empresa: slug, id } = await params;
  const { empresa, persona, acceso } = await contextoActual(slug);
  const parametros = await searchParams;
  const deps = crearDependencias(process.env);
  const base = { acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn };
  const retorno = `/auth/login?retorno=${encodeURIComponent(`/e/${slug}/auditoria/auditorias/${id}/informe`)}`;

  const [a, informe, lista] = await Promise.all([cargarAuditoria({ ...base, id }), cargarInforme({ ...base, id }), cargarLista({ ...base, id })]);
  if (a.tipo === 'ingresar' || informe.tipo === 'ingresar' || lista.tipo === 'ingresar') redirect(retorno);
  if (a.tipo === 'sin_permiso' || informe.tipo === 'sin_permiso' || lista.tipo === 'sin_permiso') return <PantallaSinPermiso empresa={empresa} persona={persona} activo="auditoria" />;
  if (a.tipo === 'no_encontrado' || lista.tipo === 'no_encontrado') notFound();
  if (a.tipo !== 'ok' || lista.tipo !== 'ok') throw new Error('No se pudo cargar la auditoría');
  // Un informe aún no emitido responde 404: la pantalla muestra lo que falta; cualquier otro fallo no se disfraza de «no emitido».
  if (informe.tipo !== 'ok' && informe.tipo !== 'no_encontrado') throw new Error('No se pudo cargar el informe');
  const directorio = await cargarDirectorio(base);
  if (directorio.tipo === 'ingresar') redirect(retorno);
  return (
    <PantallaInforme
      empresa={empresa}
      persona={persona}
      auditoria={a.datos}
      informe={informe.tipo === 'ok' ? informe.datos : null}
      lista={lista.datos}
      personas={directorio.tipo === 'ok' ? directorio.datos : []}
      aviso={leerAvisoEscritura(parametros)}
    />
  );
}
