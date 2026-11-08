import { notFound } from 'next/navigation';
import { requisitoDe } from '../../../../../../src/datos-demo';
import { empresaActual } from '../../../../../../src/marca/servidor';
import { PantallaDetalleRequisito } from '../../../../../../src/pantallas/detalle-requisito';

export default async function Page({ params }: { params: Promise<{ empresa: string; id: string }> }) {
  const { empresa: slug, id } = await params;
  const empresa = await empresaActual(slug);
  // El detalle real llega con el listado real (10.6); hasta entonces no hay registros que mostrar.
  const requisito = requisitoDe(empresa.id, id);
  if (!requisito) notFound();
  return <PantallaDetalleRequisito empresa={empresa} requisito={requisito} />;
}
