import type { Rol } from '../api/tipos';
import type { PersonaDirectorio } from '../documentos/tipos';
import { es } from '../i18n/es-EC';
import type { Empresa } from '../marca/tipos';

// Piezas comunes de las pantallas de auditoría interna (ADR 040).
export const t = es.auditoria;
export const enlaceClase = 'inline-flex min-h-[var(--sig-density-target-min)] items-center text-sm font-medium text-primary underline';
export const dia = (iso: string): string => iso.slice(0, 10);

export interface PersonaSesion {
  readonly nombre: string;
  readonly roles: readonly Rol[];
}
/** Quien administra el SIG escribe todo; las demás personas consultan (y quien audita, ejecuta en las suyas). */
export const esAdministrador = (p: PersonaSesion): boolean => p.roles.includes('administrador_sig');

export const nombreDe = (personas: readonly PersonaDirectorio[], id: string | null): string => {
  if (id === null) return '—';
  const p = personas.find((x) => x.id === id);
  return p ? (p.activa ? p.nombre : `${p.nombre} (${t.personaDeBaja.toLowerCase()})`) : t.personaDeBaja;
};

export const Campo = ({ id, etiqueta, ayuda, children, ancho }: { id: string; etiqueta: string; ayuda?: string; children: React.ReactNode; ancho?: boolean }) => (
  <div className={`flex flex-col gap-1.5${ancho ? ' md:col-span-2' : ''}`}>
    <label htmlFor={id} className="text-sm font-medium text-fg">
      {etiqueta}
    </label>
    {children}
    {ayuda ? (
      <p id={`${id}-ayuda`} className="text-sm text-fg-muted">
        {ayuda}
      </p>
    ) : null}
  </div>
);

/** Navegación de la sección, con palabras (no solo color) y la página actual marcada. */
export const NavegacionAuditoria = ({ empresa, actual, auditoriaId }: { empresa: Empresa; actual: 'panel' | 'procesos' | 'programa' | 'planificacion' | 'ejecucion' | 'informe'; auditoriaId?: string }) => {
  const base = `/e/${empresa.id}/auditoria`;
  const enlaces: { clave: keyof typeof t.navegacion; href: string; visible: boolean }[] = [
    { clave: 'panel', href: base, visible: true },
    { clave: 'procesos', href: `${base}/procesos`, visible: true },
    { clave: 'planificacion', href: `${base}/auditorias/${auditoriaId}`, visible: auditoriaId !== undefined },
    { clave: 'ejecucion', href: `${base}/auditorias/${auditoriaId}/ejecucion`, visible: auditoriaId !== undefined },
    { clave: 'informe', href: `${base}/auditorias/${auditoriaId}/informe`, visible: auditoriaId !== undefined },
  ];
  return (
    <nav aria-label={t.titulo} className="mb-4">
      <ul className="flex flex-wrap gap-4">
        {enlaces
          .filter((e) => e.visible)
          .map((e) => (
            <li key={e.clave}>
              <a className={enlaceClase} href={e.href} aria-current={actual === e.clave ? 'page' : undefined}>
                {t.navegacion[e.clave]}
              </a>
            </li>
          ))}
      </ul>
    </nav>
  );
};
