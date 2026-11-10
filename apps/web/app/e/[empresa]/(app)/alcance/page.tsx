import { redirect } from 'next/navigation';
import { crearDependencias } from '../../../../../src/auth/dependencias';
import { cargarAlcances } from '../../../../../src/certificacion/cargar';
import { leerAvisoEscritura } from '../../../../../src/certificacion/escribir';
import { contextoActual } from '../../../../../src/marca/servidor';
import { PantallaAlcance } from '../../../../../src/pantallas/alcance';
import { PantallaSinPermiso } from '../../../../../src/pantallas/sin-permiso';

// Alcance REAL por norma adoptada, pedido a la API con el token de la sesión.
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
  const deps = crearDependencias(process.env);
  const r = await cargarAlcances({ acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn });
  if (r.tipo === 'ingresar') redirect(`/auth/login?retorno=${encodeURIComponent(`/e/${slug}/alcance`)}`);
  if (r.tipo === 'sin_permiso') return <PantallaSinPermiso empresa={empresa} persona={persona} activo="alcance" />;
  if (r.tipo === 'no_disponible') throw new Error('No se pudo cargar el alcance');
  return <PantallaAlcance empresa={empresa} persona={persona} alcances={r.datos} aviso={leerAvisoEscritura(parametros)} />;
}
