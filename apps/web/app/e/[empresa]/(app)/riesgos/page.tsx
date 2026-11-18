import { redirect } from 'next/navigation';
import { crearDependencias } from '../../../../../src/auth/dependencias';
import { cargarRiesgos } from '../../../../../src/certificacion/cargar';
import { leerAvisoEscritura } from '../../../../../src/certificacion/escribir';
import { leerFiltrosRiesgos } from '../../../../../src/certificacion/filtros-riesgos';
import { contextoActual } from '../../../../../src/marca/servidor';
import { cargarPersonas } from '../../../../../src/personas/cargar';
import { PantallaRiesgos, type OpcionPersona } from '../../../../../src/pantallas/riesgos';
import { PantallaSinPermiso } from '../../../../../src/pantallas/sin-permiso';

// Riesgos REALES de la empresa de la sesión, pedidos a la API con el token de la sesión.
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
  const { filtros, invalidos } = leerFiltrosRiesgos(parametros);
  const deps = crearDependencias(process.env);
  const base = { acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn };
  const retorno = `/auth/login?retorno=${encodeURIComponent(`/e/${slug}/riesgos`)}`;
  const r = await cargarRiesgos({ ...base, filtros });
  if (r.tipo === 'ingresar') redirect(retorno);
  if (r.tipo === 'sin_permiso') return <PantallaSinPermiso empresa={empresa} persona={persona} activo="riesgos" />;
  if (r.tipo === 'no_disponible') throw new Error('No se pudieron cargar los riesgos');

  // Las personas que pueden responder por un riesgo solo se piden a quien administra (la API decide de verdad).
  let personas: OpcionPersona[] = [];
  if (persona.roles.includes('administrador_sig')) {
    const p = await cargarPersonas(base);
    if (p.tipo === 'ingresar') redirect(retorno);
    if (p.tipo === 'ok') personas = p.datos.personas.filter((x) => x.rol !== null && x.bajaEn === null).map((x) => ({ id: x.id, nombre: x.nombre }));
  }
  return <PantallaRiesgos empresa={empresa} persona={persona} riesgos={r.datos} personas={personas} filtros={filtros} filtrosInvalidos={invalidos} aviso={leerAvisoEscritura(parametros)} />;
}
