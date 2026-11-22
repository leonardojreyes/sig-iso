import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import type { DetallePrograma, Programa } from '../auditoria/tipos';
import type { PersonaDirectorio } from '../documentos/tipos';
import type { Empresa } from '../marca/tipos';
import { PantallaAuditoria, PantallaPrograma } from './auditoria-programa';

const empresa = { id: 'empresa-a', nombre: 'Empresa A', marca: { colorPrimario: '#0E5C42', logoUrl: null } } as unknown as Empresa;
const ADMIN = { nombre: 'Ana Admin', roles: ['administrador_sig'] as const };
const COLAB = { nombre: 'Carla Colaboradora', roles: ['colaborador'] as const };
const U1 = '22222222-2222-4222-8222-222222222222';
const P1 = 'aaaaaaaa-1111-4111-8111-111111111111';
const P2 = 'bbbbbbbb-1111-4111-8111-111111111111';
const PROG = 'cccccccc-1111-4111-8111-111111111111';
const personas: PersonaDirectorio[] = [{ id: U1, nombre: 'Ana Admin', activa: true, puedeAprobar: true }];

const programa = (extra: Partial<Programa> = {}): Programa => ({ id: PROG, anio: 2027, objetivo: 'Verificar el SGSI', estado: 'sin_aprobar', aprobadoPor: null, aprobadoEn: null, version: 2, normas: ['iso-27001', 'iso-9001'], ...extra });
const detalle = (extra: Partial<DetallePrograma> = {}): DetallePrograma => ({
  programa: programa(),
  auditorias: [
    { id: 'dddddddd-1111-4111-8111-111111111111', codigo: 'AI-2027-01', objetivo: 'Primera', estado: 'planificada', inicio: '2027-02-01', fin: '2027-02-05', trimestre: 1, normas: ['iso-27001'], combinada: false, procesosIds: [P1], liderId: U1 },
    { id: 'eeeeeeee-1111-4111-8111-111111111111', codigo: 'AI-2027-02', objetivo: 'Combinada', estado: 'cancelada', inicio: '2027-08-01', fin: '2027-08-05', trimestre: 3, normas: ['iso-27001', 'iso-9001'], combinada: true, procesosIds: [], liderId: null },
  ],
  exclusiones: [{ id: 'ffffffff-1111-4111-8111-111111111111', tipo: 'proceso', procesoId: P2, libreriaCodigo: null, capitulo: null, motivo: 'Auditado el año pasado' }],
  procesos: [
    { procesoId: P1, codigo: 'PR-001', nombre: 'Compras', importancia: 'alta', frecuencia: 'anual', cambioRelevante: 'incidente', ultimaAuditoria: '2026-05-01', hallazgosAbiertos: 2, incluido: true },
    { procesoId: P2, codigo: 'PR-002', nombre: 'Ventas', importancia: 'baja', frecuencia: 'cada_dos_anios', cambioRelevante: null, ultimaAuditoria: null, hallazgosAbiertos: 0, incluido: false },
  ],
  pendientes: { procesos: [], capitulos: [{ libreriaCodigo: 'iso-9001', capitulo: '8' }], procesosIncluidos: 1, capitulosIncluidos: 3 },
  ...extra,
});

describe('Programa anual', () => {
  it('no tiene violaciones de accesibilidad (axe) en ninguno de sus estados', async () => {
    const aprobado = detalle({ programa: programa({ estado: 'aprobado', aprobadoPor: U1, aprobadoEn: '2027-01-10T15:00:00.000Z' }), pendientes: { procesos: [], capitulos: [], procesosIncluidos: 2, capitulosIncluidos: 4 } });
    const estados = [
      <PantallaAuditoria key="a" empresa={empresa} persona={ADMIN} programas={[programa(), programa({ id: 'dddddddd-2222-4222-8222-222222222222', anio: 2026, estado: 'aprobado', aprobadoEn: '2026-01-10T15:00:00.000Z' })]} normasAdoptadas={['iso-27001', 'iso-9001']} aviso="programa_guardado" />,
      <PantallaAuditoria key="b" empresa={empresa} persona={ADMIN} programas={[]} normasAdoptadas={[]} />,
      <PantallaAuditoria key="c" empresa={empresa} persona={COLAB} programas={[programa()]} normasAdoptadas={['iso-27001']} />,
      <PantallaPrograma key="d" empresa={empresa} persona={ADMIN} detalle={detalle()} personas={personas} normasAdoptadas={['iso-27001', 'iso-9001']} aviso="programa_motivo_guardado" />,
      <PantallaPrograma key="e" empresa={empresa} persona={ADMIN} detalle={aprobado} personas={personas} normasAdoptadas={['iso-27001', 'iso-9001']} />,
      <PantallaPrograma key="f" empresa={empresa} persona={COLAB} detalle={detalle()} personas={personas} normasAdoptadas={[]} />,
      <PantallaPrograma key="g" empresa={empresa} persona={ADMIN} detalle={detalle({ auditorias: [], exclusiones: [], procesos: [] })} personas={personas} normasAdoptadas={[]} />,
    ];
    for (const e of estados) {
      const { container, unmount } = render(e);
      expect(await axe(container)).toHaveNoViolations();
      unmount();
    }
  });

  it('la entrada ofrece crear un programa solo al administrador y solo con normas adoptadas', () => {
    const a = render(<PantallaAuditoria empresa={empresa} persona={ADMIN} programas={[]} normasAdoptadas={['iso-27001']} />);
    expect(a.container.querySelector('form[action="/e/empresa-a/auditoria/escribir/programa_crear"]')).not.toBeNull();
    expect(a.container.querySelectorAll('input[name="normas"]')).toHaveLength(1);
    a.unmount();
    const sin = render(<PantallaAuditoria empresa={empresa} persona={ADMIN} programas={[]} normasAdoptadas={[]} />);
    expect(sin.container.querySelector('form[action*="programa_crear"]')).toBeNull();
    expect(sin.container.textContent).toContain('adopte una librería');
    sin.unmount();
    const c = render(<PantallaAuditoria empresa={empresa} persona={COLAB} programas={[programa()]} normasAdoptadas={['iso-27001']} />);
    expect(c.container.querySelector('form[action*="/auditoria/escribir/"]')).toBeNull();
    expect(c.container.textContent).toContain('Programa de auditoría 2027');
  });

  it('el calendario ubica cada auditoría en su trimestre y no cuenta las canceladas', () => {
    const { container } = render(<PantallaPrograma empresa={empresa} persona={ADMIN} detalle={detalle()} personas={personas} normasAdoptadas={['iso-27001']} />);
    const t1 = container.querySelector('#trimestre-1')!.parentElement!;
    expect(t1.textContent).toContain('AI-2027-01');
    expect(container.querySelector('#trimestre-3')!.parentElement!.textContent).toContain('No hay auditorías planificadas.');
    // la cancelada sí aparece en la tabla, con su estado en palabras
    expect(container.textContent).toContain('AI-2027-02');
    expect(container.textContent).toContain('Cancelada');
  });

  it('muestra lo que falta con palabras, las ayudas para decidir y los motivos registrados', () => {
    const { container } = render(<PantallaPrograma empresa={empresa} persona={ADMIN} detalle={detalle({ pendientes: { procesos: [P2], capitulos: [{ libreriaCodigo: 'iso-9001', capitulo: '8' }], procesosIncluidos: 1, capitulosIncluidos: 3 } })} personas={personas} normasAdoptadas={['iso-27001']} />);
    expect(container.textContent).toContain('PR-002 Ventas');
    expect(container.textContent).toContain('iso-9001 · 8');
    expect(container.textContent).toContain('Todavía faltan auditorías o motivos');
    expect(container.textContent).toContain('Nunca se auditó');
    expect(container.textContent).toContain('Hubo un incidente');
    expect(container.textContent).toContain('Auditado el año pasado');
    expect(container.textContent).toContain('Incluido');
    expect(container.textContent).toContain('No incluido');
  });

  it('sin pendientes dice que todo está incluido o justificado y permite aprobar con la versión que se vio', () => {
    const { container } = render(<PantallaPrograma empresa={empresa} persona={ADMIN} detalle={detalle({ pendientes: { procesos: [], capitulos: [], procesosIncluidos: 2, capitulosIncluidos: 4 } })} personas={personas} normasAdoptadas={['iso-27001']} />);
    expect(container.textContent).toContain('Todo está incluido o justificado.');
    expect(container.textContent).not.toContain('Todavía faltan auditorías o motivos');
    const f = container.querySelector(`form[action="/e/empresa-a/auditoria/escribir/programa_aprobar/${PROG}"]`)!;
    expect(f.querySelector('input[name="version"]')).toHaveProperty('value', '2');
  });

  it('aprobado: no ofrece aprobar ni agregar o quitar motivos, y planificar exige el motivo del cambio', () => {
    const d = detalle({ programa: programa({ estado: 'aprobado', aprobadoPor: U1, aprobadoEn: '2027-01-10T15:00:00.000Z' }), pendientes: { procesos: [], capitulos: [], procesosIncluidos: 2, capitulosIncluidos: 4 } });
    const { container } = render(<PantallaPrograma empresa={empresa} persona={ADMIN} detalle={d} personas={personas} normasAdoptadas={['iso-27001']} />);
    expect(container.querySelector('form[action*="programa_aprobar"]')).toBeNull();
    expect(container.querySelector('form[action*="exclusion_agregar"]')).toBeNull();
    expect(container.querySelector('form[action*="exclusion_quitar"]')).toBeNull();
    expect(container.textContent).toContain('Con el programa aprobado no se agregan ni se quitan motivos');
    expect(container.textContent).toContain('Aprobado por Ana Admin el 2027-01-10.');
    const motivo = container.querySelector('form[action*="auditoria_crear"] select[name="motivo"]') as HTMLSelectElement;
    expect(motivo.required).toBe(true);
  });

  it('el formulario de planificar solo ofrece las normas del programa y los capítulos aún sin incluir', () => {
    const { container } = render(<PantallaPrograma empresa={empresa} persona={ADMIN} detalle={detalle()} personas={personas} normasAdoptadas={['iso-27001', 'otra']} />);
    const f = container.querySelector(`form[action="/e/empresa-a/auditoria/escribir/auditoria_crear/${PROG}"]`)!;
    expect([...f.querySelectorAll('input[name="normas"]')].map((i) => (i as HTMLInputElement).value)).toEqual(['iso-27001', 'iso-9001']);
    expect([...f.querySelectorAll('input[name="capitulos"]')].map((i) => (i as HTMLInputElement).value)).toEqual(['iso-9001|8']);
    expect([...f.querySelectorAll('input[name="procesosIds"]')].map((i) => (i as HTMLInputElement).value)).toEqual([P1, P2]);
    const inicio = f.querySelector('input[name="inicio"]') as HTMLInputElement;
    expect([inicio.min, inicio.max]).toEqual(['2027-01-01', '2027-12-31']);
  });

  it('quien no administra solo consulta: ningún formulario de escritura', () => {
    const { container } = render(<PantallaPrograma empresa={empresa} persona={COLAB} detalle={detalle()} personas={personas} normasAdoptadas={[]} />);
    expect(container.querySelector('form[action*="/auditoria/escribir/"]')).toBeNull();
    expect(container.textContent).toContain('Su rol puede consultar');
  });
});
