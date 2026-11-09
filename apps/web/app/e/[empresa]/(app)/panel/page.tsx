import { contextoActual } from '../../../../../src/marca/servidor';
import { PantallaPanelPendiente } from '../../../../../src/pantallas/panel-pendiente';

export default async function Page({ params }: { params: Promise<{ empresa: string }> }) {
  const { empresa, persona } = await contextoActual((await params).empresa);
  return <PantallaPanelPendiente empresa={empresa} persona={persona.nombre} />;
}
