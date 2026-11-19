import { notFound, redirect } from 'next/navigation';
import { crearDependencias } from '../../../../../../src/auth/dependencias';
import { cargarControles } from '../../../../../../src/certificacion/cargar';
import { leerAvisoEscritura } from '../../../../../../src/certificacion/escribir';
import { cargarDirectorio, cargarDocumento } from '../../../../../../src/documentos/cargar';
import { contextoActual } from '../../../../../../src/marca/servidor';
import { PantallaDocumentoDetalle, type OpcionControl } from '../../../../../../src/pantallas/documento-detalle';
import { PantallaSinPermiso } from '../../../../../../src/pantallas/sin-permiso';
import { UUID } from '../../../../../../src/validacion/patrones';

// Un documento REAL de la empresa de la sesión con su historial. Uno que no existe o es de otra empresa es un 404 (la API responde igual).
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
  const deps = crearDependencias(process.env);
  const base = { acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn };
  const retorno = `/auth/login?retorno=${encodeURIComponent(`/e/${slug}/documentos/${id}`)}`;

  const r = await cargarDocumento({ ...base, id });
  if (r.tipo === 'ingresar') redirect(retorno);
  if (r.tipo === 'sin_permiso') return <PantallaSinPermiso empresa={empresa} persona={persona} activo="documentos" />;
  if (r.tipo === 'no_encontrado') notFound();
  if (r.tipo === 'no_disponible') throw new Error('No se pudo cargar el documento');

  const directorio = await cargarDirectorio(base);
  if (directorio.tipo === 'ingresar') redirect(retorno);
  // Los controles para ligar solo los usa quien administra (la API decide de verdad).
  let controles: OpcionControl[] = [];
  if (persona.roles.includes('administrador_sig')) {
    const c = await cargarControles({ ...base, filtros: {} });
    if (c.tipo === 'ingresar') redirect(retorno);
    if (c.tipo === 'ok') controles = c.datos.controles.filter((x) => x.estado === 'vigente').map((x) => ({ id: x.id, codigo: x.codigo, nombre: x.nombre }));
  }
  return <PantallaDocumentoDetalle empresa={empresa} persona={persona} personaId={persona.id ?? null} documento={r.datos} personas={directorio.tipo === 'ok' ? directorio.datos : []} controles={controles} aviso={leerAvisoEscritura(parametros)} />;
}
