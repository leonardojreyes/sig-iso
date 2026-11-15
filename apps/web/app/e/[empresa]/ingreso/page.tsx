import { notFound } from 'next/navigation';
import { leerErrorIngreso } from '../../../../src/auth/errores-ingreso';
import { MARCA_GENERICA } from '../../../../src/marca/generica';
import { esIdEmpresa } from '../../../../src/marca/tipos';
import { PantallaIngreso } from '../../../../src/pantallas/ingreso';

// Sin sesión no se conoce la marca de ninguna empresa (y no se revela cuáles existen): pantalla genérica del producto. Tras ingresar,
// la persona vuelve a la portada, que decide: si pertenece a varias empresas elige con cuál va a trabajar, y si pertenece a una entra
// directo a ella. (La empresa de la dirección ya no decide adónde se vuelve: una persona de varias empresas daría 404 en las demás.)
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const slug = (await params).empresa;
  if (!esIdEmpresa(slug)) notFound();
  return (
    <PantallaIngreso
      empresa={MARCA_GENERICA}
      retorno="/"
      error={leerErrorIngreso(await searchParams)}
    />
  );
}
