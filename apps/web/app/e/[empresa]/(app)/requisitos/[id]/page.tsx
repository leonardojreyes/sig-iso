import { notFound } from 'next/navigation';
import { requisitoDe } from '../../../../../../src/datos-demo';
import { obtenerEmpresa } from '../../../../../../src/empresas';
import { PantallaDetalleRequisito } from '../../../../../../src/pantallas/detalle-requisito';

export default async function Page({ params }: { params: Promise<{ empresa: string; id: string }> }) {
  const { empresa: idEmpresa, id } = await params;
  const empresa = obtenerEmpresa(idEmpresa);
  const requisito = empresa ? requisitoDe(empresa.id, id) : undefined;
  if (!empresa || !requisito) notFound();
  return <PantallaDetalleRequisito empresa={empresa} requisito={requisito} />;
}
