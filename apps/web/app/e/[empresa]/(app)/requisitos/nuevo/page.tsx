import { empresaActual } from '../../../../../../src/marca/servidor';
import { PantallaFormularioRequisito } from '../../../../../../src/pantallas/formulario-requisito';

export default async function Page({ params }: { params: Promise<{ empresa: string }> }) {
  return <PantallaFormularioRequisito empresa={await empresaActual((await params).empresa)} />;
}
