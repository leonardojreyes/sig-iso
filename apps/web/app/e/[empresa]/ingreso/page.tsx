import { notFound } from 'next/navigation';
import { obtenerEmpresa } from '../../../../src/empresas';
import { PantallaIngreso } from '../../../../src/pantallas/ingreso';

export default async function Page({ params }: { params: Promise<{ empresa: string }> }) {
  const empresa = obtenerEmpresa((await params).empresa);
  if (!empresa) notFound();
  return <PantallaIngreso empresa={empresa} />;
}
