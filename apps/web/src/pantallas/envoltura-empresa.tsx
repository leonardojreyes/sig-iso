import type { ReactNode } from 'react';
import { cssDeEmpresa, type Empresa } from '../marca/tipos';

/** Contenedor de UNA empresa: aplica su marca (CSS acotado por `[data-empresa]`) y nada de otra. */
export const EnvolturaEmpresa = ({ empresa, children }: { empresa: Empresa; children: ReactNode }) => (
  <div data-empresa={empresa.id}>
    <style dangerouslySetInnerHTML={{ __html: cssDeEmpresa(empresa) }} />
    {children}
  </div>
);
