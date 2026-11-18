import type { ReactNode } from 'react';
import { BookMarked, ClipboardCheck, Palette, FileCheck2, FileSignature, FileText, LayoutDashboard, ListChecks, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { Avatar, Button, Select } from '@sig/ui';
import type { Empresa } from '../empresas';
import { es } from '../i18n/es-EC';
import { SelectorTema } from './selector-tema';

/** Logo de la empresa: imagen si existe, monograma si no (el logo real llega con la configuración por empresa). */
/** Solo un archivo de imagen bajo `/logos/` o una dirección `https:`; cualquier otra cosa se descarta y se muestra el monograma. */
export const logoSeguro = (url: string | undefined): string | undefined =>
  url && (/^\/logos\/[A-Za-z0-9._-]{1,100}\.(png|svg|jpe?g|webp)$/.test(url) || /^https:\/\//i.test(url)) ? url : undefined;

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

/**
 * Selector de empresa para quien pertenece a varias (un consultor, ADR 035). Es un formulario de la web: no lleva identificadores,
 * solo el slug elegido, y la API decide si la persona pertenece a esa empresa. No se muestra a quien tiene una sola.
 */
export const SelectorEmpresa = ({ empresa }: { empresa: Empresa }) => {
  const otras = empresa.otrasEmpresas ?? [];
  if (otras.length === 0) return null;
  return (
    <form method="post" action={`/e/${empresa.id}/empresa/cambiar`} className="flex items-center gap-2">
      <label htmlFor="selector-empresa" className="sr-only">
        {es.empresas.cambiarAria}
      </label>
      <Select id="selector-empresa" name="empresa" defaultValue={otras[0]!.slug}>
        {otras.map((o) => (
          <option key={o.slug} value={o.slug}>
            {o.nombre}
          </option>
        ))}
      </Select>
      <Button type="submit">{es.empresas.cambiar}</Button>
    </form>
  );
};

/** Marco de aplicación: cabecera, navegación lateral y contenido principal. */
/** `persona` es el nombre de quien tiene sesión; solo las pantallas de demostración usan el valor por omisión. */
export const MarcoApp = ({ empresa, activo, persona = 'Ana Pérez', children }: { empresa: Empresa; activo: 'panel' | 'requisitos' | 'diagnostico' | 'alcance' | 'controles' | 'riesgos' | 'cobertura' | 'declaracion' | 'normas' | 'marca' | 'personas'; persona?: string; children: ReactNode }) => (
  <div className="min-h-screen bg-bg">
    <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
      {es.app.saltar}
    </a>
    <header className="flex items-center justify-between border-b border-line bg-surface px-6 py-3">
      <LogoEmpresa empresa={empresa} />
      <div className="flex items-center gap-4">
        <SelectorEmpresa empresa={empresa} />
        <SelectorTema />
        <Avatar nombre={persona} />
        {/* Cerrar sesión cambia estado: es un POST (con verificación de Origin), nunca un enlace. */}
        <form method="post" action="/auth/logout">
          <Button type="submit" variante="secondary">
            {es.sesion.cerrar}
          </Button>
        </form>
      </div>
    </header>
    <div className="grid grid-cols-1 md:grid-cols-[14rem_1fr]">
      <nav aria-label={es.nav.principal} className="border-b border-line bg-surface p-3 md:min-h-[calc(100vh-4rem)] md:border-b-0 md:border-r">
        <ul className="flex flex-wrap gap-1 md:flex-col">
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
          <li>
            <a className={enlace} href={`/e/${empresa.id}/diagnostico`} aria-current={activo === 'diagnostico' ? 'page' : undefined}>
              <ClipboardCheck aria-hidden="true" className="size-5" />
              {es.nav.diagnostico}
            </a>
          </li>
          <li>
            <a className={enlace} href={`/e/${empresa.id}/alcance`} aria-current={activo === 'alcance' ? 'page' : undefined}>
              <FileText aria-hidden="true" className="size-5" />
              {es.nav.alcance}
            </a>
          </li>
          <li>
            <a className={enlace} href={`/e/${empresa.id}/controles`} aria-current={activo === 'controles' ? 'page' : undefined}>
              <ShieldCheck aria-hidden="true" className="size-5" />
              {es.nav.controles}
            </a>
          </li>
          <li>
            <a className={enlace} href={`/e/${empresa.id}/riesgos`} aria-current={activo === 'riesgos' ? 'page' : undefined}>
              <ShieldAlert aria-hidden="true" className="size-5" />
              {es.nav.riesgos}
            </a>
          </li>
          <li>
            <a className={enlace} href={`/e/${empresa.id}/cobertura`} aria-current={activo === 'cobertura' ? 'page' : undefined}>
              <FileCheck2 aria-hidden="true" className="size-5" />
              {es.nav.cobertura}
            </a>
          </li>
          <li>
            <a className={enlace} href={`/e/${empresa.id}/declaracion`} aria-current={activo === 'declaracion' ? 'page' : undefined}>
              <FileSignature aria-hidden="true" className="size-5" />
              {es.nav.declaracion}
            </a>
          </li>
          <li>
            <a className={enlace} href={`/e/${empresa.id}/normas`} aria-current={activo === 'normas' ? 'page' : undefined}>
              <BookMarked aria-hidden="true" className="size-5" />
              {es.nav.normas}
            </a>
          </li>
          <li>
            <a className={enlace} href={`/e/${empresa.id}/marca`} aria-current={activo === 'marca' ? 'page' : undefined}>
              <Palette aria-hidden="true" className="size-5" />
              {es.nav.marca}
            </a>
          </li>
          <li>
            <a className={enlace} href={`/e/${empresa.id}/personas`} aria-current={activo === 'personas' ? 'page' : undefined}>
              <Users aria-hidden="true" className="size-5" />
              {es.nav.personas}
            </a>
          </li>
        </ul>
      </nav>
      <main id="contenido" className="p-6">{children}</main>
    </div>
  </div>
);
