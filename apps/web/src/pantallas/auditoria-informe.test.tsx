import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import type { Auditoria, InformeAuditoria, ListaVerificacion, PanelAuditoria } from '../auditoria/tipos';
import type { PersonaDirectorio } from '../documentos/tipos';
import type { Empresa } from '../marca/tipos';
import { PanelPrerrequisito } from './auditoria-panel';
import { PantallaInforme } from './auditoria-informe';
import { PantallaAuditoria } from './auditoria-programa';

const empresa = { id: 'empresa-a', nombre: 'Empresa A', marca: { colorPrimario: '#0E5C42', logoUrl: null } } as unknown as Empresa;
const ADMIN = { nombre: 'Ana Admin', roles: ['administrador_sig'] as const };
const AUDITOR = { nombre: 'Dora Auditora', roles: ['auditor_interno'] as const };
const COLAB = { nombre: 'Carla Colaboradora', roles: ['colaborador'] as const };
const U1 = '22222222-2222-4222-8222-222222222222';
const AUD = 'dddddddd-1111-4111-8111-111111111111';
const personas: PersonaDirectorio[] = [{ id: U1, nombre: 'Dora Auditora', activa: true, puedeAprobar: false }];

const auditoria = (extra: Partial<Auditoria> = {}): Auditoria => ({
  id: AUD, programaId: 'cccccccc-1111-4111-8111-111111111111', codigo: 'AI-2027-01', anio: 2027, objetivo: 'Verificar', estado: 'en_ejecucion', inicio: '2027-03-01', fin: '2027-03-05', reunionApertura: '2027-03-01', reunionCierre: '2027-03-05',
  reprogramaciones: 0, cancelacionMotivo: null, informeEmitidoEn: null, cerradaEn: null, version: 5, normas: ['iso-27001'], combinada: false, procesosIds: [], procesosDelAlcance: [], capitulos: [], equipo: [], ...extra,
});
const lista = (porEvaluar = 0): ListaVerificacion => ({
  auditoriaId: AUD,
  filas: [],
  avance: { total: 3, evaluadas: 3 - porEvaluar, porResultado: { por_evaluar: porEvaluar, conforme: 3 - porEvaluar, no_conforme: 0, observacion: 0, oportunidad: 0, no_aplica: 0, no_verificado: 0 } },
});
const informe = (extra: Partial<InformeAuditoria> = {}): InformeAuditoria => ({
  auditoriaId: AUD, codigo: 'AI-2027-01', huella: 'a'.repeat(64), emitidoPor: U1, emitidoEn: '2027-03-05T15:00:00.000Z', conclusion: 'Conforme con una NC menor.\nSegunda línea.', limitaciones: null,
  conteos: { por_evaluar: 0, conforme: 2, no_conforme: 1, observacion: 0, oportunidad: 0, no_aplica: 0, no_verificado: 0, total: 3, cubiertas: 3 }, ...extra,
});
const panel = (extra: Partial<PanelAuditoria> = {}): PanelAuditoria => ({
  programaAnio: 2027,
  prerrequisito: { cumple: false, auditoriasCerradas: 1, brechas: { clausulas: ['iso-27001:c9-3'], procesos: [], controles: ['a:1', 'a:2'], sinDeclaracion: false } },
  cobertura12Meses: { clausulas: { total: 7, cubiertas: 6 }, controles: { total: 10, cubiertos: 8, sinDeclaracion: false }, procesos: { total: 3, cubiertos: 3 } },
  auditorias: { total: 3, cerradas: 1, porEstado: { planificada: 1, en_preparacion: 0, en_ejecucion: 1, informe_emitido: 0, cerrada: 1, cancelada: 0 } },
  ...extra,
});
const props = { empresa, persona: AUDITOR, auditoria: auditoria(), informe: null, lista: lista(), personas };

describe('Informe y cierre', () => {
  it('no tiene violaciones de accesibilidad (axe) en ninguno de sus estados', async () => {
    const estados = [
      <PantallaInforme key="a" {...props} aviso="informe_emitido" />,
      <PantallaInforme key="b" {...props} lista={lista(2)} />,
      <PantallaInforme key="c" {...props} auditoria={auditoria({ estado: 'planificada' })} />,
      <PantallaInforme key="d" {...props} persona={ADMIN} auditoria={auditoria({ estado: 'informe_emitido', informeEmitidoEn: '2027-03-05T15:00:00.000Z' })} informe={informe({ limitaciones: 'No se revisó A.5.2' })} />,
      <PantallaInforme key="e" {...props} persona={COLAB} auditoria={auditoria({ estado: 'cerrada', cerradaEn: '2027-03-06T15:00:00.000Z' })} informe={informe()} />,
    ];
    for (const e of estados) {
      const { container, unmount } = render(e);
      expect(await axe(container)).toHaveNoViolations();
      unmount();
    }
  });

  it('sin informe muestra lo que falta con palabras y ofrece emitirlo al equipo con la versión que vio', () => {
    const faltan = render(<PantallaInforme {...props} lista={lista(2)} />);
    expect(faltan.container.textContent).toContain('Faltan evaluar 2 filas de la lista.');
    faltan.unmount();
    const { container } = render(<PantallaInforme {...props} />);
    expect(container.textContent).toContain('Todas las filas de la lista están evaluadas.');
    const f = container.querySelector(`form[action="/e/empresa-a/auditoria/escribir/informe_emitir/${AUD}"]`)!;
    expect(f.querySelector('input[name="version"]')).toHaveProperty('value', '5');
    expect((f.querySelector('textarea[name="conclusion"]') as HTMLTextAreaElement).required).toBe(true);
    expect((f.querySelector('textarea[name="limitaciones"]') as HTMLTextAreaElement).required).toBe(false);
    expect(container.textContent).toContain('no es un certificado');
  });

  it('solo se emite con la auditoría en ejecución y por quien audita', () => {
    for (const p of [{ ...props, auditoria: auditoria({ estado: 'planificada' }) }, { ...props, persona: COLAB }, { ...props, auditoria: auditoria({ estado: 'cerrada' }) }]) {
      const { container, unmount } = render(<PantallaInforme {...p} />);
      expect(container.querySelector('form[action*="informe_emitir"]')).toBeNull();
      unmount();
    }
    const plan = render(<PantallaInforme {...props} auditoria={auditoria({ estado: 'planificada' })} />);
    expect(plan.container.textContent).toContain('El informe se emite con la auditoría en ejecución.');
  });

  it('con el informe emitido muestra la copia (conclusión, limitaciones, resultados, huella) y la descarga en Word', () => {
    const { container } = render(<PantallaInforme {...props} auditoria={auditoria({ estado: 'informe_emitido' })} informe={informe({ limitaciones: 'No se revisó A.5.2' })} />);
    expect(container.textContent).toContain('Emitido por Dora Auditora el 2027-03-05.');
    expect(container.textContent).toContain('a'.repeat(64));
    expect(container.textContent).toContain('Conforme con una NC menor.');
    expect(container.textContent).toContain('No se revisó A.5.2');
    expect(container.textContent).toContain('Conforme: 2 · No conforme: 1');
    expect(container.textContent).toContain('Filas evaluadas de verdad: 3 de 3.');
    expect(container.querySelector(`a[href="/e/empresa-a/auditoria/informe/${AUD}/documento"]`)).not.toBeNull();
    expect(container.querySelector('form[action*="informe_emitir"]')).toBeNull();
    const sin = render(<PantallaInforme {...props} auditoria={auditoria({ estado: 'informe_emitido' })} informe={informe()} />);
    expect(sin.container.textContent).toContain('No se registraron limitaciones.');
  });

  it('solo el administrador cierra, después del informe, y avisa que los hallazgos siguen abiertos', () => {
    const emitido = auditoria({ estado: 'informe_emitido' });
    const admin = render(<PantallaInforme {...props} persona={ADMIN} auditoria={emitido} informe={informe()} />);
    const f = admin.container.querySelector(`form[action="/e/empresa-a/auditoria/escribir/auditoria_cerrar/${AUD}"]`)!;
    expect(f.querySelector('input[name="version"]')).toHaveProperty('value', '5');
    expect(admin.container.textContent).toContain('Cerrar no cierra los hallazgos');
    admin.unmount();
    const aud = render(<PantallaInforme {...props} auditoria={emitido} informe={informe()} />);
    expect(aud.container.querySelector('form[action*="auditoria_cerrar"]')).toBeNull();
    aud.unmount();
    const cerrada = render(<PantallaInforme {...props} persona={ADMIN} auditoria={auditoria({ estado: 'cerrada', cerradaEn: '2027-03-06T15:00:00.000Z' })} informe={informe()} />);
    expect(cerrada.container.querySelector('form[action*="auditoria_cerrar"]')).toBeNull();
    expect(cerrada.container.textContent).toContain('Auditoría cerrada el 2027-03-06.');
  });
});

describe('Panel del prerrequisito de la Etapa 2', () => {
  it('no tiene violaciones de accesibilidad (axe) en ninguno de sus estados', async () => {
    const estados = [
      <PanelPrerrequisito key="a" panel={panel()} />,
      <PanelPrerrequisito key="b" panel={panel({ prerrequisito: { cumple: true, auditoriasCerradas: 2, brechas: { clausulas: [], procesos: [], controles: [], sinDeclaracion: false } } })} />,
      <PanelPrerrequisito key="c" panel={panel({ prerrequisito: { cumple: false, auditoriasCerradas: 0, brechas: { clausulas: [], procesos: [], controles: [], sinDeclaracion: true } }, cobertura12Meses: { clausulas: { total: 7, cubiertas: 0 }, controles: { total: 0, cubiertos: 0, sinDeclaracion: true }, procesos: { total: 0, cubiertos: 0 } } })} />,
      <PanelPrerrequisito key="d" panel={panel({ programaAnio: null })} />,
    ];
    for (const e of estados) {
      const { container, unmount } = render(e);
      expect(await axe(container)).toHaveNoViolations();
      unmount();
    }
  });

  it('dice con palabras si se cumple y qué falta, y que no decide la etapa', () => {
    const no = render(<PanelPrerrequisito panel={panel()} />);
    expect(no.container.textContent).toContain('Todavía no se cumple el prerrequisito');
    expect(no.container.textContent).toContain('Hay 1 auditoría cerrada.');
    expect(no.container.textContent).toContain('1 cláusula sin auditar');
    expect(no.container.textContent).toContain('2 controles aplicables sin auditar');
    expect(no.container.textContent).toContain('Este panel solo informa: no decide la etapa.');
    expect(no.container.textContent).toContain('Cláusulas: 6 de 7');
    expect(no.container.textContent).toContain('Controles aplicables: 8 de 10');
    no.unmount();
    const si = render(<PanelPrerrequisito panel={panel({ prerrequisito: { cumple: true, auditoriasCerradas: 2, brechas: { clausulas: [], procesos: [], controles: [], sinDeclaracion: false } } })} />);
    expect(si.container.textContent).toContain('Se cumple el prerrequisito');
    expect(si.container.textContent).toContain('No falta nada por cubrir.');
  });

  it('sin Declaración aprobada no afirma nada de los controles; sin programa invita a crearlo', () => {
    const sin = render(<PanelPrerrequisito panel={panel({ prerrequisito: { cumple: false, auditoriasCerradas: 1, brechas: { clausulas: [], procesos: [], controles: [], sinDeclaracion: true } }, cobertura12Meses: { clausulas: { total: 7, cubiertas: 7 }, controles: { total: 0, cubiertos: 0, sinDeclaracion: true }, procesos: { total: 1, cubiertos: 1 } } })} />);
    expect(sin.container.textContent).toContain('Todavía no hay una Declaración de Aplicabilidad aprobada');
    expect(sin.container.textContent).not.toContain('Controles aplicables: 0 de 0');
    sin.unmount();
    const nada = render(<PanelPrerrequisito panel={panel({ programaAnio: null })} />);
    expect(nada.container.textContent).toContain('Todavía no hay un programa de auditoría.');
  });

  it('la entrada de la auditoría interna lo muestra arriba de los programas', () => {
    const { container } = render(<PantallaAuditoria empresa={empresa} persona={COLAB} programas={[]} normasAdoptadas={[]} panel={<PanelPrerrequisito panel={panel()} />} />);
    expect(container.textContent).toContain('Prerrequisito de la Etapa 2');
    expect(container.textContent!.indexOf('Prerrequisito de la Etapa 2')).toBeLessThan(container.textContent!.indexOf('Programas anuales'));
  });
});
