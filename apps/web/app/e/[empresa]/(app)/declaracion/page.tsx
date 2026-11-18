import { redirect } from 'next/navigation';
import { crearDependencias } from '../../../../../src/auth/dependencias';
import { cargarDeclaracion, cargarMotivosDeclaracion, cargarVersionesDeclaracion } from '../../../../../src/certificacion/cargar';
import { leerAvisoEscritura } from '../../../../../src/certificacion/escribir';
import { contextoActual } from '../../../../../src/marca/servidor';
import { PantallaDeclaracion } from '../../../../../src/pantallas/declaracion';
import { PantallaSinPermiso } from '../../../../../src/pantallas/sin-permiso';

// Declaración de Aplicabilidad REAL de la empresa de la sesión (borrador derivado y versiones aprobadas), pedida a la API con el token
// de la sesión. Nada se decide aquí.
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const slug = (await params).empresa;
  const { empresa, persona, acceso } = await contextoActual(slug);
  const deps = crearDependencias(process.env);
  const base = { acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn };
  const [d, v] = await Promise.all([cargarDeclaracion(base), cargarVersionesDeclaracion(base)]);
  const ingresar = `/auth/login?retorno=${encodeURIComponent(`/e/${slug}/declaracion`)}`;
  if (d.tipo === 'ingresar' || v.tipo === 'ingresar') redirect(ingresar);
  if (d.tipo === 'sin_permiso' || v.tipo === 'sin_permiso') return <PantallaSinPermiso empresa={empresa} persona={persona} activo="declaracion" />;
  if (d.tipo === 'no_disponible' || v.tipo === 'no_disponible') throw new Error('No se pudo cargar la declaración');
  // Los motivos con su versión (para cambiarlos o quitarlos) solo se piden a quien administra; la API decide de verdad.
  let motivos: Awaited<ReturnType<typeof cargarMotivosDeclaracion>> = { tipo: 'ok', datos: [] };
  if (persona.roles.includes('administrador_sig')) {
    motivos = await cargarMotivosDeclaracion(base);
    if (motivos.tipo === 'ingresar') redirect(ingresar);
  }
  return <PantallaDeclaracion empresa={empresa} persona={persona} declaracion={d.datos} versiones={v.datos} motivos={motivos.tipo === 'ok' ? motivos.datos : null} aviso={leerAvisoEscritura(await searchParams)} />;
}
