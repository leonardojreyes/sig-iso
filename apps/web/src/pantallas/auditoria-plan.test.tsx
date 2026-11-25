import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import type { Auditoria, Independencia, ListaProcesos, Programa } from '../auditoria/tipos';
import type { PersonaDirectorio } from '../documentos/tipos';
import type { Empresa } from '../marca/tipos';
import { PantallaPlanificacion } from './auditoria-plan';

const empresa = { id: 'empresa-a', nombre: 'Empresa A', marca: { colorPrimario: '#0E5C42', logoUrl: null } } as unknown as Empresa;
const ADMIN = { nombre: 'Ana Admin', roles: ['administrador_sig'] as const };
const COLAB = { nombre: 'Carla Colaboradora', roles: ['colaborador'] as const };
const U1 = '22222222-2222-4222-8222-222222222222';
const U2 = '33333333-3333-4333-8333-333333333333';
const P1 = 'aaaaaaaa-1111-4111-8111-111111111111';
const SIG = 'bbbbbbbb-1111-4111-8111-111111111111';
const AUD = 'dddddddd-1111-4111-8111-111111111111';
const personas: PersonaDirectorio[] = [
  { id: U1, nombre: 'Dora Auditora', activa: true, puedeAprobar: false },
  { id: U2, nombre: 'Eli Auditor', activa: true, puedeAprobar: false },
];
const procesos: ListaProcesos = {
  gestionSigVigente: true,
  procesos: [
    { id: P1, codigo: 'PR-001', nombre: 'Compras', descripcion: null, duenaId: U1, importancia: 'alta', frecuencia: 'anual', transversal: false, cambioRelevante: null, estado: 'vigente', version: 1, personasRelacionadas: 1, avisos: [] },
    { id: SIG, codigo: 'PR-002', nombre: 'Gestión del SIG', descripcion: null, duenaId: U1, importancia: 'alta', frecuencia: 'anual', transversal: true, cambioRelevante: null, estado: 'vigente', version: 1, personasRelacionadas: 1, avisos: [] },
  ],
};
const programa: Programa = { id: 'cccccccc-1111-4111-8111-111111111111', anio: 2027, objetivo: 'P', estado: 'aprobado', aprobadoPor: U1, aprobadoEn: '2027-01-05T15:00:00.000Z', version: 2, normas: ['iso-27001', 'iso-9001'] };
const auditoria = (extra: Partial<Auditoria> = {}): Auditoria => ({
  id: AUD, programaId: programa.id, codigo: 'AI-2027-01', anio: 2027, objetivo: 'Verificar el SGSI', estado: 'planificada', inicio: '2027-03-01', fin: '2027-03-05', reunionApertura: '2027-03-01', reunionCierre: null,
  reprogramaciones: 1, cancelacionMotivo: null, informeEmitidoEn: null, cerradaEn: null, version: 3, normas: ['iso-27001'], combinada: false, procesosIds: [P1], procesosDelAlcance: [P1, SIG],
  capitulos: [{ libreriaCodigo: 'iso-27001', capitulo: '9' }],
  equipo: [{ personaId: U1, rol: 'lider', excepcion: true, autoautorizada: true, excepcionMotivo: 'No hay otra persona', excepcionMedida: 'Otra persona revisa el informe', excepcionAutorizadaPor: U1 }],
  ...extra,
});
const independencia = (extra: Partial<Independencia> = {}): Independencia => ({ personaId: U2, independiente: true, conflictos: [], avisos: [], procesosDelAlcance: [P1, SIG], ...extra });
const props = { empresa, persona: ADMIN, auditoria: auditoria(), programa, procesos, personas };

describe('Planificación de una auditoría', () => {
  it('no tiene violaciones de accesibilidad (axe) en ninguno de sus estados', async () => {
    const estados = [
      <PantallaPlanificacion key="a" {...props} aviso="equipo_designado" />,
      <PantallaPlanificacion key="b" {...props} auditoria={auditoria({ equipo: [], estado: 'en_preparacion', reunionApertura: null })} candidataId={U2} independencia={independencia({ independiente: false, conflictos: [{ procesoId: SIG, relaciones: ['diseno', 'supervisa'] }], avisos: [{ procesoId: P1, ultimaFecha: '2026-06-01' }] })} />,
      <PantallaPlanificacion key="c" {...props} auditoria={auditoria({ estado: 'cancelada', cancelacionMotivo: 'sin_recursos' })} />,
      <PantallaPlanificacion key="d" {...props} auditoria={auditoria({ estado: 'informe_emitido', informeEmitidoEn: '2027-03-05T15:00:00.000Z' })} />,
      <PantallaPlanificacion key="e" {...props} persona={COLAB} programa={null} auditoria={auditoria({ capitulos: [], combinada: true, normas: ['iso-27001', 'iso-9001'] })} />,
      <PantallaPlanificacion key="f" {...props} auditoria={auditoria({ estado: 'en_ejecucion' })} independencia={independencia()} candidataId={U2} />,
    ];
    for (const e of estados) {
      const { container, unmount } = render(e);
      expect(await axe(container)).toHaveNoViolations();
      unmount();
    }
  });

  it('muestra el equipo con su excepción de independencia visible, con motivo y medida, y quién la autorizó', () => {
    const { container } = render(<PantallaPlanificacion {...props} />);
    expect(container.textContent).toContain('Dora Auditora');
    expect(container.textContent).toContain('Líder');
    expect(container.textContent).toContain('Excepción de independencia');
    expect(container.textContent).toContain('Motivo: No hay otra persona. Medida compensatoria: Otra persona revisa el informe.');
    expect(container.textContent).toContain('La autorizó la misma persona');
  });

  it('el alcance suma «Gestión del SIG» y lo dice, y muestra los capítulos indicados o todos', () => {
    const { container } = render(<PantallaPlanificacion {...props} />);
    expect(container.textContent).toContain('PR-002 Gestión del SIG (se suma por cubrir las cláusulas 4 a 10)');
    expect(container.textContent).toContain('iso-27001 · 9');
    const sin = render(<PantallaPlanificacion {...props} auditoria={auditoria({ capitulos: [] })} />);
    expect(sin.container.textContent).toContain('Todos los capítulos y temas de las normas elegidas.');
  });

  it('la comprobación explica por qué sí o por qué no con las relaciones y los procesos, y avisa de la repetición sin bloquear', () => {
    const ok = render(<PantallaPlanificacion {...props} candidataId={U2} independencia={independencia()} />);
    expect(ok.container.textContent).toContain('Eli Auditor no tiene relaciones con los procesos del alcance: puede ser designada.');
    ok.unmount();
    const no = render(
      <PantallaPlanificacion {...props} candidataId={U2} independencia={independencia({ independiente: false, conflictos: [{ procesoId: SIG, relaciones: ['diseno', 'supervisa'] }], avisos: [{ procesoId: P1, ultimaFecha: '2026-06-01' }] })} />,
    );
    expect(no.container.textContent).toContain('Eli Auditor tiene relación con estos procesos del alcance y no puede auditarlos, salvo una excepción');
    expect(no.container.textContent).toContain('PR-002 Gestión del SIG: Diseñó el proceso, Supervisa');
    expect(no.container.textContent).toContain('ya auditó PR-001 Compras (última vez 2026-06-01). No impide designarla');
    expect(no.container.querySelector('[role="status"]')).not.toBeNull();
  });

  it('el formulario de designar lleva la excepción como un par motivo y medida, y preselecciona a la persona comprobada y al líder que falta', () => {
    const { container } = render(<PantallaPlanificacion {...props} auditoria={auditoria({ equipo: [] })} candidataId={U2} />);
    const f = container.querySelector(`form[action="/e/empresa-a/auditoria/escribir/equipo_designar/${AUD}"]`)!;
    expect((f.querySelector('select[name="personaId"]') as HTMLSelectElement).value).toBe(U2);
    expect((f.querySelector('select[name="rol"]') as HTMLSelectElement).value).toBe('lider');
    expect(f.querySelector('input[name="excepcionMotivo"]')).not.toBeNull();
    expect(f.querySelector('input[name="excepcionMedida"]')).not.toBeNull();
    const con = render(<PantallaPlanificacion {...props} />);
    expect((con.container.querySelector('form[action*="equipo_designar"] select[name="rol"]') as HTMLSelectElement).value).toBe('auditor');
  });

  it('los formularios llevan la versión que se vio y avanzar ofrece el siguiente estado', () => {
    const { container } = render(<PantallaPlanificacion {...props} />);
    for (const accion of ['auditoria_avanzar', 'auditoria_cambiar', 'auditoria_reprogramar', 'auditoria_cancelar'])
      expect(container.querySelector(`form[action$="/${accion}/${AUD}"] input[name="version"]`), accion).toHaveProperty('value', '3');
    expect(container.querySelector('form[action*="auditoria_avanzar"] input[name="estado"]')).toHaveProperty('value', 'en_preparacion');
    const prep = render(<PantallaPlanificacion {...props} auditoria={auditoria({ estado: 'en_preparacion' })} />);
    expect(prep.container.querySelector('form[action*="auditoria_avanzar"] input[name="estado"]')).toHaveProperty('value', 'en_ejecucion');
  });

  it('los capítulos del alcance quedan marcados para conservarse al guardar; las normas ofrecidas son las del programa', () => {
    const { container } = render(<PantallaPlanificacion {...props} />);
    const f = container.querySelector(`form[action$="/auditoria_cambiar/${AUD}"]`)!;
    const caps = [...f.querySelectorAll('input[name="capitulos"]')] as HTMLInputElement[];
    expect(caps.map((c) => [c.value, c.defaultChecked])).toEqual([['iso-27001|9', true]]);
    const normas = [...f.querySelectorAll('input[name="normas"]')] as HTMLInputElement[];
    expect(normas.map((n) => [n.value, n.defaultChecked])).toEqual([['iso-27001', true], ['iso-9001', false]]);
  });

  it('cancelada o con informe emitido no se puede cambiar nada, y se explica por qué', () => {
    const can = render(<PantallaPlanificacion {...props} auditoria={auditoria({ estado: 'cancelada', cancelacionMotivo: 'sin_recursos' })} />);
    expect(can.container.textContent).toContain('Auditoría cancelada: Sin recursos. No se reabre.');
    expect(can.container.querySelector('form[action*="/auditoria/escribir/"]')).toBeNull();
    can.unmount();
    const inf = render(<PantallaPlanificacion {...props} auditoria={auditoria({ estado: 'informe_emitido' })} />);
    expect(inf.container.textContent).toContain('ya no se cambia nada');
    expect(inf.container.querySelector('form[action*="/auditoria/escribir/"]')).toBeNull();
  });

  it('quien no administra solo consulta: ningún formulario de escritura', () => {
    const { container } = render(<PantallaPlanificacion {...props} persona={COLAB} />);
    expect(container.querySelector('form[action*="/auditoria/escribir/"]')).toBeNull();
    expect(container.textContent).toContain('Su rol puede consultar');
    // pero sí puede comprobar la independencia (es una consulta)
    expect(container.querySelector('form[method="get"] select[name="persona"]')).not.toBeNull();
  });
});
