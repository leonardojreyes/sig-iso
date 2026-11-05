import { Check, Circle, Loader } from 'lucide-react';
import { cn } from '../cn';
import { textosUi } from '../i18n';

export interface EtapaCertificacion {
  codigo: string; // E0..E8
  nombre: string;
  estado: 'completada' | 'enCurso' | 'pendiente';
  fecha?: string;
}

const icono = { completada: Check, enCurso: Loader, pendiente: Circle } as const;
const clase = {
  completada: 'bg-primary text-on-primary border-primary',
  enCurso: 'bg-primary-subtle text-on-primary-subtle border-primary',
  pendiente: 'bg-surface text-fg-muted border-line-strong',
} as const;

/** Línea de tiempo del ciclo de certificación E0–E8. */
export const LineaTiempoCertificacion = ({ etapas, textos = textosUi.etapas }: { etapas: EtapaCertificacion[]; textos?: typeof textosUi.etapas }) => (
  <ol aria-label={textos.titulo} className="flex flex-col gap-0">
    {etapas.map((e, i) => {
      const Icono = icono[e.estado];
      return (
        <li key={e.codigo} aria-current={e.estado === 'enCurso' ? 'step' : undefined} className="relative flex gap-4 pb-5 last:pb-0">
          {i < etapas.length - 1 && <span aria-hidden="true" className="absolute left-[1.0625rem] top-9 h-[calc(100%-2.25rem)] w-0.5 bg-line" />}
          <span className={cn('z-10 flex size-9 shrink-0 items-center justify-center rounded-full border-2', clase[e.estado])}>
            <Icono aria-hidden="true" className="size-4" />
          </span>
          <div className="pt-1">
            <p className="text-sm font-semibold text-fg">
              <span className="font-mono text-fg-muted">{e.codigo}</span> {e.nombre}
            </p>
            <p className="text-xs text-fg-muted">
              {textos[e.estado]}{e.fecha ? ` · ${e.fecha}` : ''}
            </p>
          </div>
        </li>
      );
    })}
  </ol>
);
