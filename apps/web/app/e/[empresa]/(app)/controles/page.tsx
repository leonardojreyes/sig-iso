import { redirect } from 'next/navigation';
import { crearDependencias } from '../../../../../src/auth/dependencias';
import { cargarControles, cargarDiagnostico } from '../../../../../src/certificacion/cargar';
import { leerAvisoEscritura } from '../../../../../src/certificacion/escribir';
import { leerFiltrosControles } from '../../../../../src/certificacion/filtros-controles';
import { contextoActual } from '../../../../../src/marca/servidor';
import { PantallaControles, type OpcionEntrada } from '../../../../../src/pantallas/controles';
import { PantallaSinPermiso } from '../../../../../src/pantallas/sin-permiso';

// Marco de controles REAL de la empresa de la sesión, pedido a la API con el token de la sesión.
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
  const { filtros, invalidos } = leerFiltrosControles(parametros);
  const deps = crearDependencias(process.env);
  const base = { acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn };
  const r = await cargarControles({ ...base, filtros });
  if (r.tipo === 'ingresar') redirect(`/auth/login?retorno=${encodeURIComponent(`/e/${slug}/controles`)}`);
  if (r.tipo === 'sin_permiso') return <PantallaSinPermiso empresa={empresa} persona={persona} activo="controles" />;
  if (r.tipo === 'no_disponible') throw new Error('No se pudo cargar el marco de controles');

  // Las entradas que se pueden relacionar solo se piden a quien puede gestionar (la API decide de verdad); salen del diagnóstico.
  let opciones: OpcionEntrada[] = [];
  if (persona.roles.includes('administrador_sig')) {
    const d = await cargarDiagnostico({ ...base, filtros: {} });
    if (d.tipo === 'ingresar') redirect(`/auth/login?retorno=${encodeURIComponent(`/e/${slug}/controles`)}`);
    if (d.tipo === 'ok') opciones = d.datos.filas.map((f) => ({ libreriaCodigo: f.libreriaCodigo, idEstable: f.idEstable, titulo: f.titulo, tipo: f.tipo }));
  }
  return <PantallaControles empresa={empresa} persona={persona} marco={r.datos} opciones={opciones} filtros={filtros} filtrosInvalidos={invalidos} aviso={leerAvisoEscritura(parametros)} />;
}
