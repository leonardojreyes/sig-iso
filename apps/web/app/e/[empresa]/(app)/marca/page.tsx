import { crearDependencias } from '../../../../../src/auth/dependencias';
import { leerAvisoMarca } from '../../../../../src/marca/editar';
import { cargarMarcaDetalle } from '../../../../../src/marca/marca';
import { contextoActual } from '../../../../../src/marca/servidor';
import { PantallaMarca } from '../../../../../src/pantallas/marca';

// Marca de la empresa de la sesión (color y logo), pedida a la API con el token de la sesión. Solo el administrador SIG ve el formulario.
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const slug = (await params).empresa;
  const { empresa, persona, acceso } = await contextoActual(slug);
  const deps = crearDependencias(process.env);
  const marca = await cargarMarcaDetalle({ acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn });
  if (!marca) throw new Error('No se pudo cargar la marca de la empresa');
  return <PantallaMarca empresa={empresa} persona={persona} marca={marca} aviso={leerAvisoMarca(await searchParams)} />;
}
