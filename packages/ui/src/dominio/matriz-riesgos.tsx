import { cn } from '../cn';
import { textosUi } from '../i18n';

export interface CeldaRiesgo { probabilidad: 1 | 2 | 3 | 4 | 5; impacto: 1 | 2 | 3 | 4 | 5; cantidad: number }

const nivel = (p: number, i: number): keyof typeof textosUi.riesgos.nivel => {
  const s = p * i;
  return s >= 15 ? 'critico' : s >= 10 ? 'alto' : s >= 5 ? 'medio' : 'bajo';
};
const clasePorNivel = {
  bajo: 'bg-success-subtle text-success',
  medio: 'bg-warning-subtle text-warning',
  alto: 'bg-danger-subtle text-danger',
  critico: 'bg-danger text-surface',
} as const;

/** Matriz 5×5 probabilidad × impacto. Cada celda dice su nivel con texto (no solo color). */
export const MatrizRiesgos = ({ celdas, textos = textosUi.riesgos }: { celdas: CeldaRiesgo[]; textos?: typeof textosUi.riesgos }) => {
  const cantidad = (p: number, i: number) => celdas.find((c) => c.probabilidad === p && c.impacto === i)?.cantidad ?? 0;
  const filas = [5, 4, 3, 2, 1] as const;
  const cols = [1, 2, 3, 4, 5] as const;
  return (
    <table className="w-full border-separate border-spacing-1 text-center text-sm">
      <caption className="sr-only">{`${textos.probabilidad} × ${textos.impacto}`}</caption>
      <thead>
        <tr>
          <th scope="col" className="text-xs font-medium text-fg-muted">{textos.probabilidad} \ {textos.impacto}</th>
          {cols.map((i) => (<th key={i} scope="col" className="text-xs font-medium text-fg-muted">{i}</th>))}
        </tr>
      </thead>
      <tbody>
        {filas.map((p) => (
          <tr key={p}>
            <th scope="row" className="text-xs font-medium text-fg-muted">{p}</th>
            {cols.map((i) => {
              const n = cantidad(p, i);
              const nv = nivel(p, i);
              return (
                <td key={i} className={cn('rounded-md px-1 py-2', clasePorNivel[nv])}>
                  <span className="block text-base font-bold tabular-nums">{n}</span>
                  <span className="block text-[0.7rem] font-medium">{textos.nivel[nv]}</span>
                  <span className="sr-only">{`, ${n} ${textos.riesgos}`}</span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};
