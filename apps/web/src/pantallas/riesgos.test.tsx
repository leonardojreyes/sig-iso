import { render, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import type { AvisoRetiroRiesgo, RiesgoDetalle, RiesgoListado } from '../api/tipos';
import { PantallaRiesgoDetalle } from './riesgo-detalle';
import { PantallaRiesgos, type OpcionPersona } from './riesgos';

const empresa = { id: 'empresa-a', nombre: 'Empresa A (prueba)', primario: '#0b5fff' };
const admin = { nombre: 'Laura Mena', roles: ['administrador_sig'] as const };
const colaborador = { nombre: 'Pedro Soto', roles: ['colaborador'] as const };
const R1 = 'eeeeeeee-1111-4111-8111-111111111111';
const R2 = 'eeeeeeee-2222-4222-8222-222222222222';
const C1 = 'cccccccc-1111-4111-8111-111111111111';
const C2 = 'cccccccc-2222-4222-8222-222222222222';
const U = '11111111-1111-4111-8111-1111111111a1';
const personas: OpcionPersona[] = [{ id: U, nombre: 'Laura Mena' }];

const listado = (o: Partial<RiesgoListado> = {}): RiesgoListado => ({
  id: R1, codigo: 'R-001', titulo: 'Pérdida de portátiles', descripcion: 'Robo o extravío.', probabilidad: 3, impacto: 4, puntaje: 12, nivel: 'alto', decision: 'mitigar', responsableId: null, estado: 'vigente', version: 2,
  controles: 1, tratamientosPrevistos: 0, sinTratamiento: false, ...o,
});
const lista = (): RiesgoListado[] => [
  listado(),
  listado({ id: R2, codigo: 'R-002', titulo: 'Fuga de información', descripcion: null, probabilidad: 5, impacto: 5, puntaje: 25, nivel: 'critico', controles: 0, sinTratamiento: true }),
  listado({ id: 'eeeeeeee-3333-4333-8333-333333333333', codigo: 'R-003', titulo: 'Ya retirado', probabilidad: 1, impacto: 2, puntaje: 2, nivel: 'bajo', estado: 'retirado', controles: 0 }),
];
const base = { empresa, persona: admin, riesgos: lista(), personas, filtros: {}, filtrosInvalidos: false, aviso: null };

describe('PantallaRiesgos', () => {
  it('no tiene violaciones de accesibilidad (axe) en ninguno de sus estados', async () => {
    const estados = [
      <PantallaRiesgos key="a" {...base} />,
      <PantallaRiesgos key="b" {...base} aviso="riesgo_creado" />,
      <PantallaRiesgos key="c" {...base} persona={colaborador} />,
      <PantallaRiesgos key="d" {...base} riesgos={[]} />,
      <PantallaRiesgos key="e" {...base} riesgos={[]} persona={colaborador} />,
      <PantallaRiesgos key="f" {...base} filtros={{ retirados: true }} />,
      <PantallaRiesgos key="g" {...base} filtrosInvalidos />,
      <PantallaRiesgos key="h" {...base} aviso="conflicto" />,
    ];
    for (const e of estados) {
      const { container, unmount } = render(e);
      expect(await axe(container)).toHaveNoViolations();
      unmount();
    }
  });

  it('muestra el nivel SIEMPRE con palabras y con el cálculo que lo explica (no solo por color)', () => {
    const { container } = render(<PantallaRiesgos {...base} />);
    for (const t of ['Alto (3 × 4 = 12)', 'Crítico (5 × 5 = 25)', 'Bajo (1 × 2 = 2)']) expect(container.textContent, t).toContain(t);
  });

  it('señala los «mitigar» sin ningún control ni tratamiento previsto, y los retirados', () => {
    const { container } = render(<PantallaRiesgos {...base} />);
    expect(container.textContent).toContain('Mitigar sin ningún control ni tratamiento previsto');
    expect(container.textContent).toContain('1 control · 0 tratamientos previstos');
    expect(container.textContent).toContain('Retirado');
  });

  it('cada riesgo enlaza a su detalle con un nombre accesible que dice cuál es', () => {
    const { getByRole } = render(<PantallaRiesgos {...base} />);
    expect(getByRole('link', { name: 'Ver el detalle del riesgo R-001' }).getAttribute('href')).toBe(`/e/empresa-a/riesgos/${R1}`);
  });

  it('el administrador ve el formulario de creación; quien solo consulta, no', () => {
    const a = render(<PantallaRiesgos {...base} />);
    const form = a.container.querySelector('form[action="/e/empresa-a/riesgos/crear"]');
    expect(form).not.toBeNull();
    expect(form?.getAttribute('method')).toBe('post');
    const dentro = within(form as HTMLElement);
    for (const n of ['Título', 'Descripción', 'Probabilidad (1 a 5)', 'Impacto (1 a 5)', 'Decisión de tratamiento', 'Responsable']) expect(dentro.getByLabelText(n), n).toBeTruthy();
    expect(a.container.textContent).toContain('probabilidad por impacto');
    a.unmount();
    const b = render(<PantallaRiesgos {...base} persona={colaborador} />);
    expect(b.container.querySelector('form[action$="/riesgos/crear"]')).toBeNull();
    expect(b.container.textContent).toContain('Solo el administrador SIG');
  });

  it('el formulario no tiene campos de empresa, nivel, código ni estado: los decide el sistema', () => {
    const { container } = render(<PantallaRiesgos {...base} />);
    const nombres = [...container.querySelectorAll('form[action$="/riesgos/crear"] [name]')].map((e) => e.getAttribute('name'));
    expect(nombres.sort()).toEqual(['decision', 'descripcion', 'impacto', 'probabilidad', 'responsableId', 'titulo']);
  });

  it('avisa que los textos no deben llevar datos personales ni texto de las normas', () => {
    expect(render(<PantallaRiesgos {...base} />).container.textContent).toContain('No escriba datos personales ni texto de las normas');
  });

  it('la lista de responsables trae «Sin responsable» y las personas; la decisión «Aceptar» explica por qué se pide responsable', () => {
    const { container } = render(<PantallaRiesgos {...base} />);
    const sel = container.querySelector('#nuevo-responsable') as HTMLSelectElement;
    expect([...sel.options].map((o) => o.textContent)).toEqual(['Sin responsable', 'Laura Mena']);
    expect(container.textContent).toContain('Obligatorio si la decisión es «Aceptar»');
  });

  it('sin riesgos muestra el estado vacío según el rol', () => {
    expect(render(<PantallaRiesgos {...base} riesgos={[]} />).container.textContent).toContain('Cree el primer riesgo');
    expect(render(<PantallaRiesgos {...base} riesgos={[]} persona={colaborador} />).container.textContent).toContain('todavía no registró riesgos');
  });

  it('marca la entrada de navegación «Riesgos» como la página actual', () => {
    const { getByRole } = render(<PantallaRiesgos {...base} />);
    expect(getByRole('link', { name: 'Riesgos' }).getAttribute('aria-current')).toBe('page');
  });
});

const detalle = (o: Partial<RiesgoDetalle> = {}): RiesgoDetalle => ({
  ...listado(), controles: [{ id: C1, codigo: 'C-001', nombre: 'Cifrado de discos', estado: 'vigente' }, { id: C2, codigo: 'C-002', nombre: 'Copias', estado: 'retirado' }],
  tratamientosPrevistos: [{ libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1', titulo: 'Políticas de seguridad' }, { libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-9', titulo: null }], ...o,
});
const aviso = (n = 1): AvisoRetiroRiesgo => ({ riesgoId: R1, codigo: 'R-001', controlesSinMotivo: Array.from({ length: n }, (_, i) => ({ libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: `a27-5-${i + 1}`, titulo: `Control ${i + 1}` })) });
const disponibles = [{ id: C1, codigo: 'C-001', nombre: 'Cifrado de discos' }, { id: 'cccccccc-3333-4333-8333-333333333333', codigo: 'C-003', nombre: 'Accesos' }];
const anexo = [{ libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1', titulo: 'Políticas de seguridad' }, { libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-2', titulo: 'Roles y responsabilidades' }];
const det = { empresa, persona: admin, riesgo: detalle(), aviso: aviso(), controlesDisponibles: disponibles, opcionesAnexo: anexo, personas, avisoEscritura: null };

describe('PantallaRiesgoDetalle', () => {
  it('no tiene violaciones de accesibilidad (axe) en ninguno de sus estados', async () => {
    const estados = [
      <PantallaRiesgoDetalle key="a" {...det} />,
      <PantallaRiesgoDetalle key="b" {...det} avisoEscritura="vinculado" />,
      <PantallaRiesgoDetalle key="c" {...det} persona={colaborador} aviso={null} controlesDisponibles={[]} opcionesAnexo={[]} personas={[]} />,
      <PantallaRiesgoDetalle key="d" {...det} aviso={aviso(0)} />,
      <PantallaRiesgoDetalle key="e" {...det} aviso={aviso(3)} />,
      <PantallaRiesgoDetalle key="f" {...det} aviso={null} />,
      <PantallaRiesgoDetalle key="g" {...det} riesgo={detalle({ estado: 'retirado' })} aviso={null} />,
      <PantallaRiesgoDetalle key="h" {...det} riesgo={detalle({ controles: [], tratamientosPrevistos: [] })} controlesDisponibles={[]} opcionesAnexo={[]} />,
      <PantallaRiesgoDetalle key="i" {...det} avisoEscritura="conflicto" />,
    ];
    for (const e of estados) {
      const { container, unmount } = render(e);
      expect(await axe(container)).toHaveNoViolations();
      unmount();
    }
  });

  it('muestra el código, el nivel con palabras y la decisión', () => {
    const { container, getByRole } = render(<PantallaRiesgoDetalle {...det} />);
    expect(getByRole('heading', { level: 1 }).textContent).toContain('R-001');
    expect(container.textContent).toContain('Alto (3 × 4 = 12)');
    expect(container.textContent).toContain('Mitigar');
  });

  it('lista los controles (marcando el retirado) y los tratamientos previstos (avisando la entrada que ya no está adoptada)', () => {
    const { container } = render(<PantallaRiesgoDetalle {...det} />);
    expect(container.textContent).toContain('C-001');
    expect(container.textContent).toContain('Control retirado: el vínculo se conserva');
    expect(container.textContent).toContain('Políticas de seguridad');
    expect(container.textContent).toContain('ya no está entre las librerías adoptadas');
  });

  it('cada botón de quitar dice a qué riesgo y a qué control o entrada se refiere', () => {
    const { getByRole } = render(<PantallaRiesgoDetalle {...det} />);
    expect(getByRole('button', { name: 'Quitar el vínculo del riesgo R-001 con el control C-001' })).toBeTruthy();
    expect(getByRole('button', { name: 'Quitar el tratamiento previsto a27-5-1 del riesgo R-001' })).toBeTruthy();
  });

  it('ofrece vincular solo con los controles que aún no trata y prever solo con los del Anexo A que aún no están previstos', () => {
    const { container } = render(<PantallaRiesgoDetalle {...det} />);
    const controles = container.querySelector('#vincular-control') as HTMLSelectElement;
    expect([...controles.options].map((o) => o.value).filter(Boolean)).toEqual(['cccccccc-3333-4333-8333-333333333333']); // C-001 ya lo trata
    const previstos = container.querySelector('#prever-entrada') as HTMLSelectElement;
    expect([...previstos.options].map((o) => o.value).filter(Boolean)).toEqual(['iso-27001-2022-anexo-a|a27-5-2']); // a27-5-1 ya está previsto
  });

  it('los formularios llevan el riesgo y la versión que se vio, y nunca la empresa', () => {
    const { container } = render(<PantallaRiesgoDetalle {...det} />);
    const cambiar = container.querySelector('form[action="/e/empresa-a/riesgos/cambiar"]') as HTMLFormElement;
    expect(cambiar.querySelector('[name="riesgoId"]')?.getAttribute('value')).toBe(R1);
    expect(cambiar.querySelector('[name="version"]')?.getAttribute('value')).toBe('2');
    const retirar = container.querySelector('form[action="/e/empresa-a/riesgos/retirar"]') as HTMLFormElement;
    expect(retirar.querySelector('[name="version"]')?.getAttribute('value')).toBe('2');
    for (const f of container.querySelectorAll('form')) expect([...f.querySelectorAll('[name]')].map((e) => e.getAttribute('name')).filter((n) => /empresa|tenant|nivel|codigo|estado/i.test(n ?? ''))).toEqual([]);
  });

  it('AVISO PREVIO al retiro: dice qué controles quedarían sin motivo, o que no deja ninguno', () => {
    const con = render(<PantallaRiesgoDetalle {...det} aviso={aviso(2)} />);
    expect(con.container.textContent).toContain('Si lo retira, 2 controles del Anexo A quedarán sin motivo');
    expect(con.container.textContent).toContain('Control 1');
    expect(con.container.textContent).toContain('Sin motivo no se podrá aprobar la Declaración');
    con.unmount();
    expect(render(<PantallaRiesgoDetalle {...det} aviso={aviso(1)} />).container.textContent).toContain('1 control del Anexo A quedará sin motivo');
    expect(render(<PantallaRiesgoDetalle {...det} aviso={aviso(0)} />).container.textContent).toContain('no deja ningún control del Anexo A sin motivo');
  });

  it('si no se pudo calcular el aviso lo dice, y aun así deja retirar', () => {
    const { container, getByRole } = render(<PantallaRiesgoDetalle {...det} aviso={null} />);
    expect(container.textContent).toContain('No se pudo calcular el efecto del retiro');
    expect(getByRole('button', { name: 'Retirar el riesgo R-001' })).toBeTruthy();
  });

  it('el aviso está ANTES del botón de retirar', () => {
    const { container } = render(<PantallaRiesgoDetalle {...det} aviso={aviso(1)} />);
    const html = container.innerHTML;
    expect(html.indexOf('quedará sin motivo')).toBeGreaterThan(-1);
    expect(html.indexOf('quedará sin motivo')).toBeLessThan(html.indexOf('riesgos/retirar'));
  });

  it('quien solo consulta ve todo pero ninguna acción; un riesgo retirado tampoco admite cambios', () => {
    const a = render(<PantallaRiesgoDetalle {...det} persona={colaborador} aviso={null} controlesDisponibles={[]} opcionesAnexo={[]} />);
    expect(a.container.querySelectorAll('form').length).toBe(1); // solo «Cerrar sesión»
    expect(a.container.textContent).toContain('C-001');
    a.unmount();
    const b = render(<PantallaRiesgoDetalle {...det} riesgo={detalle({ estado: 'retirado' })} aviso={null} />);
    expect(b.container.querySelectorAll('form').length).toBe(1);
    expect(b.container.textContent).toContain('Este riesgo está retirado');
  });

  it('el enlace de regreso lleva a la lista', () => {
    const { getByRole } = render(<PantallaRiesgoDetalle {...det} />);
    expect(getByRole('link', { name: 'Volver a la lista de riesgos' }).getAttribute('href')).toBe('/e/empresa-a/riesgos');
  });

  it('el responsable actual que ya no tiene acceso se conserva como opción, sin nombre', () => {
    const { container } = render(<PantallaRiesgoDetalle {...det} riesgo={detalle({ responsableId: '33333333-3333-4333-8333-333333333333' })} />);
    const sel = container.querySelector('#cambiar-responsable') as HTMLSelectElement;
    expect(sel.value).toBe('33333333-3333-4333-8333-333333333333');
    expect([...sel.options].map((o) => o.textContent)).toContain('Sin responsable asignado');
  });
});
