import { notFound, redirect } from 'next/navigation';
import { crearDependencias } from '../../../../../../src/auth/dependencias';
import { cargarAvisoRetiroRiesgo, cargarControles, cargarDiagnostico, cargarRiesgo } from '../../../../../../src/certificacion/cargar';
import { leerAvisoEscritura } from '../../../../../../src/certificacion/escribir';
import { contextoActual } from '../../../../../../src/marca/servidor';
import { cargarPersonas } from '../../../../../../src/personas/cargar';
import { PantallaRiesgoDetalle, type OpcionAnexo, type OpcionControl } from '../../../../../../src/pantallas/riesgo-detalle';
import type { OpcionPersona } from '../../../../../../src/pantallas/riesgos';
import { PantallaSinPermiso } from '../../../../../../src/pantallas/sin-permiso';
import { UUID } from '../../../../../../src/validacion/patrones';

// Un riesgo REAL de la empresa de la sesión con los controles que lo tratan. Uno que no existe o es de otra empresa es un 404 (la API
// responde igual en los dos casos).
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { empresa: slug, id } = await params;
  if (!UUID.test(id)) notFound();
  const { empresa, persona, acceso } = await contextoActual(slug);
  const parametros = await searchParams;
  const deps = crearDependencias(process.env);
  const base = { acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn };
  const retorno = `/auth/login?retorno=${encodeURIComponent(`/e/${slug}/riesgos/${id}`)}`;

  const r = await cargarRiesgo({ ...base, id });
  if (r.tipo === 'ingresar') redirect(retorno);
  if (r.tipo === 'sin_permiso') return <PantallaSinPermiso empresa={empresa} persona={persona} activo="riesgos" />;
  if (r.tipo === 'no_encontrado') notFound();
  if (r.tipo === 'no_disponible') throw new Error('No se pudo cargar el riesgo');

  // Lo que solo usa quien administra se pide solo a quien administra (la API decide de verdad): el aviso previo al retiro, los controles
  // y los controles del Anexo A con los que vincular, y las personas que pueden responder.
  let aviso = null;
  let controlesDisponibles: OpcionControl[] = [];
  let opcionesAnexo: OpcionAnexo[] = [];
  let personas: OpcionPersona[] = [];
  if (persona.roles.includes('administrador_sig')) {
    if (r.datos.estado === 'vigente') {
      const a = await cargarAvisoRetiroRiesgo({ ...base, id });
      if (a.tipo === 'ingresar') redirect(retorno);
      if (a.tipo === 'ok') aviso = a.datos;
    }
    const c = await cargarControles({ ...base, filtros: {} });
    if (c.tipo === 'ingresar') redirect(retorno);
    if (c.tipo === 'ok') controlesDisponibles = c.datos.controles.filter((x) => x.estado === 'vigente').map((x) => ({ id: x.id, codigo: x.codigo, nombre: x.nombre }));
    const d = await cargarDiagnostico({ ...base, filtros: {} });
    if (d.tipo === 'ingresar') redirect(retorno);
    if (d.tipo === 'ok') opcionesAnexo = d.datos.filas.filter((f) => f.tipo === 'control').map((f) => ({ libreriaCodigo: f.libreriaCodigo, idEstable: f.idEstable, titulo: f.titulo }));
    const p = await cargarPersonas(base);
    if (p.tipo === 'ingresar') redirect(retorno);
    if (p.tipo === 'ok') personas = p.datos.personas.filter((x) => x.rol !== null && x.bajaEn === null).map((x) => ({ id: x.id, nombre: x.nombre }));
  }
  return <PantallaRiesgoDetalle empresa={empresa} persona={persona} riesgo={r.datos} aviso={aviso} controlesDisponibles={controlesDisponibles} opcionesAnexo={opcionesAnexo} personas={personas} avisoEscritura={leerAvisoEscritura(parametros)} />;
}
