import type { ReactNode } from 'react';
import { empresaActual } from '../../../../src/marca/servidor';
import { EnvolturaEmpresa } from '../../../../src/pantallas/envoltura-empresa';

// Todas las pantallas internas de una empresa: marca REAL de la sesión, acotada a su contenedor.
export default async function EmpresaLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ empresa: string }>;
}) {
  const empresa = await empresaActual((await params).empresa);
  return <EnvolturaEmpresa empresa={empresa}>{children}</EnvolturaEmpresa>;
}
