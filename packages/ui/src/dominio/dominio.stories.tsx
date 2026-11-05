import type { Meta, StoryObj } from '@storybook/react-vite';
import { BarraMadurez, LineaTiempoCertificacion, MatrizRiesgos, SemaforoCumplimiento } from '../index';

const meta = { title: 'Dominio ISO' } satisfies Meta;
export default meta;

export const Semaforo: StoryObj = {
  render: () => (<div className="flex gap-3">{(['cumple', 'parcial', 'noCumple', 'noAplica'] as const).map((e) => <SemaforoCumplimiento key={e} estado={e} />)}</div>),
};
export const Madurez: StoryObj = {
  render: () => (<div className="max-w-xl"><BarraMadurez etiqueta="Madurez" items={[{ clausula: '4', titulo: 'Contexto', porcentaje: 85 }, { clausula: '6', titulo: 'Planificación', porcentaje: 52 }, { clausula: '9', titulo: 'Evaluación del desempeño', porcentaje: 30 }]} /></div>),
};
export const Riesgos: StoryObj = {
  render: () => (<div className="max-w-md"><MatrizRiesgos celdas={[{ probabilidad: 5, impacto: 5, cantidad: 2 }, { probabilidad: 3, impacto: 3, cantidad: 5 }, { probabilidad: 1, impacto: 2, cantidad: 4 }]} /></div>),
};
export const Ciclo: StoryObj = {
  render: () => (<LineaTiempoCertificacion etapas={[{ codigo: 'E0', nombre: 'Decisión y alcance', estado: 'completada' }, { codigo: 'E1', nombre: 'Diagnóstico', estado: 'enCurso' }, { codigo: 'E2', nombre: 'Plan', estado: 'pendiente' }]} />),
};
