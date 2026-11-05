import type { ComponentProps, ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { cn } from '../cn';
import { textosUi } from '../i18n';

type Variante = 'primary' | 'secondary' | 'ghost' | 'danger';
const variantes: Record<Variante, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover',
  secondary: 'border border-line-strong bg-surface text-fg hover:bg-surface-muted',
  ghost: 'text-fg hover:bg-surface-muted',
  danger: 'bg-danger text-surface hover:opacity-90',
};

export const Button = ({ variante = 'primary', className, ...p }: ComponentProps<'button'> & { variante?: Variante }) => (
  <button
    className={cn(
      'inline-flex min-h-[var(--sig-density-control-height)] items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors',
      'disabled:cursor-not-allowed disabled:opacity-60',
      variantes[variante],
      className,
    )}
    {...p}
  />
);

const baseBoton =
  'inline-flex min-h-[var(--sig-density-control-height)] items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors';

/** Enlace con aspecto de botón: navegación real (`<a>`), sin anidar un botón dentro de un enlace. */
export const BotonEnlace = ({ variante = 'primary', className, ...p }: ComponentProps<'a'> & { variante?: Variante }) => (
  <a className={cn(baseBoton, variantes[variante], className)} {...p} />
);

type Tono = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
const tonos: Record<Tono, string> = {
  neutral: 'bg-neutral-status-subtle text-neutral-status',
  primary: 'bg-primary-subtle text-on-primary-subtle',
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  danger: 'bg-danger-subtle text-danger',
  info: 'bg-info-subtle text-info',
};

export const Badge = ({ tono = 'neutral', className, ...p }: ComponentProps<'span'> & { tono?: Tono }) => (
  <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', tonos[tono], className)} {...p} />
);

export const Card = ({ className, ...p }: ComponentProps<'section'>) => (
  <section className={cn('rounded-lg border border-line bg-surface p-5 shadow-sm', className)} {...p} />
);
export const CardTitle = ({ className, ...p }: ComponentProps<'h2'>) => (
  <h2 className={cn('mb-3 text-base font-semibold text-fg', className)} {...p} />
);

const iconosAlerta = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert } as const;
export const Alert = ({ tono = 'info', titulo, children }: { tono?: keyof typeof iconosAlerta; titulo: string; children?: ReactNode }) => {
  const Icono = iconosAlerta[tono];
  return (
    <div role={tono === 'danger' || tono === 'warning' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-md p-4 text-sm', tonos[tono])}>
      <Icono aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div>
        <p className="font-semibold">{titulo}</p>
        {children && <div className="mt-1">{children}</div>}
      </div>
    </div>
  );
};

export const Tabla = ({ className, ...p }: ComponentProps<'table'>) => (
  <div className="overflow-x-auto rounded-lg border border-line">
    <table className={cn('w-full border-collapse text-left text-sm', className)} {...p} />
  </div>
);
export const Th = ({ className, ...p }: ComponentProps<'th'>) => (
  <th scope="col" className={cn('border-b border-line bg-surface-muted px-4 py-3 font-semibold text-fg', className)} {...p} />
);
export const Td = ({ className, ...p }: ComponentProps<'td'>) => (
  <td className={cn('border-b border-line px-4 py-3 text-fg', className)} {...p} />
);

export const Avatar = ({ nombre, className }: { nombre: string; className?: string }) => {
  const iniciales = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join('');
  return (
    <span role="img" aria-label={nombre} className={cn('inline-flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-on-primary', className)}>
      {iniciales}
    </span>
  );
};

export const Progreso = ({ valor, etiqueta, className }: { valor: number; etiqueta: string; className?: string }) => (
  <div
    role="progressbar"
    aria-label={etiqueta}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={Math.round(valor)}
    className={cn('h-2.5 w-full overflow-hidden rounded-full bg-surface-muted', className)}
  >
    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, valor))}%` }} />
  </div>
);

export const Separador = ({ className }: { className?: string }) => <hr className={cn('border-0 border-t border-line', className)} />;

export const Skeleton = ({ className }: { className?: string }) => (
  <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-surface-muted', className)} />
);

export const Migas = ({ items, etiqueta = textosUi.navegacion.migas }: { items: { texto: string; href?: string }[]; etiqueta?: string }) => (
  <nav aria-label={etiqueta}>
    <ol className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
      {items.map((it, i) => (
        <li key={it.texto} className="flex items-center gap-2">
          {it.href && i < items.length - 1 ? <a className="text-primary underline underline-offset-2 hover:no-underline" href={it.href}>{it.texto}</a> : <span aria-current={i === items.length - 1 ? 'page' : undefined} className={i === items.length - 1 ? 'text-fg' : ''}>{it.texto}</span>}
          {i < items.length - 1 && <span aria-hidden="true">/</span>}
        </li>
      ))}
    </ol>
  </nav>
);

export const EstadoVacio = ({ titulo, descripcion, accion }: { titulo: string; descripcion: string; accion?: ReactNode }) => (
  <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line-strong p-10 text-center">
    <p className="text-base font-semibold text-fg">{titulo}</p>
    <p className="max-w-md text-sm text-fg-muted">{descripcion}</p>
    {accion}
  </div>
);
