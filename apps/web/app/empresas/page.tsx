import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { crearDependencias } from '../../src/auth/dependencias';
import { leerAvisoCambio } from '../../src/cambio-empresa/cambiar';
import { cargarEleccion } from '../../src/cambio-empresa/eleccion';
import { PantallaEleccionEmpresa } from '../../src/pantallas/elegir-empresa';

// Al entrar, quien pertenece a varias empresas elige con cuál va a trabajar (ADR 035). Las empresas salen de la API con el token de la
// sesión. Sin sesión, a ingresar; con una sola empresa, directo a ella.
export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const eleccion = await cargarEleccion((await headers()).get('cookie'), crearDependencias(process.env));
  if (eleccion.tipo === 'ingresar') redirect('/auth/login?retorno=%2Fempresas');
  if (eleccion.tipo === 'una') redirect(`/e/${eleccion.slug}/requisitos`);
  if (eleccion.tipo === 'no_disponible') throw new Error('No se pudieron cargar las empresas de la persona');
  return <PantallaEleccionEmpresa empresas={eleccion.empresas} aviso={leerAvisoCambio(await searchParams)} />;
}
