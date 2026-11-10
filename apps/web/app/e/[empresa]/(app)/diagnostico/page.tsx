import { redirect } from 'next/navigation';
import { crearDependencias } from '../../../../../src/auth/dependencias';
import { cargarDiagnostico } from '../../../../../src/certificacion/cargar';
import { leerAvisoEscritura } from '../../../../../src/certificacion/escribir';
import { leerFiltrosDiagnostico } from '../../../../../src/certificacion/filtros';
import { contextoActual } from '../../../../../src/marca/servidor';
import { PantallaDiagnostico } from '../../../../../src/pantallas/diagnostico';
import { PantallaSinPermiso } from '../../../../../src/pantallas/sin-permiso';

// Diagnóstico REAL: las entradas de las librerías adoptadas con su evaluación y la madurez, pedidas a la API con el token de la sesión.
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
  const { filtros, invalidos } = leerFiltrosDiagnostico(parametros);
  const deps = crearDependencias(process.env);
  const r = await cargarDiagnostico({ acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn, filtros });
  if (r.tipo === 'ingresar') redirect(`/auth/login?retorno=${encodeURIComponent(`/e/${slug}/diagnostico`)}`);
  if (r.tipo === 'sin_permiso') return <PantallaSinPermiso empresa={empresa} persona={persona} activo="diagnostico" />;
  if (r.tipo === 'no_disponible') throw new Error('No se pudo cargar el diagnóstico');
  return <PantallaDiagnostico empresa={empresa} persona={persona} diagnostico={r.datos} filtros={filtros} filtrosInvalidos={invalidos} aviso={leerAvisoEscritura(parametros)} />;
}
