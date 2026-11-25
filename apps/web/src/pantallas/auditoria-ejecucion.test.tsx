import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import type { Auditoria, FilaLista, Hallazgo, ListaHallazgos, ListaProcesos, ListaVerificacion } from '../auditoria/tipos';
import type { Empresa } from '../marca/tipos';
import { PantallaEjecucion } from './auditoria-ejecucion';

const empresa = { id: 'empresa-a', nombre: 'Empresa A', marca: { colorPrimario: '#0E5C42', logoUrl: null } } as unknown as Empresa;
const ADMIN = { nombre: 'Ana Admin', roles: ['administrador_sig'] as const };
const AUDITOR = { nombre: 'Dora Auditora', roles: ['auditor_interno'] as const };
const COLAB = { nombre: 'Carla Colaboradora', roles: ['colaborador'] as const };
const U1 = '22222222-2222-4222-8222-222222222222';
const P1 = 'aaaaaaaa-1111-4111-8111-111111111111';
const AUD = 'dddddddd-1111-4111-8111-111111111111';
const F1 = 'f1f1f1f1-1111-4111-8111-111111111111';
const F2 = 'f2f2f2f2-1111-4111-8111-111111111111';
const H1 = 'a1a1a1a1-1111-4111-8111-111111111111';

const procesos: ListaProcesos = {
  gestionSigVigente: false,
  procesos: [{ id: P1, codigo: 'PR-001', nombre: 'Compras', descripcion: null, duenaId: U1, importancia: 'alta', frecuencia: 'anual', transversal: false, cambioRelevante: null, estado: 'vigente', version: 1, personasRelacionadas: 1, avisos: [] }],
};
const fila = (extra: Partial<FilaLista> = {}): FilaLista => ({
  id: F1, libreriaCodigo: 'iso-27001', idEstable: 'c9-2', titulo: 'Auditoría interna', guia: 'Revise el programa y los informes.', agrupador: '9', resultado: 'por_evaluar', nota: null, version: 1,
  evaluadoPor: null, evaluadoEn: null, diagnostico: 'parcial', preguntas: [{ id: 'b1b1b1b1-1111-4111-8111-111111111111', texto: '¿Existe el acta?' }], ...extra,
});
const lista = (filas: FilaLista[] = [fila(), fila({ id: F2, idEstable: 'c9-3', titulo: null, guia: null, diagnostico: null, resultado: 'no_conforme', nota: 'No hay acta', version: 2, preguntas: [] })]): ListaVerificacion => ({
  auditoriaId: AUD,
  filas,
  avance: { total: filas.length, evaluadas: filas.filter((f) => f.resultado !== 'por_evaluar').length, porResultado: { por_evaluar: filas.filter((f) => f.resultado === 'por_evaluar').length, conforme: 0, no_conforme: filas.filter((f) => f.resultado === 'no_conforme').length, observacion: 0, oportunidad: 0, no_aplica: 0, no_verificado: 0 } },
});
const hallazgo = (extra: Partial<Hallazgo> = {}): Hallazgo => ({
  id: H1, codigo: 'H-001', itemId: F2, tipo: 'nc_menor', procesoId: P1, libreriaCodigo: 'iso-27001', idEstable: 'c9-3', enunciado: 'Falta el acta', evidencia: 'Carpeta vacía', justificacionGravedad: null,
  estado: 'abierto', anulacionMotivo: null, registradoPor: U1, version: 2, ...extra,
});
const hallazgos = (hs: Hallazgo[] = [hallazgo()]): ListaHallazgos => ({ hallazgos: hs, abiertos: { nc_mayor: 0, nc_menor: hs.filter((h) => h.estado === 'abierto' && h.tipo === 'nc_menor').length, observacion: 0, oportunidad: 0 } });
const auditoria = (extra: Partial<Auditoria> = {}): Auditoria => ({
  id: AUD, programaId: 'cccccccc-1111-4111-8111-111111111111', codigo: 'AI-2027-01', anio: 2027, objetivo: 'Verificar', estado: 'en_ejecucion', inicio: '2027-03-01', fin: '2027-03-05', reunionApertura: '2027-03-01', reunionCierre: '2027-03-05',
  reprogramaciones: 0, cancelacionMotivo: null, informeEmitidoEn: null, cerradaEn: null, version: 4, normas: ['iso-27001'], combinada: false, procesosIds: [P1], procesosDelAlcance: [P1], capitulos: [], equipo: [], ...extra,
});
const props = { empresa, persona: AUDITOR, auditoria: auditoria(), lista: lista(), hallazgos: hallazgos(), procesos, personas: [] };

describe('Lista de verificación y hallazgos', () => {
  it('no tiene violaciones de accesibilidad (axe) en ninguno de sus estados', async () => {
    const estados = [
      <PantallaEjecucion key="a" {...props} aviso="fila_evaluada" />,
      <PantallaEjecucion key="b" {...props} persona={ADMIN} auditoria={auditoria({ estado: 'en_preparacion' })} />,
      <PantallaEjecucion key="c" {...props} persona={COLAB} />,
      <PantallaEjecucion key="d" {...props} auditoria={auditoria({ estado: 'cerrada' })} hallazgos={hallazgos([hallazgo({ estado: 'anulado', anulacionMotivo: 'duplicado' }), hallazgo({ id: 'a2a2a2a2-1111-4111-8111-111111111111', codigo: 'H-002', tipo: 'nc_mayor', justificacionGravedad: 'Falla el sistema' })])} />,
      <PantallaEjecucion key="e" {...props} lista={lista([])} hallazgos={hallazgos([])} auditoria={auditoria({ estado: 'planificada' })} />,
    ];
    for (const e of estados) {
      const { container, unmount } = render(e);
      expect(await axe(container)).toHaveNoViolations();
      unmount();
    }
  });

  it('muestra el avance, cada fila con su título y guía propios y el diagnóstico solo como contexto', () => {
    const { container } = render(<PantallaEjecucion {...props} />);
    expect(container.textContent).toContain('1 de 2 filas evaluadas');
    expect(container.textContent).toContain('No conforme: 1');
    expect(container.textContent).toContain('iso-27001 c9-2 · Auditoría interna');
    expect(container.textContent).toContain('Revise el programa y los informes.');
    expect(container.textContent).toContain('Cumple parcialmente');
    expect(container.textContent).toContain('Solo orienta: no se copia como resultado.');
    expect(container.textContent).toContain('La entrada ya no está entre las normas adoptadas'); // fila sin título
  });

  it('con la auditoría en ejecución el equipo evalúa con la versión que vio y la nota con la evidencia', () => {
    const { container } = render(<PantallaEjecucion {...props} />);
    const f = container.querySelector(`form[action="/e/empresa-a/auditoria/escribir/fila_evaluar/${AUD}"]`)!;
    expect(f.querySelector('input[name="filaId"]')).toHaveProperty('value', F1);
    expect(f.querySelector('input[name="version"]')).toHaveProperty('value', '1');
    const opciones = [...f.querySelectorAll('select[name="resultado"] option')].map((o) => (o as HTMLOptionElement).value);
    expect(opciones).toEqual(['', 'conforme', 'no_conforme', 'observacion', 'oportunidad', 'no_aplica', 'no_verificado']); // «por evaluar» no se envía
    expect(container.textContent).toContain('Obligatoria salvo en «conforme» y «no verificado»');
    const segunda = container.querySelectorAll(`form[action$="/fila_evaluar/${AUD}"]`)[1]!;
    expect((segunda.querySelector('select[name="resultado"]') as HTMLSelectElement).value).toBe('no_conforme');
    expect(segunda.querySelector('input[name="version"]')).toHaveProperty('value', '2');
  });

  it('fuera de ejecución, o sin rol de auditoría, no hay formularios de evaluación ni de hallazgos', () => {
    for (const p of [
      { ...props, auditoria: auditoria({ estado: 'informe_emitido' }) },
      { ...props, auditoria: auditoria({ estado: 'planificada' }) },
      { ...props, persona: COLAB },
    ]) {
      const { container, unmount } = render(<PantallaEjecucion {...p} />);
      expect(container.querySelector('form[action*="fila_evaluar"]')).toBeNull();
      expect(container.querySelector('form[action*="hallazgo_registrar"]')).toBeNull();
      expect(container.querySelector('form[action*="hallazgo_cambiar"]')).toBeNull();
      unmount();
    }
    const c = render(<PantallaEjecucion {...props} persona={COLAB} />);
    expect(c.container.textContent).toContain('Su rol puede consultar');
    const cerrada = render(<PantallaEjecucion {...props} auditoria={auditoria({ estado: 'cerrada' })} />);
    expect(cerrada.container.textContent).toContain('no está en ejecución');
  });

  it('las preguntas propias se agregan hasta 5 por fila y se pueden quitar en preparación y en ejecución', () => {
    const cinco = Array.from({ length: 5 }, (_, i) => ({ id: `b${i}b${i}b${i}b${i}-1111-4111-8111-111111111111`, texto: `Pregunta ${i + 1}` }));
    const { container } = render(<PantallaEjecucion {...props} lista={lista([fila({ preguntas: cinco }), fila({ id: F2, idEstable: 'c9-3', preguntas: [] })])} />);
    const agregar = container.querySelectorAll('form[action*="pregunta_agregar"]');
    expect(agregar).toHaveLength(1); // la fila con 5 ya no ofrece más
    expect(agregar[0]!.querySelector('input[name="filaId"]')).toHaveProperty('value', F2);
    expect(container.querySelectorAll('form[action*="pregunta_quitar"]')).toHaveLength(5);
    const prep = render(<PantallaEjecucion {...props} auditoria={auditoria({ estado: 'en_preparacion' })} />);
    expect(prep.container.querySelector('form[action*="pregunta_agregar"]')).not.toBeNull();
    expect(prep.container.querySelector('form[action*="fila_evaluar"]')).toBeNull();
  });

  it('el administrador regenera la lista solo en preparación', () => {
    const prep = render(<PantallaEjecucion {...props} persona={ADMIN} auditoria={auditoria({ estado: 'en_preparacion' })} />);
    expect(prep.container.querySelector('form[action*="lista_regenerar"]')).not.toBeNull();
    prep.unmount();
    const ejec = render(<PantallaEjecucion {...props} persona={ADMIN} />);
    expect(ejec.container.querySelector('form[action*="lista_regenerar"]')).toBeNull();
    ejec.unmount();
    const aud = render(<PantallaEjecucion {...props} auditoria={auditoria({ estado: 'en_preparacion' })} />);
    expect(aud.container.querySelector('form[action*="lista_regenerar"]')).toBeNull();
  });

  it('los hallazgos muestran tipo, proceso, requisito y evidencia; los anulados dicen por qué y no se editan', () => {
    const anulado = hallazgo({ id: 'a2a2a2a2-1111-4111-8111-111111111111', codigo: 'H-002', estado: 'anulado', anulacionMotivo: 'error_de_registro' });
    const { container } = render(<PantallaEjecucion {...props} hallazgos={hallazgos([hallazgo(), anulado])} />);
    expect(container.textContent).toContain('H-001');
    expect(container.textContent).toContain('No conformidad menor');
    expect(container.textContent).toContain('PR-001 Compras');
    expect(container.textContent).toContain('iso-27001 c9-3');
    expect(container.textContent).toContain('Carpeta vacía');
    expect(container.textContent).toContain('Anulado: Error de registro');
    expect(container.querySelectorAll('form[action*="hallazgo_cambiar"]')).toHaveLength(1);
    expect(container.querySelectorAll('form[action*="hallazgo_anular"]')).toHaveLength(1);
    expect(container.querySelector('form[action*="hallazgo_anular"] input[name="version"]')).toHaveProperty('value', '2');
  });

  it('el alta de un hallazgo ofrece los procesos del alcance, las filas de la lista y la justificación de la gravedad', () => {
    const { container } = render(<PantallaEjecucion {...props} />);
    const f = container.querySelector(`form[action="/e/empresa-a/auditoria/escribir/hallazgo_registrar/${AUD}"]`)!;
    expect([...f.querySelectorAll('select[name="procesoId"] option')].map((o) => (o as HTMLOptionElement).value)).toEqual(['', P1]);
    expect([...f.querySelectorAll('select[name="itemId"] option')].map((o) => (o as HTMLOptionElement).value)).toEqual(['', F1, F2]);
    expect([...f.querySelectorAll('select[name="tipo"] option')].map((o) => (o as HTMLOptionElement).value)).toEqual(['nc_mayor', 'nc_menor', 'observacion', 'oportunidad']);
    expect(f.querySelector('input[name="justificacionGravedad"]')).not.toBeNull();
    expect(container.textContent).toContain('Solo el líder registra o cambia una no conformidad mayor.');
    // al cambiar, el requisito se elige entre las filas y el valor actual queda seleccionado
    const c = container.querySelector('form[action*="hallazgo_cambiar"]')!;
    expect((c.querySelector('select[name="requisito"]') as HTMLSelectElement).value).toBe('iso-27001|c9-3');
  });
});
