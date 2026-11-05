import { notFound } from 'next/navigation';
import { obtenerEmpresa } from '../../../../../src/empresas';
import { PantallaPanel } from '../../../../../src/pantallas/panel';

export default async function Page({ params }: { params: Promise<{ empresa: string }> }) {
  const empresa = obtenerEmpresa((await params).empresa);
  if (!empresa) notFound();
  return <PantallaPanel empresa={empresa} />;
}
