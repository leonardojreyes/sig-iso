import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { cssDeEmpresa, obtenerEmpresa } from '../../../src/empresas';

export default async function EmpresaLayout({ children, params }: { children: ReactNode; params: Promise<{ empresa: string }> }) {
  const empresa = obtenerEmpresa((await params).empresa);
  if (!empresa) notFound();
  return (
    <div data-empresa={empresa.id}>
      <style dangerouslySetInnerHTML={{ __html: cssDeEmpresa(empresa) }} />
      {children}
    </div>
  );
}
