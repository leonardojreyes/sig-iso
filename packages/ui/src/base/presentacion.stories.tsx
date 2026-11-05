import type { Meta, StoryObj } from '@storybook/react-vite';
import { Alert, Avatar, Badge, Button, Card, CardTitle, EstadoVacio, Migas, Progreso, Skeleton, Tabla, Td, Th } from '../index';

const meta = { title: 'Base/Presentación' } satisfies Meta;
export default meta;

export const Botones: StoryObj = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button>Primario</Button><Button variante="secondary">Secundario</Button><Button variante="ghost">Fantasma</Button><Button variante="danger">Peligro</Button><Button disabled>Deshabilitado</Button>
    </div>
  ),
};
export const Insignias: StoryObj = {
  render: () => (<div className="flex gap-2">{(['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as const).map((t) => <Badge key={t} tono={t}>{t}</Badge>)}</div>),
};
export const Alertas: StoryObj = {
  render: () => (<div className="flex max-w-lg flex-col gap-3">{(['info', 'success', 'warning', 'danger'] as const).map((t) => <Alert key={t} tono={t} titulo={`Alerta ${t}`}>Detalle de ejemplo.</Alert>)}</div>),
};
export const Tarjeta: StoryObj = {
  render: () => (<Card className="max-w-sm"><CardTitle>Título</CardTitle><p>Contenido</p><div className="mt-3 flex items-center gap-3"><Avatar nombre="Ana Pérez" /><Progreso valor={60} etiqueta="Avance" /></div></Card>),
};
export const Tablas: StoryObj = {
  render: () => (<Tabla><caption className="sr-only">Ejemplo</caption><thead><tr><Th>Cláusula</Th><Th>Título</Th></tr></thead><tbody><tr><Td>4.1</Td><Td>Contexto</Td></tr></tbody></Tabla>),
};
export const Otros: StoryObj = {
  render: () => (<div className="flex max-w-lg flex-col gap-4"><Migas items={[{ texto: 'Inicio', href: '#' }, { texto: 'Actual' }]} /><Skeleton className="h-6 w-48" /><EstadoVacio titulo="Sin datos" descripcion="No hay registros para mostrar." /></div>),
};
