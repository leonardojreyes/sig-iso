import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import type { Proceso } from '../auditoria/tipos';
import type { PersonaDirectorio } from '../documentos/tipos';
import type { Empresa } from '../marca/tipos';
import { PantallaProceso, PantallaProcesos } from './auditoria-procesos';

const empresa = { id: 'empresa-a', nombre: 'Empresa A', marca: { colorPrimario: '#0E5C42', logoUrl: null } } as unknown as Empresa;
const ADMIN = { nombre: 'Ana Admin', roles: ['administrador_sig'] as const };
const COLAB = { nombre: 'Carla Colaboradora', roles: ['colaborador'] as const };
const U1 = '22222222-2222-4222-8222-222222222222';
const U2 = '33333333-3333-4333-8333-333333333333';
const personas: PersonaDirectorio[] = [
  { id: U1, nombre: 'Ana Admin', activa: true, puedeAprobar: true },
  { id: U2, nombre: 'Dario Retirado', activa: false, puedeAprobar: false },
];
const proceso = (extra: Partial<Proceso> = {}): Proceso => ({
  id: 'dddddddd-1111-4111-8111-111111111111', codigo: 'PR-001', nombre: 'Compras', descripcion: 'Compra de bienes', duenaId: U1, importancia: 'alta', frecuencia: 'anual', transversal: false,
  cambioRelevante: null, estado: 'vigente', version: 2, personasRelacionadas: 2, avisos: [], ...extra,
});

describe('Procesos', () => {
  it('no tiene violaciones de accesibilidad (axe) en ninguno de sus estados', async () => {
    const estados = [
      <PantallaProcesos key="a" empresa={empresa} persona={ADMIN} lista={{ procesos: [proceso(), proceso({ id: 'eeeeeeee-1111-4111-8111-111111111111', codigo: 'PR-002', duenaId: U2, avisos: ['sin_relaciones', 'duena_inactiva'], transversal: true, estado: 'retirado' })], gestionSigVigente: true }} personas={personas} aviso="proceso_guardado" />,
      <PantallaProcesos key="b" empresa={empresa} persona={ADMIN} lista={{ procesos: [], gestionSigVigente: false }} personas={personas} />,
      <PantallaProcesos key="c" empresa={empresa} persona={COLAB} lista={{ procesos: [proceso()], gestionSigVigente: false }} personas={personas} />,
      <PantallaProceso key="d" empresa={empresa} persona={ADMIN} proceso={proceso({ cambioRelevante: 'incidente' })} relaciones={[{ procesoId: proceso().id, personaId: U1, relacion: 'duena' }, { procesoId: proceso().id, personaId: U1, relacion: 'participa' }]} personas={personas} aviso="relacion_guardada" />,
      <PantallaProceso key="e" empresa={empresa} persona={COLAB} proceso={proceso({ estado: 'retirado' })} relaciones={[]} personas={personas} />,
    ];
    for (const e of estados) {
      const { container, unmount } = render(e);
      expect(await axe(container)).toHaveNoViolations();
      unmount();
    }
  });

  it('el administrador ve los formularios y las demás personas solo consultan', () => {
    const a = render(<PantallaProcesos empresa={empresa} persona={ADMIN} lista={{ procesos: [proceso()], gestionSigVigente: false }} personas={personas} />);
    expect(a.container.querySelector('form[action="/e/empresa-a/auditoria/escribir/proceso_crear"]')).not.toBeNull();
    expect(a.container.querySelector('form[action="/e/empresa-a/auditoria/escribir/proceso_gestion_sig"]')).not.toBeNull();
    a.unmount();
    const c = render(<PantallaProcesos empresa={empresa} persona={COLAB} lista={{ procesos: [proceso()], gestionSigVigente: false }} personas={personas} />);
    expect(c.container.querySelector('form[action*="/auditoria/escribir/"]')).toBeNull(); // el marco tiene sus propios formularios (cerrar sesión)
    expect(c.container.textContent).toContain('Su rol puede consultar');
  });

  it('muestra los avisos con palabras, y la dueña dada de baja con su condición', () => {
    const { container } = render(<PantallaProcesos empresa={empresa} persona={ADMIN} lista={{ procesos: [proceso({ duenaId: U2, avisos: ['sin_relaciones', 'duena_inactiva'] })], gestionSigVigente: true }} personas={personas} />);
    expect(container.textContent).toContain('Sin personas relacionadas');
    expect(container.textContent).toContain('La dueña está dada de baja');
    expect(container.textContent).toContain('Dario Retirado (persona dada de baja)');
    expect(container.textContent).toContain('Ya existe el proceso «Gestión del SIG».');
  });

  it('el proceso retirado no ofrece cambios; la dueña vigente no se puede quitar; los formularios llevan la versión', () => {
    const r = render(<PantallaProceso empresa={empresa} persona={ADMIN} proceso={proceso()} relaciones={[{ procesoId: proceso().id, personaId: U1, relacion: 'duena' }, { procesoId: proceso().id, personaId: U1, relacion: 'supervisa' }]} personas={personas} />);
    expect(r.container.querySelector('input[name="version"][value="2"]')).not.toBeNull();
    expect(r.container.textContent).toContain('para quitarla, cambie primero la dueña');
    expect(r.container.querySelectorAll('form[action$="/relacion_quitar/dddddddd-1111-4111-8111-111111111111"]')).toHaveLength(1);
    r.unmount();
    const x = render(<PantallaProceso empresa={empresa} persona={ADMIN} proceso={proceso({ estado: 'retirado' })} relaciones={[]} personas={personas} />);
    expect(x.container.querySelector('form[action$="/proceso_cambiar/dddddddd-1111-4111-8111-111111111111"]')).toBeNull();
    expect(x.container.querySelector('form[action$="/proceso_retirar/dddddddd-1111-4111-8111-111111111111"]')).toBeNull();
  });
});
