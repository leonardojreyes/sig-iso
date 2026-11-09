import { redirect } from 'next/navigation';
import { crearDependencias } from '../../../../../src/auth/dependencias';
import { contextoActual } from '../../../../../src/marca/servidor';
import { PantallaListadoRequisitos } from '../../../../../src/pantallas/listado-requisitos';
import { cargarListado } from '../../../../../src/requisitos/cargar-listado';
import { leerFiltros } from '../../../../../src/requisitos/filtros';

// Listado REAL: las entradas de las librerías que la empresa de la sesión adoptó, pedidas a la API con el token de la sesión.
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const slug = (await params).empresa;
  const { empresa, persona, acceso } = await contextoActual(slug);
  const { filtros, invalidos } = leerFiltros(await searchParams);
  const deps = crearDependencias(process.env);
  const r = await cargarListado({ acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn, filtros });
  if (r.tipo === 'ingresar') redirect(`/auth/login?retorno=${encodeURIComponent(`/e/${slug}/requisitos`)}`);
  if (r.tipo === 'no_disponible') throw new Error('No se pudo cargar el listado de requisitos');
  return (
    <PantallaListadoRequisitos
      empresa={empresa}
      persona={persona}
      librerias={r.librerias}
      entradas={r.entradas}
      normasDisponibles={r.normasDisponibles}
      filtros={filtros}
      filtrosInvalidos={invalidos}
    />
  );
}
