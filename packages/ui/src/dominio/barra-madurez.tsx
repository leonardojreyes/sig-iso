import { cn } from '../cn';

export interface ItemMadurez { clausula: string; titulo: string; porcentaje: number }

const colorPorNivel = (p: number) => (p >= 80 ? 'bg-success' : p >= 50 ? 'bg-warning' : 'bg-danger');

/** Madurez por cláusula: lista de barras con valor numérico visible. */
export const BarraMadurez = ({ items, etiqueta }: { items: ItemMadurez[]; etiqueta: string }) => (
  <ul aria-label={etiqueta} className="flex flex-col gap-3">
    {items.map((it) => (
      <li key={it.clausula} className="grid grid-cols-[3rem_1fr_3.5rem] items-center gap-3 text-sm">
        <span className="font-mono text-fg-muted">{it.clausula}</span>
        <div>
          <p className="mb-1 text-fg">{it.titulo}</p>
          <div
            role="progressbar"
            aria-label={`${it.clausula} ${it.titulo}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={it.porcentaje}
            className="h-2.5 overflow-hidden rounded-full bg-surface-muted"
          >
            <div className={cn('h-full rounded-full', colorPorNivel(it.porcentaje))} style={{ width: `${it.porcentaje}%` }} />
          </div>
        </div>
        <span className="text-right font-semibold tabular-nums text-fg">{it.porcentaje}%</span>
      </li>
    ))}
  </ul>
);
