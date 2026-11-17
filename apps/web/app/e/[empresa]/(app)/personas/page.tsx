import { redirect } from 'next/navigation';
import { crearDependencias } from '../../../../../src/auth/dependencias';
import { leerAvisoEscritura } from '../../../../../src/certificacion/escribir';
import { contextoActual } from '../../../../../src/marca/servidor';
import { PantallaPersonas } from '../../../../../src/pantallas/personas';
import { PantallaSinPermiso } from '../../../../../src/pantallas/sin-permiso';
import { cargarPersonas } from '../../../../../src/personas/cargar';

// Personas y solicitudes de acceso REALES de la empresa de la sesión, pedidas a la API con el token de la sesión (ADR 036).
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
  const r = await cargarPersonas({ acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn });
  if (r.tipo === 'ingresar') redirect(`/auth/login?retorno=${encodeURIComponent(`/e/${slug}/personas`)}`);
  if (r.tipo === 'sin_permiso') return <PantallaSinPermiso empresa={empresa} persona={persona} activo="personas" />;
  if (r.tipo === 'no_disponible') throw new Error('No se pudo cargar las personas de la empresa');
  return <PantallaPersonas empresa={empresa} persona={persona} datos={r.datos} aviso={leerAvisoEscritura(await searchParams)} />;
}
