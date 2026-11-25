import { notFound, redirect } from 'next/navigation';
import { cargarActivo, cargarAvisoRetiroActivo } from '../../../../../../src/activos/cargar';
import type { AvisoRetiroActivo } from '../../../../../../src/activos/tipos';
import { crearDependencias } from '../../../../../../src/auth/dependencias';
import { leerAvisoEscritura } from '../../../../../../src/certificacion/escribir';
import { cargarDirectorio } from '../../../../../../src/documentos/cargar';
import { contextoActual } from '../../../../../../src/marca/servidor';
import { PantallaActivoDetalle } from '../../../../../../src/pantallas/activo-detalle';
import { PantallaSinPermiso } from '../../../../../../src/pantallas/sin-permiso';
import { UUID } from '../../../../../../src/validacion/patrones';

// Un activo REAL de la empresa de la sesión con sus riesgos. Uno que no existe o es de otra empresa es un 404 (la API responde igual).
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
  const retorno = `/auth/login?retorno=${encodeURIComponent(`/e/${slug}/activos/${id}`)}`;
  const r = await cargarActivo({ ...base, id });
  if (r.tipo === 'ingresar') redirect(retorno);
  if (r.tipo === 'sin_permiso') return <PantallaSinPermiso empresa={empresa} persona={persona} activo="activos" />;
  if (r.tipo === 'no_encontrado') notFound();
  if (r.tipo !== 'ok') throw new Error('No se pudo cargar el activo');
  // El aviso previo al retiro solo lo pide quien puede retirar (la API decide de verdad).
  let avisoRetiro: AvisoRetiroActivo | null = null;
  if (persona.roles.includes('administrador_sig') && r.datos.estado === 'vigente') {
    const a = await cargarAvisoRetiroActivo({ ...base, id });
    if (a.tipo === 'ingresar') redirect(retorno);
    if (a.tipo === 'ok') avisoRetiro = a.datos;
  }
  const directorio = await cargarDirectorio(base);
  if (directorio.tipo === 'ingresar') redirect(retorno);
  return <PantallaActivoDetalle empresa={empresa} persona={persona} activo={r.datos} personas={directorio.tipo === 'ok' ? directorio.datos : []} avisoRetiro={avisoRetiro} aviso={leerAvisoEscritura(parametros)} />;
}
