import { notFound } from 'next/navigation';
import { leerErrorIngreso } from '../../../../src/auth/errores-ingreso';
import { MARCA_GENERICA } from '../../../../src/marca/generica';
import { esIdEmpresa } from '../../../../src/marca/tipos';
import { PantallaIngreso } from '../../../../src/pantallas/ingreso';

// Sin sesión no se conoce la marca de ninguna empresa (y no se revela cuáles existen): pantalla genérica del producto. Tras ingresar,
// la persona vuelve al listado de la empresa de la dirección (el proxy comprueba que sea la suya).
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
      retorno={`/e/${slug}/requisitos`}
      error={leerErrorIngreso(await searchParams)}
    />
  );
}
