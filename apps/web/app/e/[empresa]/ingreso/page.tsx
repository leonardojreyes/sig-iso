import { notFound } from 'next/navigation';
import { MARCA_GENERICA } from '../../../../src/marca/generica';
import { esIdEmpresa } from '../../../../src/marca/tipos';
import { PantallaIngreso } from '../../../../src/pantallas/ingreso';

// Sin sesión no se conoce la marca de ninguna empresa (y no se revela cuáles existen): pantalla genérica del producto.
export default async function Page({ params }: { params: Promise<{ empresa: string }> }) {
  if (!esIdEmpresa((await params).empresa)) notFound();
  return <PantallaIngreso empresa={MARCA_GENERICA} />;
}
