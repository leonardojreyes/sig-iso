import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { crearDependencias } from '../src/auth/dependencias';
import { leerErrorIngreso } from '../src/auth/errores-ingreso';
import { rutaDeInicio } from '../src/auth/inicio';
import { PantallaInicio } from '../src/pantallas/inicio';

// Portada: con sesión válida lleva al listado de la empresa de la persona; sin ella, ofrece ingresar (y avisa si el ingreso falló).
export const dynamic = 'force-dynamic';

export default async function Inicio({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let destino: string | null = null;
  try {
    destino = await rutaDeInicio((await headers()).get('cookie'), crearDependencias(process.env));
  } catch {
    destino = null; // sin configuración o sin API: se muestra la portada (el ingreso informará si no está disponible)
  }
  if (destino) redirect(destino);
  return <PantallaInicio error={leerErrorIngreso(await searchParams)} />;
}
