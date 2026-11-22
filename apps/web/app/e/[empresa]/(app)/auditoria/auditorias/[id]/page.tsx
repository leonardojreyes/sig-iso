import { notFound, redirect } from 'next/navigation';
import { crearDependencias } from '../../../../../../../src/auth/dependencias';
import { cargarAuditoria, cargarIndependencia, cargarProcesos, cargarPrograma } from '../../../../../../../src/auditoria/cargar';
import { leerAvisoEscritura } from '../../../../../../../src/certificacion/escribir';
import { cargarDirectorio } from '../../../../../../../src/documentos/cargar';
import { contextoActual } from '../../../../../../../src/marca/servidor';
import { PantallaPlanificacion } from '../../../../../../../src/pantallas/auditoria-plan';
import { PantallaSinPermiso } from '../../../../../../../src/pantallas/sin-permiso';
import { UUID } from '../../../../../../../src/validacion/patrones';

// Planificación de una auditoría. Una de otra empresa o inexistente responde 404. `?persona=` comprueba la independencia de una persona.
export default async function Page({ params, searchParams }: { params: Promise<{ empresa: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { empresa: slug, id } = await params;
  const { empresa, persona, acceso } = await contextoActual(slug);
  const parametros = await searchParams;
  const deps = crearDependencias(process.env);
  const base = { acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn };
  const retorno = `/auth/login?retorno=${encodeURIComponent(`/e/${slug}/auditoria/auditorias/${id}`)}`;

  const r = await cargarAuditoria({ ...base, id });
  if (r.tipo === 'ingresar') redirect(retorno);
  if (r.tipo === 'sin_permiso') return <PantallaSinPermiso empresa={empresa} persona={persona} activo="auditoria" />;
  if (r.tipo === 'no_encontrado') notFound();
  if (r.tipo !== 'ok') throw new Error('No se pudo cargar la auditoría');
  const candidataId = typeof parametros.persona === 'string' && UUID.test(parametros.persona) ? parametros.persona.toLowerCase() : null;
  // Lo demás es de apoyo: si falla, la pantalla se muestra sin ello (nunca a medias con datos inventados).
  const [procesos, directorio, programa, independencia] = await Promise.all([
    cargarProcesos(base),
    cargarDirectorio(base),
    cargarPrograma({ ...base, id: r.datos.programaId }),
    candidataId ? cargarIndependencia({ ...base, id, personaId: candidataId }) : Promise.resolve(null),
  ]);
  if (procesos.tipo === 'ingresar' || directorio.tipo === 'ingresar') redirect(retorno);
  return (
    <PantallaPlanificacion
      empresa={empresa}
      persona={persona}
      auditoria={r.datos}
      programa={programa.tipo === 'ok' ? programa.datos.programa : null}
      procesos={procesos.tipo === 'ok' ? procesos.datos : { procesos: [], gestionSigVigente: false }}
      personas={directorio.tipo === 'ok' ? directorio.datos : []}
      candidataId={candidataId}
      independencia={independencia?.tipo === 'ok' ? independencia.datos : null}
      aviso={leerAvisoEscritura(parametros)}
    />
  );
}
