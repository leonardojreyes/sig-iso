import { empresaActual } from '../../../../../src/marca/servidor';
import { PantallaPanelPendiente } from '../../../../../src/pantallas/panel-pendiente';

export default async function Page({ params }: { params: Promise<{ empresa: string }> }) {
  return <PantallaPanelPendiente empresa={await empresaActual((await params).empresa)} />;
}
