import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import {
  Alert, Avatar, Badge, Button, Campo, Card, CardTitle, Checkbox, EstadoVacio, Input, Migas, Progreso, Select, Separador,
  Skeleton, Switch, Tabla, Td, Textarea, Th, BarraMadurez, LineaTiempoCertificacion, MatrizRiesgos, SemaforoCumplimiento,
} from './index';

const verificar = async (ui: React.ReactElement) => {
  const { container } = render(ui);
  expect(await axe(container)).toHaveNoViolations();
};

describe('accesibilidad (axe) — componentes base', () => {
  it('formulario completo con errores y ayuda', async () => {
    await verificar(
      <form aria-label="Prueba">
        <Campo etiqueta="Título" ayuda="Máximo 80 caracteres" error="Es obligatorio" requerido>{(p) => <Input {...p} />}</Campo>
        <Campo etiqueta="Norma">{(p) => (<Select {...p}><option>ISO 9001</option></Select>)}</Campo>
        <Campo etiqueta="Guía">{(p) => <Textarea {...p} />}</Campo>
        <Campo etiqueta="Aplica">{(p) => <Checkbox {...p} />}</Campo>
        <Campo etiqueta="Activo">{(p) => <Switch {...p} />}</Campo>
        <Button type="submit">Guardar</Button>
      </form>,
    );
  });
  it('presentación', async () => {
    await verificar(
      <main>
        <Card><CardTitle>Título</CardTitle><Badge tono="success">ok</Badge><Avatar nombre="Ana Pérez" /></Card>
        <Alert tono="danger" titulo="Error">Detalle</Alert>
        <Alert tono="info" titulo="Info" />
        <Progreso valor={40} etiqueta="Avance" />
        <Separador /><Skeleton className="h-4 w-10" />
        <Migas items={[{ texto: 'Inicio', href: '/' }, { texto: 'Actual' }]} />
        <EstadoVacio titulo="Sin datos" descripcion="No hay registros." />
        <Tabla><caption className="sr-only">Datos</caption><thead><tr><Th>A</Th></tr></thead><tbody><tr><Td>1</Td></tr></tbody></Tabla>
      </main>,
    );
  });
});

describe('accesibilidad (axe) — componentes de dominio', () => {
  it('semáforo, madurez, matriz y línea de tiempo', async () => {
    await verificar(
      <main>
        {(['cumple', 'parcial', 'noCumple', 'noAplica'] as const).map((e) => <SemaforoCumplimiento key={e} estado={e} />)}
        <BarraMadurez etiqueta="Madurez" items={[{ clausula: '4', titulo: 'Contexto', porcentaje: 72 }]} />
        <MatrizRiesgos celdas={[{ probabilidad: 5, impacto: 5, cantidad: 2 }]} />
        <LineaTiempoCertificacion etapas={[{ codigo: 'E0', nombre: 'Alcance', estado: 'completada' }, { codigo: 'E1', nombre: 'Diagnóstico', estado: 'enCurso' }, { codigo: 'E2', nombre: 'Plan', estado: 'pendiente' }]} />
      </main>,
    );
  });
  it('el semáforo comunica el estado con texto, no solo color', () => {
    const { getByText } = render(<SemaforoCumplimiento estado="noCumple" />);
    expect(getByText('No cumple')).toBeTruthy();
  });
});
