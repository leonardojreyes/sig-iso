import { redirect } from 'next/navigation';
import { crearDependencias } from '../../../../../src/auth/dependencias';
import { leerAvisoEscritura } from '../../../../../src/certificacion/escribir';
import { cargarCriterios } from '../../../../../src/criterios/cargar';
import { contextoActual } from '../../../../../src/marca/servidor';
import { PantallaCriterios } from '../../../../../src/pantallas/criterios';
import { PantallaSinPermiso } from '../../../../../src/pantallas/sin-permiso';

// Criterios de evaluación REALES de la empresa de la sesión (o la escala por omisión, rotulada), con la matriz 5 × 5.
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
  const r = await cargarCriterios({ acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn });
  if (r.tipo === 'ingresar') redirect(`/auth/login?retorno=${encodeURIComponent(`/e/${slug}/criterios`)}`);
  if (r.tipo === 'sin_permiso') return <PantallaSinPermiso empresa={empresa} persona={persona} activo="criterios" />;
  if (r.tipo !== 'ok') throw new Error('No se pudieron cargar los criterios');
  return <PantallaCriterios empresa={empresa} persona={persona} criterios={r.datos} aviso={leerAvisoEscritura(parametros)} />;
}
