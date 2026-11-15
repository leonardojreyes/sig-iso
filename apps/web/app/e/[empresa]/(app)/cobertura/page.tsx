import { redirect } from 'next/navigation';
import { crearDependencias } from '../../../../../src/auth/dependencias';
import { cargarCobertura } from '../../../../../src/certificacion/cargar';
import { leerFiltroCobertura } from '../../../../../src/certificacion/filtros-cobertura';
import { contextoActual } from '../../../../../src/marca/servidor';
import { PantallaCobertura } from '../../../../../src/pantallas/cobertura';
import { PantallaSinPermiso } from '../../../../../src/pantallas/sin-permiso';

// Cobertura documental REAL de la empresa de la sesión, pedida a la API con el token de la sesión.
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const slug = (await params).empresa;
  const { empresa, persona, acceso } = await contextoActual(slug);
  const { filtros, invalidos } = leerFiltroCobertura(await searchParams);
  const deps = crearDependencias(process.env);
  const r = await cargarCobertura({ acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn, ...(filtros.norma ? { norma: filtros.norma } : {}) });
  if (r.tipo === 'ingresar') redirect(`/auth/login?retorno=${encodeURIComponent(`/e/${slug}/cobertura`)}`);
  if (r.tipo === 'sin_permiso') return <PantallaSinPermiso empresa={empresa} persona={persona} activo="cobertura" />;
  if (r.tipo === 'no_disponible') throw new Error('No se pudo cargar la cobertura');
  return <PantallaCobertura empresa={empresa} persona={persona} cobertura={r.datos} filtros={filtros} filtrosInvalidos={invalidos} />;
}
