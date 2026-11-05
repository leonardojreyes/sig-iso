import type { ReactNode } from 'react';
import { LayoutDashboard, ListChecks } from 'lucide-react';
import { Avatar } from '@sig/ui';
import type { Empresa } from '../empresas';
import { es } from '../i18n/es-EC';
import { SelectorTema } from './selector-tema';

/** Logo de la empresa: imagen si existe, monograma si no (el logo real llega con la configuración por empresa). */
/** Solo rutas propias o `https:`; cualquier otra cosa se descarta y se muestra el monograma. */
export const logoSeguro = (url: string | undefined): string | undefined =>
  url && (/^\/(?!\/)/.test(url) || /^https:\/\//i.test(url)) ? url : undefined;

export const LogoEmpresa = ({ empresa }: { empresa: Empresa }) =>
  logoSeguro(empresa.logoUrl) ? (
    <img src={logoSeguro(empresa.logoUrl)} referrerPolicy="no-referrer" alt={`${es.marca.sinLogo} ${empresa.nombre}`} className="h-8 w-auto" />
  ) : (
    <span className="flex items-center gap-2 font-semibold text-fg">
      <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-on-primary">
        {empresa.nombre[0]}
      </span>
      {empresa.nombre}
    </span>
  );

const enlace = 'flex min-h-[var(--sig-density-target-min)] items-center gap-3 rounded-md px-3 text-sm font-medium text-fg hover:bg-surface-muted aria-[current=page]:bg-primary-subtle aria-[current=page]:text-on-primary-subtle';

/** Marco de aplicación: cabecera, navegación lateral y contenido principal. */
export const MarcoApp = ({ empresa, activo, children }: { empresa: Empresa; activo: 'panel' | 'requisitos'; children: ReactNode }) => (
  <div className="min-h-screen bg-bg">
    <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
      {es.app.saltar}
    </a>
    <header className="flex items-center justify-between border-b border-line bg-surface px-6 py-3">
      <LogoEmpresa empresa={empresa} />
      <div className="flex items-center gap-4">
        <SelectorTema />
        <Avatar nombre="Ana Pérez" />
      </div>
    </header>
    <div className="grid grid-cols-1 md:grid-cols-[14rem_1fr]">
      <nav aria-label={es.nav.principal} className="border-b border-line bg-surface p-3 md:min-h-[calc(100vh-4rem)] md:border-b-0 md:border-r">
        <ul className="flex gap-1 md:flex-col">
          <li>
            <a className={enlace} href={`/e/${empresa.id}/panel`} aria-current={activo === 'panel' ? 'page' : undefined}>
              <LayoutDashboard aria-hidden="true" className="size-5" />
              {es.nav.panel}
            </a>
          </li>
          <li>
            <a className={enlace} href={`/e/${empresa.id}/requisitos`} aria-current={activo === 'requisitos' ? 'page' : undefined}>
              <ListChecks aria-hidden="true" className="size-5" />
              {es.nav.requisitos}
            </a>
          </li>
        </ul>
      </nav>
      <main id="contenido" className="p-6">{children}</main>
    </div>
  </div>
);
