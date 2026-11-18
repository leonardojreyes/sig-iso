import { render, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import type { Declaracion, FilaDeclaracion, JustificacionBorrador, JustificacionVersion, MotivoDeclaracion, ReferenciaDeclaracion, VersionDeclaracion, VersionDeclaracionConFilas } from '../api/tipos';
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

// ---- Justificación (ADR 037): motivos, riesgos, referencias y bloqueo por falta de motivo
const J = (o: Partial<JustificacionBorrador> = {}): JustificacionBorrador => justificacion(o);
const sinMotivo = (): Declaracion =>
  declaracion({
    resumen: { total: 3, aplican: 2, noAplican: 1, porDecidir: 0, sinControl: 1, aprobable: false },
    justificacion: J({
      conMotivo: 1, sinMotivo: 1, bloqueos: ['sin_motivo'],
      filas: [
        { libreriaCodigo: 'iso-27001-anexo-a', idEstable: 'a27-5-1', sinMotivo: false, motivos: [{ tipo: 'legal', nota: 'Ley de protección de datos' }], riesgos: [{ codigo: 'R-001', titulo: 'Pérdida de portátiles', nivel: 'alto', via: 'control' }] },
        { libreriaCodigo: 'iso-27001-anexo-a', idEstable: 'a27-5-2', sinMotivo: true, motivos: [], riesgos: [] },
        { libreriaCodigo: 'iso-27001-anexo-a', idEstable: 'a27-5-3', sinMotivo: false, motivos: [], riesgos: [] },
      ],
    }),
  });
const ref = (o: Partial<ReferenciaDeclaracion> = {}): ReferenciaDeclaracion => ({ tipo: 'plan', titulo: 'Plan 2026', versionDoc: '1.2', fecha: '2026-11-01', ubicacion: 'SIG-PL-004', version: 3, ...o });
const motivo = (o: Partial<MotivoDeclaracion> = {}): MotivoDeclaracion => ({ libreriaCodigo: 'iso-27001-anexo-a', idEstable: 'a27-5-1', tipo: 'legal', nota: 'Ley de protección de datos', version: 2, ...o });
const conMotivos = { ...base, declaracion: sinMotivo(), motivos: [motivo()] };

describe('PantallaDeclaracion con justificación', () => {
  it('no tiene violaciones de accesibilidad (axe) en los estados nuevos', async () => {
    const previstos = declaracion({ justificacion: J({ riesgosSinTratamiento: 1, faltaPlanTratamiento: true, riesgosVigentes: 2, referencias: [ref(), ref({ tipo: 'analisis', version: 1 })] }) });
    const estados = [
      <PantallaDeclaracion key="a" {...conMotivos} />,
      <PantallaDeclaracion key="b" {...conMotivos} persona={colaborador} motivos={[]} />,
      <PantallaDeclaracion key="c" {...base} declaracion={previstos} motivos={[]} />,
      <PantallaDeclaracion key="d" {...base} declaracion={previstos} persona={colaborador} />,
      <PantallaDeclaracion key="e" {...conMotivos} motivos={null} />,
      <PantallaDeclaracion key="f" {...conMotivos} aviso="motivo_guardado" />,
      <PantallaDeclaracion key="g" {...conMotivos} aviso="conflicto" />,
    ];
    for (const e of estados) {
      const { container, unmount } = render(e);
      expect(await axe(container)).toHaveNoViolations();
      unmount();
    }
  });

  it('el resumen cuenta los controles con y sin motivo y los riesgos vigentes', () => {
    const { container } = render(<PantallaDeclaracion {...conMotivos} />);
    for (const t of ['Aplican con motivo', 'Aplican sin motivo', 'Riesgos vigentes']) expect(container.textContent, t).toContain(t);
  });

  it('un control que aplica sin motivo bloquea: lo dice, explica qué hacer y deshabilita «Aprobar»', () => {
    const { container, getByRole } = render(<PantallaDeclaracion {...conMotivos} />);
    expect(container.textContent).toContain('Faltan motivos de inclusión');
    expect(container.textContent).toContain('Hay 1 control que aplica y no tiene motivo de inclusión');
    expect(container.textContent).toContain('Sin motivo no se puede aprobar');
    expect((getByRole('button', { name: 'Aprobar la declaración' }) as HTMLButtonElement).disabled).toBe(true);
    expect(container.textContent).toContain('Queda 1 control que aplica sin motivo de inclusión');
  });

  it('con todos los motivos se puede aprobar', () => {
    const { getByRole, container } = render(<PantallaDeclaracion {...base} />);
    expect((getByRole('button', { name: 'Aprobar la declaración' }) as HTMLButtonElement).disabled).toBe(false);
    expect(container.textContent).not.toContain('Faltan motivos de inclusión');
  });

  it('si queda algo por decidir se informa eso, no la falta de motivo', () => {
    const d = declaracion({ resumen: { total: 3, aplican: 1, noAplican: 1, porDecidir: 1, sinControl: 0, aprobable: false } });
    expect(render(<PantallaDeclaracion {...base} declaracion={d} />).container.textContent).toContain('Queda 1 control por decidir');
  });

  it('advierte (sin bloquear) los riesgos «mitigar» sin tratamiento y la falta del plan de tratamiento', () => {
    const d = declaracion({ justificacion: J({ riesgosSinTratamiento: 2, faltaPlanTratamiento: true }) });
    const { container, getByRole } = render(<PantallaDeclaracion {...base} declaracion={d} />);
    expect(container.textContent).toContain('Hay 2 riesgos con decisión «mitigar» y ningún control ni tratamiento previsto');
    expect(container.textContent).toContain('no se registró la referencia al plan de tratamiento');
    expect((getByRole('button', { name: 'Aprobar la declaración' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('cada fila que aplica muestra su motivo: el riesgo (con su vía) y los motivos registrados con su nota; la que no aplica, nada', () => {
    const d = declaracion({
      justificacion: J({
        filas: [
          { libreriaCodigo: 'iso-27001-anexo-a', idEstable: 'a27-5-1', sinMotivo: false, motivos: [{ tipo: 'contractual', nota: 'Cláusula 7' }], riesgos: [{ codigo: 'R-001', titulo: 'Pérdida de portátiles', nivel: 'alto', via: 'control' }, { codigo: 'R-002', titulo: 'Fuga', nivel: 'critico', via: 'previsto' }] },
          { libreriaCodigo: 'iso-27001-anexo-a', idEstable: 'a27-5-2', sinMotivo: false, motivos: [{ tipo: 'negocio', nota: 'Necesidad del negocio' }], riesgos: [] },
          { libreriaCodigo: 'iso-27001-anexo-a', idEstable: 'a27-5-3', sinMotivo: false, motivos: [], riesgos: [] },
        ],
      }),
    });
    const { container } = render(<PantallaDeclaracion {...base} declaracion={d} />);
    const x = container.textContent ?? '';
    expect(x).toContain('R-001 · Pérdida de portátiles (Alto; por un control de la empresa)');
    expect(x).toContain('R-002 · Fuga (Crítico; tratamiento previsto, sin control de la empresa)');
    expect(x).toContain('Requisito contractual: Cláusula 7');
    expect(x).toContain('Necesidad del negocio: Necesidad del negocio');
    const filas = container.querySelectorAll('tbody tr');
    expect(filas[2]?.textContent).not.toContain('Sin motivo'); // no aplica
  });

  it('una fila que aplica sin motivo lo muestra con palabras («Sin motivo»), no solo por color', () => {
    const { container } = render(<PantallaDeclaracion {...conMotivos} />);
    expect(container.querySelectorAll('tbody tr')[1]?.textContent).toContain('Sin motivo');
  });

  it('el administrador puede agregar motivos solo de los tipos que faltan y cambiar o quitar los registrados (con la versión que vio)', () => {
    const { container } = render(<PantallaDeclaracion {...conMotivos} />);
    const detalles = container.querySelectorAll('tbody tr')[0]?.querySelectorAll('details');
    expect(detalles?.length).toBe(1);
    const fila = within(container.querySelectorAll('tbody tr')[0] as HTMLElement);
    const guardar = container.querySelector('form[action="/e/empresa-a/declaracion/motivo/guardar"] input[name="version"]');
    expect(guardar?.getAttribute('value')).toBe('2');
    expect(fila.getByRole('button', { name: 'Guardar la nota del motivo «Requisito legal» del control a27-5-1' })).toBeTruthy();
    expect(fila.getByRole('button', { name: 'Quitar el motivo «Requisito legal» del control a27-5-1' })).toBeTruthy();
    const tipos = container.querySelector('#motivo-a27-5-1-nuevo-tipo') as HTMLSelectElement;
    expect([...tipos.options].map((o) => o.value)).toEqual(['contractual', 'negocio', 'otro']); // «legal» ya está registrado
  });

  it('el formulario para agregar un motivo no manda versión (la API lo crea) y avisa que la nota es en palabras propias', () => {
    const { container } = render(<PantallaDeclaracion {...conMotivos} />);
    const nuevos = [...container.querySelectorAll('form[action="/e/empresa-a/declaracion/motivo/guardar"]')].find((f) => f.querySelector('select[name="tipo"]'));
    expect(nuevos?.querySelector('[name="version"]')).toBeNull();
    expect(nuevos?.querySelector('[name="entrada"]')?.getAttribute('value')).toBe('iso-27001-anexo-a|a27-5-1');
    expect(container.textContent).toContain('En sus palabras');
    expect(container.textContent).toContain('No escriba datos personales ni texto de las normas');
  });

  it('con los cuatro tipos registrados no ofrece agregar más', () => {
    const todos = (['legal', 'contractual', 'negocio', 'otro'] as const).map((tipo) => motivo({ tipo }));
    const { container } = render(<PantallaDeclaracion {...base} declaracion={sinMotivo()} motivos={todos} />);
    expect(container.textContent).toContain('Ya hay un motivo de cada tipo registrado');
  });

  it('quien solo consulta ve los motivos pero no puede cambiarlos; y si no se pudieron cargar los motivos, tampoco se ofrece editar', () => {
    const a = render(<PantallaDeclaracion {...conMotivos} persona={colaborador} />);
    expect(a.container.querySelector('form[action*="/declaracion/motivo/"]')).toBeNull();
    expect(a.container.querySelector('form[action*="/declaracion/referencia/"]')).toBeNull();
    expect(a.container.textContent).toContain('Ley de protección de datos');
    expect(a.container.textContent).toContain('Solo el administrador SIG registra motivos y referencias');
    a.unmount();
    const b = render(<PantallaDeclaracion {...conMotivos} motivos={null} />);
    expect(b.container.querySelector('form[action*="/declaracion/motivo/"]')).toBeNull();
  });

  it('muestra las referencias registradas y deja registrar o cambiar cada una (con su versión) o quitarla', () => {
    const d = declaracion({ justificacion: J({ referencias: [ref()] }) });
    const { container, getByRole } = render(<PantallaDeclaracion {...base} declaracion={d} />);
    expect(container.textContent).toContain('Plan 2026 · versión 1.2 · 2026-11-01 · SIG-PL-004');
    expect(container.textContent).toContain('No registrada');
    expect(getByRole('button', { name: 'Guardar la referencia: Plan de tratamiento de riesgos' })).toBeTruthy();
    expect(getByRole('button', { name: 'Quitar la referencia: Plan de tratamiento de riesgos' })).toBeTruthy();
    expect(container.querySelector('form[action="/e/empresa-a/declaracion/referencia/quitar"] input[name="version"]')?.getAttribute('value')).toBe('3');
    // el análisis no está registrado: solo se puede crear (sin versión ni «quitar»)
    const crear = container.querySelector('form[action="/e/empresa-a/declaracion/referencia/guardar"] input[name="tipo"][value="analisis"]')?.closest('form');
    expect(crear?.querySelector('[name="version"]')).toBeNull();
    expect(container.querySelectorAll('form[action="/e/empresa-a/declaracion/referencia/quitar"]').length).toBe(1);
  });

  it('los formularios de motivos y referencias no llevan campos de empresa', () => {
    const { container } = render(<PantallaDeclaracion {...conMotivos} declaracion={{ ...sinMotivo(), justificacion: { ...sinMotivo().justificacion, referencias: [ref()] } }} />);
    for (const f of container.querySelectorAll('form[action*="/declaracion/motivo/"], form[action*="/declaracion/referencia/"]'))
      expect([...f.querySelectorAll('[name]')].map((e) => e.getAttribute('name')).filter((n) => /empresa|tenant/i.test(n ?? ''))).toEqual([]);
  });
});

describe('PantallaVersionDeclaracion con justificación congelada', () => {
  const congelada = (o: Partial<JustificacionVersion> = {}): JustificacionVersion => ({
    escala: { escalaMax: 5, corteMedio: 5, corteAlto: 10, corteCritico: 16 }, conMotivo: 2, riesgosVigentes: 1,
    motivos: [{ libreriaCodigo: 'iso-27001-anexo-a', idEstable: 'a27-5-1', tipo: 'contractual', nota: 'Cláusula 7 del contrato' }],
    riesgos: [{ codigo: 'R-001', titulo: 'Pérdida de portátiles', probabilidad: 3, impacto: 4, nivel: 'alto', decision: 'mitigar', responsableId: U, controles: ['C-001'] }],
    riesgosPorFila: [{ libreriaCodigo: 'iso-27001-anexo-a', idEstable: 'a27-5-2', riesgoCodigo: 'R-001', via: 'previsto' }],
    referencias: [{ tipo: 'plan', titulo: 'Plan 2026', versionDoc: '1.0', fecha: '2026-11-01', ubicacion: 'SIG-PL-004' }], ...o,
  });
  const vc = (j: JustificacionVersion | null): VersionDeclaracionConFilas => ({ ...version(), alcance: 'Alcance congelado', filas: filas(), justificacion: j });

  it('no tiene violaciones de accesibilidad (axe), con y sin justificación', async () => {
    for (const j of [congelada(), null, congelada({ riesgos: [], riesgosVigentes: 0, riesgosPorFila: [], referencias: [] })]) {
      const { container, unmount } = render(<PantallaVersionDeclaracion empresa={empresa} persona={admin} version={vc(j)} />);
      expect(await axe(container)).toHaveNoViolations();
      unmount();
    }
  });

  it('muestra lo que se congeló: motivos y riesgos por fila, tabla de riesgos con nivel en palabras, la escala y las referencias', () => {
    const { container } = render(<PantallaVersionDeclaracion empresa={empresa} persona={colaborador} version={vc(congelada())} />);
    const x = container.textContent ?? '';
    for (const t of ['Requisito contractual: Cláusula 7 del contrato', 'R-001 · Pérdida de portátiles (Alto; tratamiento previsto, sin control de la empresa)', 'Alto (3 × 4 = 12)', 'C-001', 'Asignado', 'Plan 2026 · versión 1.0 · 2026-11-01 · SIG-PL-004', 'Crítico: 16 a 25', 'no el criterio de aceptación de la empresa', 'no registra el riesgo residual']) expect(x, t).toContain(t);
    expect(x).toContain('No registrada'); // el análisis no se registró
  });

  it('una versión anterior a la Declaración justificada lo dice y no muestra la columna de motivos', () => {
    const { container } = render(<PantallaVersionDeclaracion empresa={empresa} persona={admin} version={vc(null)} />);
    expect(container.textContent).toContain('se aprobó antes de que el sistema registrara motivos de inclusión');
    expect(container.textContent).not.toContain('Motivo de inclusión');
  });

  it('una versión congelada no ofrece cambiar nada (ni motivos ni referencias)', () => {
    const { container } = render(<PantallaVersionDeclaracion empresa={empresa} persona={admin} version={vc(congelada())} />);
    expect(container.querySelectorAll('form').length).toBe(1); // solo «Cerrar sesión»
  });
});
