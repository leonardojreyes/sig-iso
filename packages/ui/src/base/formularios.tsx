import { useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from '../cn';

const control =
  'w-full rounded-md border border-line-strong bg-surface px-3 text-fg placeholder:text-fg-muted ' +
  'disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger';

export const Label = ({ className, ...p }: ComponentProps<'label'>) => (
  <label className={cn('text-sm font-medium text-fg', className)} {...p} />
);

export const Input = ({ className, ...p }: ComponentProps<'input'>) => (
  <input className={cn(control, 'h-[var(--sig-density-control-height)]', className)} {...p} />
);

export const Textarea = ({ className, ...p }: ComponentProps<'textarea'>) => (
  <textarea className={cn(control, 'min-h-28 py-2', className)} {...p} />
);

/** Select nativo con estilo: accesible por teclado y lector de pantalla sin dependencias. */
export const Select = ({ className, children, ...p }: ComponentProps<'select'>) => (
  <select className={cn(control, 'h-[var(--sig-density-control-height)]', className)} {...p}>
    {children}
  </select>
);

export const Checkbox = ({ className, ...p }: Omit<ComponentProps<'input'>, 'type'>) => (
  <input type="checkbox" className={cn('size-5 rounded-sm border-line-strong accent-[var(--sig-color-primary)]', className)} {...p} />
);

export const Switch = ({ className, ...p }: Omit<ComponentProps<'input'>, 'type' | 'role'>) => (
  <input
    type="checkbox"
    role="switch"
    className={cn(
      'h-6 w-11 cursor-pointer appearance-none rounded-full border border-line-strong bg-surface-muted transition-colors',
      "relative before:absolute before:left-0.5 before:top-0.5 before:size-4 before:rounded-full before:bg-fg-muted before:transition-transform before:content-['']",
      'checked:border-primary checked:bg-primary checked:before:translate-x-5 checked:before:bg-on-primary',
      className,
    )}
    {...p}
  />
);

interface CampoProps {
  etiqueta: string;
  ayuda?: string;
  error?: string;
  requerido?: boolean;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean; 'aria-required'?: boolean }) => ReactNode;
}

/** Etiqueta + control + ayuda + error, con los atributos ARIA enlazados. */
export const Campo = ({ etiqueta, ayuda, error, requerido, children }: CampoProps) => {
  const id = useId();
  const descIds = [ayuda ? `${id}-ayuda` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {etiqueta}
        {requerido && <span aria-hidden="true" className="text-danger"> *</span>}
      </Label>
      {children({ id, 'aria-describedby': descIds, 'aria-invalid': error ? true : undefined, 'aria-required': requerido || undefined })}
      {ayuda && <p id={`${id}-ayuda`} className="text-sm text-fg-muted">{ayuda}</p>}
      {error && <p id={`${id}-error`} className="text-sm font-medium text-danger">{error}</p>}
    </div>
  );
};
