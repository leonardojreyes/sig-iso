import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Campo, Checkbox, Input, Select, Switch, Textarea } from '../index';

const meta = { title: 'Base/Formularios' } satisfies Meta;
export default meta;

export const Campos: StoryObj = {
  render: () => (
    <form className="flex max-w-md flex-col gap-4" aria-label="Ejemplo">
      <Campo etiqueta="Título breve" ayuda="Máximo 80 caracteres." requerido>{(p) => <Input {...p} />}</Campo>
      <Campo etiqueta="Con error" error="Este campo es obligatorio." requerido>{(p) => <Input {...p} />}</Campo>
      <Campo etiqueta="Norma">{(p) => (<Select {...p}><option>ISO 9001</option><option>ISO/IEC 27001</option></Select>)}</Campo>
      <Campo etiqueta="Guía">{(p) => <Textarea {...p} />}</Campo>
      <div className="flex items-center gap-3"><Checkbox id="c" defaultChecked /><label htmlFor="c">Aplica</label></div>
      <div className="flex items-center gap-3"><Switch id="s" aria-label="Activo" defaultChecked /><span>Activo</span></div>
      <Button type="button">Guardar</Button>
    </form>
  ),
};
