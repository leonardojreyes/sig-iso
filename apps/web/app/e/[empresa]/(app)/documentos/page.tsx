import { redirect } from 'next/navigation';
import { crearDependencias } from '../../../../../src/auth/dependencias';
import { leerAvisoEscritura } from '../../../../../src/certificacion/escribir';
import { cargarDirectorio, cargarDocumentos, cargarLecturasPendientes, cargarRetencion } from '../../../../../src/documentos/cargar';
import { leerFiltrosDocumentos } from '../../../../../src/documentos/filtros';
import { contextoActual } from '../../../../../src/marca/servidor';
import { PantallaDocumentos } from '../../../../../src/pantallas/documentos';
import { PantallaSinPermiso } from '../../../../../src/pantallas/sin-permiso';

// Documentos REALES de la empresa de la sesión, pedidos a la API con el token de la sesión.
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
  const { filtros, invalidos } = leerFiltrosDocumentos(parametros);
  const deps = crearDependencias(process.env);
  const base = { acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn };
  const retorno = `/auth/login?retorno=${encodeURIComponent(`/e/${slug}/documentos`)}`;

  const r = await cargarDocumentos({ ...base, filtros });
  if (r.tipo === 'ingresar') redirect(retorno);
  if (r.tipo === 'sin_permiso') return <PantallaSinPermiso empresa={empresa} persona={persona} activo="documentos" />;
  if (r.tipo !== 'ok') throw new Error('No se pudieron cargar los documentos');

  // Lo demás es de apoyo: si falla, la pantalla se muestra sin ello (nunca a medias con datos inventados).
  const [directorio, pendientes, retencion] = await Promise.all([
    cargarDirectorio(base),
    cargarLecturasPendientes(base),
    persona.roles.includes('administrador_sig') ? cargarRetencion(base) : Promise.resolve(null),
  ]);
  if (directorio.tipo === 'ingresar') redirect(retorno);
  return (
    <PantallaDocumentos
      empresa={empresa}
      persona={persona}
      documentos={r.datos.documentos}
      personas={directorio.tipo === 'ok' ? directorio.datos : []}
      pendientes={pendientes.tipo === 'ok' ? pendientes.datos : []}
      retenciones={retencion?.tipo === 'ok' ? retencion.datos : []}
      filtros={filtros}
      filtrosInvalidos={invalidos}
      aviso={leerAvisoEscritura(parametros)}
    />
  );
}
