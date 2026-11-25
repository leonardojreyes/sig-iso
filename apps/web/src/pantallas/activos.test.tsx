import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import type { Activo, ActivoDetalle, ActivoListado, AvisoRetiroActivo } from '../activos/tipos';
import type { RiesgoDetalle } from '../api/tipos';
import type { PersonaDirectorio } from '../documentos/tipos';
import { PantallaActivoDetalle } from './activo-detalle';
import { PantallaActivos } from './activos';
import { PantallaRiesgoDetalle } from './riesgo-detalle';

const empresa = { id: 'empresa-a', nombre: 'Empresa A (prueba)', primario: '#0b5fff' };
const admin = { nombre: 'Laura Mena', roles: ['administrador_sig'] as const };
const colab = { nombre: 'Pedro Soto', roles: ['colaborador'] as const };
const A1 = 'aaaaaaaa-1111-4111-8111-111111111111';
const A2 = 'aaaaaaaa-2222-4222-8222-222222222222';
const R1 = 'dddddddd-1111-4111-8111-111111111111';
const U1 = '11111111-1111-4111-8111-1111111111a1';
const U3 = '33333333-3333-4333-8333-3333333333c3';
const personas: PersonaDirectorio[] = [
  { id: U1, nombre: 'Laura Mena', activa: true, puedeAprobar: true },
  { id: U3, nombre: 'Dario Retirado', activa: false, puedeAprobar: false },
];

const activo = (o: Partial<ActivoListado> = {}): ActivoListado => ({ id: A1, codigo: 'A-001', nombre: 'Servidor de archivos', descripcion: 'Guarda documentos.', tipo: 'infraestructura', clasificacion: 'confidencial', responsableId: U1, estado: 'vigente', version: 2, riesgos: 1, sinRiesgos: false, ...o });
const lista = (): ActivoListado[] => [
  activo(),
  activo({ id: A2, codigo: 'A-002', nombre: 'Base de clientes', tipo: 'informacion', riesgos: 0, sinRiesgos: true, responsableId: U3 }),
  activo({ id: 'aaaaaaaa-3333-4333-8333-333333333333', codigo: 'A-003', nombre: 'Equipo retirado', estado: 'retirado', riesgos: 0, sinRiesgos: false }),
];
const base = { empresa, persona: admin, activos: lista(), personas, filtros: {}, filtrosInvalidos: false, aviso: null };

describe('PantallaActivos', () => {
  it('no tiene violaciones de accesibilidad (axe) en ninguno de sus estados', async () => {
    const estados = [
      <PantallaActivos key="a" {...base} />,
      <PantallaActivos key="b" {...base} aviso="activo_creado" />,
      <PantallaActivos key="c" {...base} persona={colab} />,
      <PantallaActivos key="d" {...base} activos={[]} />,
      <PantallaActivos key="e" {...base} activos={[]} persona={colab} />,
      <PantallaActivos key="f" {...base} filtros={{ tipo: 'persona', retirados: true }} />,
      <PantallaActivos key="g" {...base} filtrosInvalidos />,
      <PantallaActivos key="h" {...base} aviso="conflicto" />,
    ];
    for (const e of estados) {
      const { container, unmount } = render(e);
      expect(await axe(container)).toHaveNoViolations();
      unmount();
    }
  });
  it('avisa con palabras (no solo color) los activos sin riesgos, los retirados y las personas dadas de baja', () => {
    const { container } = render(<PantallaActivos {...base} />);
    for (const t of ['Sin ningún riesgo ligado', 'Retirado', '1 riesgo vigente', '0 riesgos vigentes', 'Dario Retirado (persona dada de baja)', 'Infraestructura · Confidencial']) expect(container.textContent, t).toContain(t);
  });
  it('el alta solo la ve quien administra, es POST a una ruta propia y no lleva empresa, código ni estado', () => {
    const a = render(<PantallaActivos {...base} />).container;
    const f = a.querySelector('form[action="/e/empresa-a/activos/crear"]')!;
    expect(f.getAttribute('method')).toBe('post');
    expect(f.querySelector('[name="empresa"], [name="empresaId"], [name="codigo"], [name="estado"]')).toBeNull();
    expect(render(<PantallaActivos {...base} persona={colab} />).container.querySelector('form[action$="/crear"]')).toBeNull();
  });
  it('cada activo enlaza a su detalle con un nombre accesible', () => {
    const { container } = render(<PantallaActivos {...base} />);
    expect(container.querySelector(`a[href="/e/empresa-a/activos/${A1}"]`)?.getAttribute('aria-label')).toBe('Ver activo A-001');
  });
});

const detalle = (o: Partial<ActivoDetalle> = {}): ActivoDetalle => ({
  id: A1, codigo: 'A-001', nombre: 'Servidor de archivos', descripcion: 'Guarda documentos.', tipo: 'infraestructura', clasificacion: 'confidencial', responsableId: U1, estado: 'vigente', version: 2,
  riesgos: [{ id: R1, codigo: 'R-001', titulo: 'Pérdida de portátiles', nivel: 'alto', puntaje: 12, estado: 'vigente' }], nivelMasAlto: 'alto', ...o,
});
const aviso: AvisoRetiroActivo = { activoId: A1, codigo: 'A-001', riesgosSinActivo: [{ id: R1, codigo: 'R-001', titulo: 'Pérdida de portátiles' }] };
const baseDetalle = { empresa, persona: admin, activo: detalle(), personas, avisoRetiro: aviso, aviso: null };

describe('PantallaActivoDetalle', () => {
  it('no tiene violaciones de accesibilidad (axe) en ninguno de sus estados', async () => {
    const estados = [
      <PantallaActivoDetalle key="a" {...baseDetalle} />,
      <PantallaActivoDetalle key="b" {...baseDetalle} avisoRetiro={{ ...aviso, riesgosSinActivo: [] }} />,
      <PantallaActivoDetalle key="c" {...baseDetalle} persona={colab} avisoRetiro={null} />,
      <PantallaActivoDetalle key="d" {...baseDetalle} activo={detalle({ riesgos: [], nivelMasAlto: null })} />,
      <PantallaActivoDetalle key="e" {...baseDetalle} activo={detalle({ estado: 'retirado' })} avisoRetiro={null} />,
      <PantallaActivoDetalle key="f" {...baseDetalle} aviso="activo_guardado" />,
    ];
    for (const e of estados) {
      const { container, unmount } = render(e);
      expect(await axe(container)).toHaveNoViolations();
      unmount();
    }
  });
  it('muestra el nivel más alto con palabras y los riesgos con su nivel', () => {
    const { container } = render(<PantallaActivoDetalle {...baseDetalle} />);
    for (const t of ['Riesgo vigente más alto: Alto', 'Alto (12)', 'R-001', 'Pérdida de portátiles']) expect(container.textContent, t).toContain(t);
  });
  it('antes de retirar dice qué riesgos quedarían sin activo, y no ofrece editar ni retirar a quien solo consulta ni a un activo retirado', () => {
    const a = render(<PantallaActivoDetalle {...baseDetalle} />).container;
    expect(a.textContent).toContain('Este riesgo vigente quedaría sin ningún activo');
    expect(a.querySelector(`form[action="/e/empresa-a/activos/${A1}/retirar"]`)).not.toBeNull();
    const c = render(<PantallaActivoDetalle {...baseDetalle} persona={colab} avisoRetiro={null} />).container;
    expect(c.querySelector('form[action$="/retirar"], form[action$="/cambiar"]')).toBeNull();
    const r = render(<PantallaActivoDetalle {...baseDetalle} activo={detalle({ estado: 'retirado' })} avisoRetiro={null} />).container;
    expect(r.querySelector('form[action$="/retirar"], form[action$="/cambiar"]')).toBeNull();
    expect(r.textContent).toContain('Este activo está retirado');
  });
  it('los formularios de cambio llevan la versión que se vio y son POST', () => {
    const { container } = render(<PantallaActivoDetalle {...baseDetalle} />);
    for (const f of container.querySelectorAll('form[action$="/cambiar"], form[action$="/retirar"]')) {
      expect(f.getAttribute('method')).toBe('post');
      expect(f.querySelector('input[name="version"]')?.getAttribute('value')).toBe('2');
    }
  });
});

describe('activos en el detalle del riesgo', () => {
  const riesgo: RiesgoDetalle = { id: R1, codigo: 'R-001', titulo: 'Pérdida de portátiles', descripcion: null, probabilidad: 3, impacto: 4, puntaje: 12, nivel: 'alto', decision: 'mitigar', responsableId: null, estado: 'vigente', version: 1, controles: [], tratamientosPrevistos: [] };
  const props = { empresa, persona: admin, riesgo, aviso: null, controlesDisponibles: [], opcionesAnexo: [], personas: [] };
  const sencillo = (o: Partial<ActivoListado> = {}) => {
    const a: Record<string, unknown> = { ...activo(o) };
    delete a['riesgos'];
    delete a['sinRiesgos'];
    return a as unknown as Activo;
  };
  it('no tiene violaciones de accesibilidad y ofrece ligar y quitar con nombres que dicen cuál activo', async () => {
    const { container } = render(<PantallaRiesgoDetalle {...props} activosLigados={[sencillo()]} activosDisponibles={[sencillo(), sencillo({ id: A2, codigo: 'A-002', nombre: 'Base de clientes' })]} />);
    expect(await axe(container)).toHaveNoViolations();
    expect(container.querySelector('button[aria-label="Quitar la liga con el activo A-001"]')).not.toBeNull();
    const opciones = [...container.querySelectorAll('#ligar-activo option')].map((o) => o.textContent);
    expect(opciones).toContain('A-002 · Base de clientes');
    expect(opciones).not.toContain('A-001 · Servidor de archivos'); // ya está ligado
    expect(container.querySelector('form[action="/e/empresa-a/riesgos/ligar-activo"] input[name="riesgoId"]')?.getAttribute('value')).toBe(R1);
  });
  it('un riesgo sin activos lo dice (es un aviso) y quien solo consulta no ve formularios; sin la lista, la sección no aparece', () => {
    const vacio = render(<PantallaRiesgoDetalle {...props} persona={colab} activosLigados={[]} />).container;
    expect(vacio.textContent).toContain('Este riesgo no está ligado a ningún activo');
    expect(vacio.querySelector('form[action$="ligar-activo"], form[action$="desligar-activo"]')).toBeNull();
    expect(render(<PantallaRiesgoDetalle {...props} />).container.textContent).not.toContain('Activos que amenaza este riesgo');
  });
});
