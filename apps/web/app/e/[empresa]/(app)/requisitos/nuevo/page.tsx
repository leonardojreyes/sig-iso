import { notFound } from 'next/navigation';
import { obtenerEmpresa } from '../../../../../../src/empresas';
import { PantallaFormularioRequisito } from '../../../../../../src/pantallas/formulario-requisito';

export default async function Page({ params }: { params: Promise<{ empresa: string }> }) {
  const empresa = obtenerEmpresa((await params).empresa);
  if (!empresa) notFound();
  return <PantallaFormularioRequisito empresa={empresa} />;
}
