import { CircleCheck, CircleDashed, CircleMinus, CircleX } from 'lucide-react';
import { cn } from '../cn';
import { textosUi } from '../i18n';

export type EstadoCumplimiento = 'cumple' | 'parcial' | 'noCumple' | 'noAplica';

const config = {
  cumple: { Icono: CircleCheck, clase: 'bg-success-subtle text-success' },
  parcial: { Icono: CircleDashed, clase: 'bg-warning-subtle text-warning' },
  noCumple: { Icono: CircleX, clase: 'bg-danger-subtle text-danger' },
  noAplica: { Icono: CircleMinus, clase: 'bg-neutral-status-subtle text-neutral-status' },
} as const;

/** Semáforo de cumplimiento: nunca depende solo del color (ícono + texto). */
export const SemaforoCumplimiento = ({ estado, textos = textosUi.semaforo }: { estado: EstadoCumplimiento; textos?: Record<EstadoCumplimiento, string> }) => {
  const { Icono, clase } = config[estado];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', clase)}>
      <Icono aria-hidden="true" className="size-4" />
      {textos[estado]}
    </span>
  );
};
