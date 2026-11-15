import { leerAvisoCambio } from '../../../../../src/cambio-empresa/cambiar';
import { contextoActual } from '../../../../../src/marca/servidor';
import { PantallaPanelPendiente } from '../../../../../src/pantallas/panel-pendiente';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { empresa, persona } = await contextoActual((await params).empresa);
  return <PantallaPanelPendiente empresa={empresa} persona={persona.nombre} aviso={leerAvisoCambio(await searchParams)} />;
}
