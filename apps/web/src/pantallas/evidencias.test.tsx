import { render, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import type { Cobertura, ControlMarco, Evidencia } from '../api/tipos';
import { PantallaCobertura } from './cobertura';
import { PantallaEvidenciasControl } from './evidencias-control';

const empresa = { id: 'empresa-a', nombre: 'Empresa A (prueba)', primario: '#0b5fff' };
const admin = { nombre: 'Laura Mena', roles: ['administrador_sig'] as const };
const colaborador = { nombre: 'Pedro Soto', roles: ['colaborador'] as const };
const lector = { nombre: 'Rosa Lema', roles: ['auditor_externo'] as const };
const CONTROL = 'cccccccc-1111-4111-8111-111111111111';
const E1 = 'eeeeeeee-1111-4111-8111-111111111111';
const E2 = 'eeeeeeee-2222-4222-8222-222222222222';
const E3 = 'eeeeeeee-3333-4333-8333-333333333333';
const SHA = 'abcdef0123456789'.repeat(4);

const control = (c: Partial<ControlMarco> = {}): ControlMarco => ({ id: CONTROL, codigo: 'C-001', nombre: 'Política de contraseñas', descripcion: null, responsableId: null, estado: 'vigente', version: 1, mapeos: [], normas: [], ...c });
const evidencia = (c: Partial<Evidencia> = {}): Evidencia => ({
  id: E1, controlId: CONTROL, tipo: 'documento', titulo: 'Política aprobada', fechaHecho: '2026-11-01', vigenteHasta: '2027-06-30', estado: 'activa', reemplazaId: null, vigente: true, vencida: false,
  creadaEn: '2026-11-11T15:00:00.000Z', archivo: { nombre: 'politica.pdf', tipo: 'application/pdf', bytes: 1_536, sha256: SHA }, ...c,
});
const lista = (): Evidencia[] => [
  evidencia(),
  evidencia({ id: E2, titulo: 'Registro de revisión', tipo: 'registro', vigenteHasta: '2026-01-01', vigente: false, vencida: true, archivo: { nombre: 'registro.xlsx', tipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', bytes: 3_355_443, sha256: SHA } }),
  evidencia({ id: E3, titulo: 'Versión anterior', estado: 'reemplazada', vigente: false, vigenteHasta: null, reemplazaId: null }),
];
const base = { empresa, persona: admin, control: control(), evidencias: lista(), historial: true, hoy: '2026-11-11' };

describe('PantallaEvidenciasControl', () => {
  it('no tiene violaciones de accesibilidad (axe)', async () => {
    const { container } = render(<PantallaEvidenciasControl {...base} aviso="tipo_no_permitido" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('tampoco sin evidencias, con el control retirado ni como lector (axe)', async () => {
    const vacio = render(<PantallaEvidenciasControl {...base} evidencias={[]} />);
    expect(await axe(vacio.container)).toHaveNoViolations();
    vacio.unmount();
    const retirado = render(<PantallaEvidenciasControl {...base} control={control({ estado: 'retirado' })} />);
    expect(await axe(retirado.container)).toHaveNoViolations();
    retirado.unmount();
    const lectura = render(<PantallaEvidenciasControl {...base} persona={lector} />);
    expect(await axe(lectura.container)).toHaveNoViolations();
  });

  it('muestra cada evidencia con su vigencia (en texto), su archivo, su tamaño y su huella', () => {
    const { container } = render(<PantallaEvidenciasControl {...base} />);
    expect(within(container).getByText('Política aprobada')).toBeTruthy();
    expect(within(container).getByText('Vigente')).toBeTruthy();
    expect(within(container).getByText('Vencida')).toBeTruthy();
    expect(within(container).getByText('Reemplazada')).toBeTruthy();
    expect(within(container).getByText('Hasta el 2027-06-30')).toBeTruthy();
    expect(within(container).getAllByText(/PDF · 1,5 KB/).length).toBe(2); // la vigente y la del historial usan el mismo archivo de ejemplo
    expect(within(container).getByText(/Excel · 3,2 MB/)).toBeTruthy();
    const huella = container.querySelector(`[title="Huella SHA-256: ${SHA}"]`);
    expect(huella?.textContent).toContain('abcdef012345…');
  });

  it('la descarga es un enlace GET a la ruta propia de la web, no al API ni con el token', () => {
    const { container } = render(<PantallaEvidenciasControl {...base} />);
    const enlaces = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href')).filter((h) => h?.includes('/descargar'));
    expect(enlaces).toEqual([`/e/empresa-a/evidencias/${E1}/descargar`, `/e/empresa-a/evidencias/${E2}/descargar`, `/e/empresa-a/evidencias/${E3}/descargar`]);
  });

  it('la subida es un multipart POST a la ruta propia, con el archivo AL FINAL y sin campos de empresa', () => {
    const { container } = render(<PantallaEvidenciasControl {...base} />);
    const form = container.querySelector(`form[action="/e/empresa-a/controles/${CONTROL}/evidencias/subir"]`)!;
    expect(form.getAttribute('method')).toBe('post');
    expect(form.getAttribute('enctype')).toBe('multipart/form-data');
    const campos = [...form.querySelectorAll('input, select')].map((x) => x.getAttribute('name'));
    expect(campos.at(-1)).toBe('archivo');
    expect(campos).toEqual(expect.arrayContaining(['tipo', 'titulo', 'fechaHecho', 'vigenteHasta', 'archivo']));
    expect(form.querySelector('[name="empresaId"], [name="empresa"]')).toBeNull();
    const archivo = form.querySelector('input[type="file"]') as HTMLInputElement;
    expect(archivo.required).toBe(true);
    expect(archivo.accept).toBe('.pdf,.png,.jpg,.jpeg,.txt,.docx,.xlsx,.pptx');
    expect(form.querySelector('input[name="fechaHecho"]')?.getAttribute('max')).toBe('2026-11-11'); // el hecho no puede ser futuro
  });

  it('solo las activas se pueden reemplazar o eliminar; las del historial solo se descargan', () => {
    const { container } = render(<PantallaEvidenciasControl {...base} />);
    expect(container.querySelectorAll('form[action$="/reemplazar"]').length).toBe(2);
    expect(container.querySelectorAll('form[action$="/eliminar"]').length).toBe(2);
    expect(container.querySelector(`form[action="/e/empresa-a/evidencias/${E3}/eliminar"]`)).toBeNull();
    const reemplazo = container.querySelector(`form[action="/e/empresa-a/evidencias/${E1}/reemplazar"]`)!;
    expect(reemplazo.getAttribute('enctype')).toBe('multipart/form-data');
    expect((reemplazo.querySelector('input[name="control"]') as HTMLInputElement).value).toBe(CONTROL);
    expect((reemplazo.querySelector('input[name="f_historicas"]') as HTMLInputElement).value).toBe('true');
    expect([...reemplazo.querySelectorAll('input, select')].map((x) => x.getAttribute('name')).at(-1)).toBe('archivo');
  });

  it('el colaborador sube y reemplaza, pero no elimina; el lector solo consulta y descarga', () => {
    const colab = render(<PantallaEvidenciasControl {...base} persona={colaborador} />);
    expect(colab.container.querySelector('form[action$="/evidencias/subir"]')).not.toBeNull();
    expect(colab.container.querySelectorAll('form[action$="/reemplazar"]').length).toBe(2);
    expect(colab.container.querySelector('form[action$="/eliminar"]')).toBeNull();
    colab.unmount();
    const lect = render(<PantallaEvidenciasControl {...base} persona={lector} />);
    expect(lect.container.querySelector('form[action*="/evidencias/"]')).toBeNull();
    expect(lect.container.querySelector('form[action*="/subir"]')).toBeNull();
    expect(within(lect.container).getByText(/puede consultar y descargar evidencias, pero no registrarlas/)).toBeTruthy();
    expect(lect.container.querySelectorAll('a[href$="/descargar"]').length).toBe(3);
  });

  it('un control retirado no recibe evidencias nuevas ni reemplazos, y lo explica', () => {
    const { container } = render(<PantallaEvidenciasControl {...base} control={control({ estado: 'retirado' })} />);
    expect(container.querySelector('form[action$="/subir"]')).toBeNull();
    expect(container.querySelector('form[action$="/reemplazar"]')).toBeNull();
    expect(within(container).getByText(/Este control está retirado/)).toBeTruthy();
    expect(container.querySelector('a[href$="/descargar"]')).not.toBeNull(); // lo que ya tenía se sigue pudiendo descargar
  });

  it('sin evidencias invita a subir (quien puede) o a esperar (quien no)', () => {
    expect(within(render(<PantallaEvidenciasControl {...base} evidencias={[]} />).container).getByText(/Suba el primer archivo/)).toBeTruthy();
    expect(within(render(<PantallaEvidenciasControl {...base} persona={lector} evidencias={[]} />).container).getByText(/aparecerá aquí/)).toBeTruthy();
  });

  it('el enlace del historial alterna y la vista del historial se conserva en los formularios', () => {
    const con = render(<PantallaEvidenciasControl {...base} historial />);
    expect(con.container.querySelector(`a[href="/e/empresa-a/controles/${CONTROL}"]`)?.textContent).toBe('Ocultar el historial');
    con.unmount();
    const sin = render(<PantallaEvidenciasControl {...base} historial={false} />);
    expect(sin.container.querySelector(`a[href="/e/empresa-a/controles/${CONTROL}?historicas=true"]`)?.textContent).toBe('Ver también el historial');
    expect(sin.container.querySelector('input[name="f_historicas"]')).toBeNull();
  });

  it('no inyecta HTML de los datos (escapa el texto)', () => {
    const { container } = render(<PantallaEvidenciasControl {...base} evidencias={[evidencia({ titulo: '<img src=x onerror=alert(1)>', archivo: { nombre: '<script>alert(1)</script>.pdf', tipo: 'application/pdf', bytes: 10, sha256: SHA } })]} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });
});

const resumen = (c: Record<string, unknown> = {}) => ({ total: 4, cubiertas: 2, evidenciaVencida: 1, sinEvidencia: 1, sinControl: 0, porcentaje: 50, ...c });
const cobertura = (c: Partial<Cobertura> = {}): Cobertura => ({
  hoy: '2026-11-11',
  entradas: [
    { libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1', tipo: 'control', capitulo: null, grupo: 'Organizacionales', titulo: 'Políticas de seguridad', normas: ['ISO/IEC 27001'], estado: 'cubierta', controles: 1, evidencias: 2 },
    { libreriaCodigo: 'ejemplo-ha', idEstable: 'ha-4.1', tipo: 'clausula', capitulo: 4, grupo: null, titulo: 'Contexto', normas: ['ISO 9001', 'ISO/IEC 27001'], estado: 'sin_control', controles: 0, evidencias: 0 },
    { libreriaCodigo: 'ejemplo-ha', idEstable: 'ha-5.1', tipo: 'clausula', capitulo: 5, grupo: null, titulo: 'Liderazgo', normas: ['ISO 9001'], estado: 'evidencia_vencida', controles: 1, evidencias: 1 },
  ],
  porNorma: [{ norma: 'ISO 9001', ...resumen({ total: 2, cubiertas: 0, evidenciaVencida: 1, sinEvidencia: 0, sinControl: 1, porcentaje: 0 }) }, { norma: 'ISO/IEC 27001', ...resumen({ total: 2, cubiertas: 1, evidenciaVencida: 0, sinEvidencia: 0, sinControl: 1 }) }],
  total: resumen({ total: 3, cubiertas: 1, evidenciaVencida: 1, sinEvidencia: 0, sinControl: 1, porcentaje: 33 }),
  normas: ['ISO 9001', 'ISO/IEC 27001'],
  ...c,
});
const baseC = { empresa, persona: colaborador, cobertura: cobertura(), filtros: {}, filtrosInvalidos: false };

describe('PantallaCobertura', () => {
  it('no tiene violaciones de accesibilidad (axe)', async () => {
    const { container } = render(<PantallaCobertura {...baseC} filtrosInvalidos />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('muestra el estado de cada entrada con texto (no solo color) y el resumen por norma', () => {
    const { container } = render(<PantallaCobertura {...baseC} />);
    for (const estado of ['Cubierta', 'Sin control', 'Evidencia vencida']) expect(within(container).getByText(estado)).toBeTruthy();
    expect(within(container).getByText(/0 de 2 cubiertas/)).toBeTruthy();
    expect(within(container).getByText(/1 de 2 cubiertas/)).toBeTruthy();
    expect(within(container).getByText(/Calculada con la fecha de hoy en Ecuador: 2026-11-11/)).toBeTruthy();
    expect(within(container).getByText(/no la eficacia de los controles/)).toBeTruthy();
  });

  it('un porcentaje nulo se dice «sin entradas», no «0 %»', () => {
    const c = cobertura({ porNorma: [{ norma: 'ISO 9001', total: 0, cubiertas: 0, evidenciaVencida: 0, sinEvidencia: 0, sinControl: 0, porcentaje: null }], entradas: [] });
    const { container } = render(<PantallaCobertura {...baseC} cobertura={c} />);
    expect(within(container).getByText('Sin entradas a las que pedir cobertura')).toBeTruthy();
    expect(within(container).getByText('Sin resultados')).toBeTruthy();
    expect(container.textContent).not.toMatch(/\b0 %/);
  });

  it('sin librerías adoptadas invita a adoptar; con un filtro, lo conserva y ofrece limpiarlo', () => {
    expect(within(render(<PantallaCobertura {...baseC} cobertura={cobertura({ normas: [], entradas: [], porNorma: [] })} />).container).getByText('Aún no hay librerías adoptadas')).toBeTruthy();
    const { container } = render(<PantallaCobertura {...baseC} filtros={{ norma: 'ISO 9001' }} />);
    expect((container.querySelector('select[name="norma"]') as HTMLSelectElement).value).toBe('ISO 9001');
    expect(within(container).getByText('Limpiar').getAttribute('href')).toBe('/e/empresa-a/cobertura');
  });

  it('no inyecta HTML de los datos (escapa el texto)', () => {
    const c = cobertura({ entradas: [{ ...cobertura().entradas[0]!, titulo: '<img src=x onerror=alert(1)>' }] });
    const { container } = render(<PantallaCobertura {...baseC} cobertura={c} />);
    expect(container.querySelector('img')).toBeNull();
  });
});
