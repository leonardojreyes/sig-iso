import { render, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import type { ControlMarco, MarcoControles } from '../api/tipos';
import { PantallaControles, type OpcionEntrada } from './controles';

const empresa = { id: 'empresa-a', nombre: 'Empresa A (prueba)', primario: '#0b5fff' };
const admin = { nombre: 'Laura Mena', roles: ['administrador_sig'] as const };
const colaborador = { nombre: 'Pedro Soto', roles: ['colaborador'] as const };
const lector = { nombre: 'Rosa Lema', roles: ['auditor_externo'] as const };
const ID1 = 'cccccccc-1111-4111-8111-111111111111';
const ID2 = 'cccccccc-2222-4222-8222-222222222222';

const control = (c: Partial<ControlMarco> = {}): ControlMarco => ({
  id: ID1, codigo: 'C-001', nombre: 'Política de contraseñas', descripcion: 'Cada 90 días.', responsableId: null, estado: 'vigente', version: 3,
  mapeos: [
    { libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1', entrada: { tipo: 'control', titulo: 'Políticas de seguridad', aplicaA: [{ norma: 'ISO/IEC 27001', edicion: '2022', clausula: 'A.5.1' }] } },
    { libreriaCodigo: 'ejemplo-ha', idEstable: 'ha-4.1', entrada: null },
  ],
  normas: ['ISO/IEC 27001'], ...c,
});
const marco = (c: Partial<MarcoControles> = {}): MarcoControles => ({ controles: [control(), control({ id: ID2, codigo: 'C-002', nombre: 'Revisión de accesos', descripcion: null, mapeos: [], normas: [], estado: 'retirado', version: 2 })], normas: ['ISO 9001', 'ISO/IEC 27001'], ...c });
const opciones: OpcionEntrada[] = [
  { libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1', titulo: 'Políticas de seguridad', tipo: 'control' },
  { libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-2', titulo: 'Roles y responsabilidades', tipo: 'control' },
];
const base = { empresa, persona: admin, marco: marco(), opciones, filtros: {}, filtrosInvalidos: false };

describe('PantallaControles', () => {
  it('no tiene violaciones de accesibilidad (axe)', async () => {
    const { container } = render(<PantallaControles {...base} aviso="conflicto" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('tampoco sin controles ni como lector (axe)', async () => {
    const vacio = render(<PantallaControles {...base} marco={marco({ controles: [] })} />);
    expect(await axe(vacio.container)).toHaveNoViolations();
    vacio.unmount();
    const lectura = render(<PantallaControles {...base} persona={lector} opciones={[]} />);
    expect(await axe(lectura.container)).toHaveNoViolations();
  });

  it('muestra cada control con sus normas y su estado, con texto (no solo color)', () => {
    const { container } = render(<PantallaControles {...base} />);
    expect(within(container).getByText(/Política de contraseñas/)).toBeTruthy();
    expect(within(container).getByText('ISO/IEC 27001', { selector: 'li span' })).toBeTruthy();
    expect(within(container).getByText('Vigente')).toBeTruthy();
    expect(within(container).getByText('Retirado')).toBeTruthy();
    expect(within(container).getByText('Todavía no cubre ninguna norma')).toBeTruthy();
  });

  it('una entrada que ya no está adoptada se rotula, sin inventar su título', () => {
    const { container } = render(<PantallaControles {...base} />);
    expect(within(container).getByText('Entrada que su empresa ya no tiene adoptada')).toBeTruthy();
    expect(within(container).getByText('ha-4.1')).toBeTruthy();
  });

  it('el administrador ve los formularios, todos hacia rutas propias y sin campo de empresa', () => {
    const { container } = render(<PantallaControles {...base} filtros={{ norma: 'ISO 9001', retirados: true }} />);
    for (const accion of ['crear', 'cambiar', 'retirar', 'mapear', 'desmapear']) {
      const forms = container.querySelectorAll(`form[action="/e/empresa-a/controles/${accion}"]`);
      expect(forms.length, accion).toBeGreaterThan(0);
      for (const f of forms) {
        expect(f.getAttribute('method')).toBe('post');
        expect(f.querySelector('[name="empresaId"], [name="empresa"]')).toBeNull();
      }
    }
    const cambiar = container.querySelector('form[action$="/controles/cambiar"]')!;
    expect((cambiar.querySelector('input[name="version"]') as HTMLInputElement).value).toBe('3');
    expect((cambiar.querySelector('input[name="id"]') as HTMLInputElement).value).toBe(ID1);
    expect((cambiar.querySelector('input[name="f_norma"]') as HTMLInputElement).value).toBe('ISO 9001');
    expect((cambiar.querySelector('input[name="f_retirados"]') as HTMLInputElement).value).toBe('true');
  });

  it('un control retirado no ofrece cambiar, retirar ni relacionar, y lo explica', () => {
    const { container } = render(<PantallaControles {...base} marco={marco({ controles: [control({ id: ID2, codigo: 'C-002', estado: 'retirado' })] })} />);
    expect(container.querySelector('form[action$="/controles/cambiar"]')).toBeNull();
    expect(container.querySelector('form[action$="/controles/retirar"]')).toBeNull();
    expect(container.querySelector('form[action$="/controles/mapear"]')).toBeNull();
    expect(container.querySelector('form[action$="/controles/desmapear"]')).toBeNull();
    expect(within(container).getByText(/Retirado: ya no se cambia ni recibe relaciones/)).toBeTruthy();
    expect(container.querySelector('form[action$="/controles/crear"]')).not.toBeNull();
  });

  it('el desplegable de relacionar no ofrece lo ya relacionado', () => {
    const { container } = render(<PantallaControles {...base} />);
    const valores = [...container.querySelectorAll('form[action$="/controles/mapear"] option')].map((o) => (o as HTMLOptionElement).value);
    expect(valores).toContain('iso-27001-2022-anexo-a|a27-5-2');
    expect(valores).not.toContain('iso-27001-2022-anexo-a|a27-5-1');
  });

  it('quien no administra solo lee: sin formularios y con el motivo', () => {
    for (const persona of [colaborador, lector]) {
      const { container } = render(<PantallaControles {...base} persona={persona} opciones={[]} />);
      expect(container.querySelector('form[action*="/controles/"]')).toBeNull();
      expect(within(container).getByText(/Solo el administrador SIG puede crear, cambiar, retirar y relacionar/)).toBeTruthy();
      expect(within(container).getByText(/Política de contraseñas/)).toBeTruthy();
    }
  });

  it('sin controles invita a crear (administrador) o a pedirlo (otros); con filtros dice «sin controles»', () => {
    const vacio = marco({ controles: [] });
    expect(within(render(<PantallaControles {...base} marco={vacio} />).container).getByText('Aún no hay controles')).toBeTruthy();
    expect(within(render(<PantallaControles {...base} persona={colaborador} marco={vacio} />).container).getByText(/Pida al administrador SIG/)).toBeTruthy();
    expect(within(render(<PantallaControles {...base} marco={vacio} filtros={{ norma: 'ISO 9001' }} />).container).getByText('Sin controles')).toBeTruthy();
  });

  it('avisa de los filtros inválidos y conserva lo elegido', () => {
    const { container } = render(<PantallaControles {...base} filtrosInvalidos filtros={{ retirados: true }} />);
    expect(within(container).getByText('Algunos filtros no eran válidos y se ignoraron.')).toBeTruthy();
    expect((container.querySelector('input[name="retirados"]') as HTMLInputElement).checked).toBe(true);
  });

  it('no inyecta HTML de los datos (escapa el texto)', () => {
    const { container } = render(<PantallaControles {...base} marco={marco({ controles: [control({ nombre: '<img src=x onerror=alert(1)>', descripcion: '<script>alert(1)</script>' })] })} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });
});
