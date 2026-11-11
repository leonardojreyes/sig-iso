import { render, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import type { Alcance, Desglose, Diagnostico, FilaDiagnostico } from '../api/tipos';
import { PantallaAlcance } from './alcance';
import { PantallaDiagnostico } from './diagnostico';

const empresa = { id: 'empresa-a', nombre: 'Empresa A (prueba)', primario: '#0b5fff' };
const admin = { nombre: 'Laura Mena', roles: ['administrador_sig'] as const };
const colaborador = { nombre: 'Pedro Soto', roles: ['colaborador'] as const };
const lector = { nombre: 'Rosa Lema', roles: ['auditor_externo'] as const };

const desglose = (c: Partial<Desglose> = {}): Desglose => ({ cumple: 1, parcial: 0, noCumple: 0, noAplica: 0, sinEvaluar: 1, total: 2, porcentaje: 100, ...c });
const fila = (c: Partial<FilaDiagnostico> = {}): FilaDiagnostico => ({
  libreriaCodigo: 'iso-27001-2022-anexo-a',
  idEstable: 'a27-5-1',
  tipo: 'control',
  capitulo: null,
  grupo: 'Organizacionales',
  titulo: 'Políticas de seguridad',
  guia: 'Redacta las reglas generales.',
  aplicaA: [{ norma: 'ISO/IEC 27001', edicion: '2022', clausula: 'A.5.1' }],
  evaluacion: { estado: 'parcial', comentario: 'Falta aprobar el documento.', fechaObjetivo: '2026-12-31', version: 3 },
  ...c,
});
const diagnostico = (c: Partial<Diagnostico> = {}): Diagnostico => ({
  filas: [fila(), fila({ idEstable: 'a27-5-2', titulo: 'Roles y responsabilidades', evaluacion: null })],
  madurez: {
    porNorma: [{ norma: 'ISO/IEC 27001', desglose: desglose() }],
    porAgrupador: [{ tipo: 'tema', nombre: 'Organizacionales', desglose: desglose() }, { tipo: 'capitulo', nombre: '4', desglose: desglose({ porcentaje: null, cumple: 0 }) }],
    clausulas: desglose({ porcentaje: null, cumple: 0 }),
  },
  normas: ['ISO/IEC 27001'],
  ...c,
});
const baseD = { empresa, persona: admin, diagnostico: diagnostico(), filtros: {}, filtrosInvalidos: false };
const alcance = (c: Partial<Alcance> = {}): Alcance => ({ norma: 'ISO/IEC 27001', texto: 'Desarrollo de software en Quito.', aprobado: false, aprobadoEn: null, actualizadoEn: '2026-11-10T12:00:00.000Z', ...c });
const baseA = { empresa, persona: admin, alcances: [alcance(), alcance({ norma: 'ISO 9001', texto: null, actualizadoEn: null })] };

describe('PantallaDiagnostico', () => {
  it('no tiene violaciones de accesibilidad (axe)', async () => {
    const { container } = render(<PantallaDiagnostico {...baseD} aviso="conflicto" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('muestra la madurez con su valor en texto y lo «sin datos» sin inventar 0 %', () => {
    const { container } = render(<PantallaDiagnostico {...baseD} />);
    expect(within(container).getAllByText(/100 % · 1 sin evaluar/).length).toBeGreaterThan(0);
    expect(within(container).getAllByText('Sin datos evaluados').length).toBeGreaterThan(0);
    expect(within(container).getByText(/no indica la probabilidad de certificarse/)).toBeTruthy();
  });

  it('cada fila muestra su estado (con texto) y «Sin evaluar» si falta', () => {
    const { container } = render(<PantallaDiagnostico {...baseD} />);
    // «Parcial» sale en el estado de la fila y en el desplegable del formulario: el de la fila es un texto dentro de la celda.
    expect(container.querySelector('td span')?.textContent).toBe('Parcial');
    expect(within(container).getAllByText('Sin evaluar').length).toBeGreaterThan(0);
  });

  it('el formulario envía a la ruta propia, con la versión vista y los filtros ocultos, sin campo de empresa', () => {
    const { container } = render(<PantallaDiagnostico {...baseD} filtros={{ q: 'política', estado: 'parcial' }} />);
    const form = container.querySelector('form[action="/e/empresa-a/diagnostico/evaluar"]')!;
    expect(form.getAttribute('method')).toBe('post');
    const valor = (n: string) => (form.querySelector(`input[name="${n}"]`) as HTMLInputElement | null)?.value;
    expect(valor('libreriaCodigo')).toBe('iso-27001-2022-anexo-a');
    expect(valor('version')).toBe('3');
    expect(valor('f_q')).toBe('política');
    expect(valor('f_estado')).toBe('parcial');
    expect(form.querySelector('[name="empresaId"], [name="empresa"]')).toBeNull();
    // La entrada sin evaluar no manda versión (es la primera vez).
    const segundo = container.querySelectorAll('form[action$="/diagnostico/evaluar"]')[1]!;
    expect(segundo.querySelector('input[name="version"]')).toBeNull();
  });

  it('un rol de solo lectura ve el diagnóstico pero no los formularios', () => {
    const { container } = render(<PantallaDiagnostico {...baseD} persona={lector} />);
    expect(container.querySelector('form[action$="/diagnostico/evaluar"]')).toBeNull();
    expect(within(container).getByText(/puede consultar el diagnóstico pero no evaluar/)).toBeTruthy();
  });

  it('el colaborador sí evalúa', () => {
    const { container } = render(<PantallaDiagnostico {...baseD} persona={colaborador} />);
    expect(container.querySelector('form[action$="/diagnostico/evaluar"]')).not.toBeNull();
  });

  it('sin librerías adoptadas invita a adoptar; sin resultados lo dice', () => {
    const vacio = render(<PantallaDiagnostico {...baseD} diagnostico={diagnostico({ filas: [], normas: [] })} />);
    expect(within(vacio.container).getByText('Su empresa aún no adoptó ninguna librería')).toBeTruthy();
    const sinFilas = render(<PantallaDiagnostico {...baseD} diagnostico={diagnostico({ filas: [] })} filtros={{ q: 'zzz' }} />);
    expect(within(sinFilas.container).getByText('Sin resultados')).toBeTruthy();
  });

  it('no inyecta HTML de los datos (escapa el texto)', () => {
    const { container } = render(<PantallaDiagnostico {...baseD} diagnostico={diagnostico({ filas: [fila({ titulo: '<img src=x onerror=alert(1)>' })] })} />);
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('PantallaAlcance', () => {
  it('no tiene violaciones de accesibilidad (axe)', async () => {
    const { container } = render(<PantallaAlcance {...baseA} aviso="aprobado" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('el administrador guarda y, con texto sin aprobar, también aprueba; nada lleva la empresa', () => {
    const { container } = render(<PantallaAlcance {...baseA} />);
    const forms = container.querySelectorAll('form[action="/e/empresa-a/alcance/guardar"]');
    expect(forms).toHaveLength(2);
    expect(forms[0]!.querySelector('button[formaction="/e/empresa-a/alcance/aprobar"]')).not.toBeNull();
    expect(forms[1]!.querySelector('button[formaction]')).toBeNull(); // sin texto no hay qué aprobar
    expect(within(container).getByText('Sin definir')).toBeTruthy();
    expect(container.querySelector('[name="empresaId"], [name="empresa"]')).toBeNull();
  });

  it('un alcance aprobado no ofrece aprobar otra vez y muestra la fecha', () => {
    const { container } = render(<PantallaAlcance {...baseA} alcances={[alcance({ aprobado: true, aprobadoEn: '2026-11-10T12:00:00.000Z' })]} />);
    expect(within(container).getByText('Aprobado el 2026-11-10')).toBeTruthy();
    expect(container.querySelector('button[formaction$="/alcance/aprobar"]')).toBeNull();
  });

  it('quien no es administrador solo lee', () => {
    const { container } = render(<PantallaAlcance {...baseA} persona={colaborador} />);
    expect(container.querySelector('form[action$="/alcance/guardar"]')).toBeNull();
    expect(within(container).getByText(/Solo el administrador SIG puede editar y aprobar/)).toBeTruthy();
    expect(within(container).getByText('Desarrollo de software en Quito.')).toBeTruthy();
  });

  it('sin normas adoptadas invita a adoptar', () => {
    const { container } = render(<PantallaAlcance {...baseA} alcances={[]} />);
    expect(within(container).getByText('Aún no hay normas adoptadas')).toBeTruthy();
  });
});
