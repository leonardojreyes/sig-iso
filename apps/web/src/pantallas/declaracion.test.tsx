import { render, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import type { Declaracion, FilaDeclaracion, JustificacionBorrador, VersionDeclaracion, VersionDeclaracionConFilas } from '../api/tipos';
import { PantallaDeclaracion } from './declaracion';
import { PantallaVersionDeclaracion } from './declaracion-version';

const empresa = { id: 'empresa-a', nombre: 'Empresa A (prueba)', primario: '#0b5fff' };
const admin = { nombre: 'Laura Mena', roles: ['administrador_sig'] as const };
const colaborador = { nombre: 'Pedro Soto', roles: ['colaborador'] as const };
const V1 = 'dddddddd-1111-4111-8111-111111111111';
const V2 = 'dddddddd-2222-4222-8222-222222222222';
const U = '11111111-1111-4111-8111-1111111111a1';

const fila = (o: Partial<FilaDeclaracion> = {}): FilaDeclaracion => ({ libreriaCodigo: 'iso-27001-anexo-a', idEstable: 'a27-5-1', orden: 1, titulo: 'Políticas de seguridad', grupo: 'Organizacionales', aplicabilidad: 'aplica', implementacion: 'implementado', justificacion: null, controles: ['C-001'], cobertura: 'cubierta', ...o });
const filas = (): FilaDeclaracion[] => [
  fila(),
  fila({ idEstable: 'a27-5-2', orden: 2, titulo: 'Roles y responsabilidades', implementacion: 'parcial', controles: [], cobertura: 'sin_control' }),
  fila({ idEstable: 'a27-5-3', orden: 3, titulo: 'Separación de funciones', aplicabilidad: 'no_aplica', implementacion: null, justificacion: 'No hay personal propio', controles: [], cobertura: 'no_aplica' }),
];
const version = (o: Partial<VersionDeclaracion> = {}): VersionDeclaracion => ({ id: V2, numero: 2, total: 3, aplican: 2, noAplican: 1, sinControl: 1, aprobadaPor: U, aprobadaEn: '2026-11-13T02:30:00.000Z', ...o });
/** Justificación coherente con `filas()`: lo que aplica trae un motivo; lo que no aplica, nada. */
const justificacion = (o: Partial<JustificacionBorrador> = {}): JustificacionBorrador => ({
  conMotivo: 2, sinMotivo: 0, riesgosVigentes: 0, riesgosSinTratamiento: 0, bloqueos: [], faltaPlanTratamiento: false, referencias: [], escala: { escalaMax: 5, corteMedio: 5, corteAlto: 10, corteCritico: 16 },
  filas: filas().map((f) => ({ libreriaCodigo: f.libreriaCodigo, idEstable: f.idEstable, sinMotivo: false, motivos: f.aplicabilidad === 'aplica' ? [{ tipo: 'negocio' as const, nota: 'Necesidad del negocio' }] : [], riesgos: [] })),
  ...o,
});
const declaracion = (o: Partial<Declaracion> = {}): Declaracion => ({ norma: 'ISO/IEC 27001', hoy: '2026-11-12', resumen: { total: 3, aplican: 2, noAplican: 1, porDecidir: 0, sinControl: 1, aprobable: true }, filas: filas(), alcance: { texto: 'Desarrollo de software', aprobado: true }, ultimaVersion: version(), justificacion: justificacion(), ...o });
const base = { empresa, persona: admin, declaracion: declaracion(), versiones: [version(), version({ id: V1, numero: 1 })], aviso: null };

describe('PantallaDeclaracion', () => {
  it('no tiene violaciones de accesibilidad (axe) en ninguno de sus estados', async () => {
    const estados = [
      <PantallaDeclaracion key="a" {...base} aviso="declaracion_aprobada" />,
      <PantallaDeclaracion key="b" {...base} persona={colaborador} aviso="declaracion_no_aprobada" />,
      <PantallaDeclaracion key="c" {...base} versiones={[]} declaracion={declaracion({ alcance: null, ultimaVersion: null })} />,
      <PantallaDeclaracion key="d" {...base} declaracion={declaracion({ filas: [fila({ aplicabilidad: 'por_decidir', implementacion: null })], resumen: { total: 1, aplican: 0, noAplican: 0, porDecidir: 1, sinControl: 0, aprobable: false } })} />,
      <PantallaDeclaracion key="e" {...base} versiones={[]} declaracion={declaracion({ filas: [], resumen: { total: 0, aplican: 0, noAplican: 0, porDecidir: 0, sinControl: 0, aprobable: false }, alcance: null, ultimaVersion: null })} />,
    ];
    for (const e of estados) {
      const { container, unmount } = render(e);
      expect(await axe(container)).toHaveNoViolations();
      unmount();
    }
  });

  it('muestra el resumen, cada fila con su aplicabilidad, justificación y controles', () => {
    const { container } = render(<PantallaDeclaracion {...base} />);
    const t = container.textContent ?? '';
    for (const x of ['Declaración de Aplicabilidad', 'Políticas de seguridad', 'Roles y responsabilidades', 'No hay personal propio', 'C-001', 'Sin control asignado', 'Implementado', 'Parcial', 'Con evidencia vigente', 'Desarrollo de software', 'Alcance aprobado', '2026-11-12']) expect(t, x).toContain(x);
  });

  it('el administrador ve «Aprobar» habilitado cuando se puede y dentro de un formulario POST hacia su ruta', () => {
    const { container } = render(<PantallaDeclaracion {...base} />);
    const form = container.querySelector('form[action="/e/empresa-a/declaracion/aprobar"]') as HTMLFormElement;
    expect(form.method).toBe('post');
    const boton = within(form).getByRole('button', { name: 'Aprobar la declaración' }) as HTMLButtonElement;
    expect(boton.disabled).toBe(false);
  });

  it('con controles por decidir, «Aprobar» queda deshabilitado y se explica por qué', () => {
    const d = declaracion({ filas: [fila({ aplicabilidad: 'por_decidir', implementacion: null }), fila({ idEstable: 'a27-5-2', aplicabilidad: 'por_decidir', implementacion: null })], resumen: { total: 2, aplican: 0, noAplican: 0, porDecidir: 2, sinControl: 0, aprobable: false } });
    const { container } = render(<PantallaDeclaracion {...base} declaracion={d} />);
    expect((within(container.querySelector('form[action$="/declaracion/aprobar"]')!).getByRole('button', { name: 'Aprobar la declaración' }) as HTMLButtonElement).disabled).toBe(true);
    expect(container.textContent).toContain('Quedan 2 controles por decidir');
  });

  it('el colaborador no ve el formulario de aprobar, pero sí puede descargar el borrador', () => {
    const { container, getByRole } = render(<PantallaDeclaracion {...base} persona={colaborador} />);
    expect(container.querySelector('form[action$="/declaracion/aprobar"]')).toBeNull();
    expect(container.textContent).toContain('Solo el administrador SIG puede aprobar');
    expect((getByRole('link', { name: 'Descargar borrador (Word)' }) as HTMLAnchorElement).getAttribute('href')).toBe('/e/empresa-a/declaracion/documento');
  });

  it('lista las versiones con su fecha de Ecuador, conteos y enlaces a ver y descargar', () => {
    const { getByRole, container } = render(<PantallaDeclaracion {...base} />);
    expect(container.textContent).toContain('Versión 2');
    expect(container.textContent).toContain('Aprobada el 2026-11-12'); // 02:30 UTC del 13 es todavía el 12 en Ecuador
    expect((getByRole('link', { name: 'Ver versión 2' }) as HTMLAnchorElement).getAttribute('href')).toBe(`/e/empresa-a/declaracion/versiones/${V2}`);
    expect((getByRole('link', { name: 'Descargar Word, versión 1' }) as HTMLAnchorElement).getAttribute('href')).toBe(`/e/empresa-a/declaracion/versiones/${V1}/documento`);
  });

  it('sin versiones lo dice; sin controles del Anexo A explica cómo adoptarlos', () => {
    const a = render(<PantallaDeclaracion {...base} versiones={[]} />);
    expect(a.container.textContent).toContain('Todavía no hay versiones aprobadas');
    a.unmount();
    const b = render(<PantallaDeclaracion {...base} declaracion={declaracion({ filas: [], resumen: { total: 0, aplican: 0, noAplican: 0, porDecidir: 0, sinControl: 0, aprobable: false } })} />);
    expect(b.container.textContent).toContain('No hay controles del Anexo A');
    expect(b.container.querySelector('form[action$="/aprobar"]')).toBeNull();
  });

  it('un texto con marcado (justificación o título) se muestra como texto, nunca como HTML', () => {
    const hostil = '<img src=x onerror=alert(1)>';
    const d = declaracion({ filas: [fila({ aplicabilidad: 'no_aplica', implementacion: null, justificacion: hostil, titulo: hostil, controles: [], cobertura: 'no_aplica' })], resumen: { total: 1, aplican: 0, noAplican: 1, porDecidir: 0, sinControl: 0, aprobable: true }, alcance: { texto: hostil, aprobado: false } });
    const { container } = render(<PantallaDeclaracion {...base} declaracion={d} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain(hostil);
  });

  it('el enlace de la navegación marca «Declaración» como página actual', () => {
    const { getByRole } = render(<PantallaDeclaracion {...base} />);
    expect(getByRole('link', { name: 'Declaración' }).getAttribute('aria-current')).toBe('page');
  });
});

describe('PantallaVersionDeclaracion', () => {
  const v: VersionDeclaracionConFilas = { ...version(), alcance: 'Alcance congelado', filas: filas(), justificacion: null };
  it('no tiene violaciones de accesibilidad (axe), con y sin alcance', async () => {
    const a = render(<PantallaVersionDeclaracion empresa={empresa} persona={admin} version={v} />);
    expect(await axe(a.container)).toHaveNoViolations();
    a.unmount();
    const b = render(<PantallaVersionDeclaracion empresa={empresa} persona={colaborador} version={{ ...v, alcance: null }} />);
    expect(await axe(b.container)).toHaveNoViolations();
  });
  it('muestra la versión congelada, su alcance, la descarga y el regreso', () => {
    const { container, getByRole } = render(<PantallaVersionDeclaracion empresa={empresa} persona={admin} version={v} />);
    const t = container.textContent ?? '';
    for (const x of ['Declaración de Aplicabilidad, versión 2', 'congelada', 'Alcance congelado', 'Aprobada el 2026-11-12', 'Separación de funciones']) expect(t, x).toContain(x);
    expect((getByRole('link', { name: 'Descargar Word' }) as HTMLAnchorElement).getAttribute('href')).toBe(`/e/empresa-a/declaracion/versiones/${V2}/documento`);
    expect((getByRole('link', { name: 'Volver a la declaración' }) as HTMLAnchorElement).getAttribute('href')).toBe('/e/empresa-a/declaracion');
  });
});
