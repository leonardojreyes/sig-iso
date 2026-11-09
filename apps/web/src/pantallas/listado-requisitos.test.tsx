import { render, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import type { EntradaLibreria, LibreriaResumen } from '../api/tipos';
import { PantallaListadoRequisitos } from './listado-requisitos';

const UUID = '5eed0001-0000-4000-8000-0000000000a1';
const empresa = { id: 'empresa-a', nombre: 'Empresa A (prueba)', primario: '#0b5fff' };
const admin = { nombre: 'Laura Mena', roles: ['administrador_sig'] as const };
const colaborador = { nombre: 'Pedro Soto', roles: ['colaborador'] as const };

const libreria = (c: Partial<LibreriaResumen> = {}): LibreriaResumen => ({
  id: UUID,
  codigo: 'ejemplo-demo',
  nombre: 'Ejemplo de Estructura Armonizada (borrador, numeraciones sin verificar)',
  version: '0.1.0',
  esEjemplo: true,
  fuente: 'elaboración propia SynapTech',
  adoptada: true,
  ...c,
});
const entrada = (c: Partial<EntradaLibreria> = {}): EntradaLibreria => ({
  id: UUID,
  idEstable: 'ha-4.1',
  libreriaId: UUID,
  capitulo: 4,
  nivel: 1,
  titulo: 'Contexto de la organización',
  guia: 'Anota qué factores dentro y fuera de la empresa pueden ayudar o estorbar a lograr sus resultados.',
  alcanceComun: 'comun',
  aplicaA: [
    { norma: 'ISO 9001', edicion: '2015', clausula: '4.1' },
    { norma: 'ISO/IEC 27001', edicion: '2022', clausula: '4.1' },
  ],
  esEjemplo: true,
  ...c,
});
const entradas = (): EntradaLibreria[] => [
  entrada(),
  entrada({
    id: '5eed0002-0000-4000-8000-0000000000a2',
    idEstable: 'ha-9.1',
    capitulo: 9,
    titulo: 'Seguimiento y medición',
    alcanceComun: 'parcial',
    aplicaA: [
      { norma: 'ISO 9001', edicion: '2015', clausula: '9.1' },
      { norma: 'ISO/IEC 27001', edicion: '2022', clausula: '9.1' },
    ],
  }),
  entrada({
    id: '5eed0003-0000-4000-8000-0000000000a3',
    idEstable: 'ha-6.9',
    capitulo: 6,
    titulo: 'Un tema de una sola norma',
    alcanceComun: 'especifico',
    aplicaA: [{ norma: 'ISO/IEC 27001', edicion: '2022', clausula: '6.1.3' }],
  }),
];

const base = {
  empresa,
  persona: admin,
  librerias: [libreria()],
  entradas: entradas(),
  normasDisponibles: ['ISO 9001', 'ISO/IEC 27001'],
  filtros: {},
  filtrosInvalidos: false,
};
const pantalla = (c: Partial<Parameters<typeof PantallaListadoRequisitos>[0]> = {}) =>
  render(<PantallaListadoRequisitos {...base} {...c} />);

describe('PantallaListadoRequisitos — con entradas (H5.1, H5.2, H5.5, H5.6, H5.7)', () => {
  it('no tiene violaciones de accesibilidad (axe)', async () => {
    const { container } = pantalla();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('H5.1 muestra por entrada capítulo, título, guía y la cláusula que usa CADA norma con su edición', () => {
    const { container } = pantalla();
    const fila = within(container.querySelector('tbody tr') as HTMLElement);
    expect(fila.getByText('4')).toBeTruthy();
    expect(fila.getByText('Contexto de la organización')).toBeTruthy();
    expect(fila.getByText(/factores dentro y fuera de la empresa/)).toBeTruthy();
    expect(fila.getByText(/ISO 9001:2015/)).toBeTruthy();
    expect(fila.getByText(/ISO\/IEC 27001:2022/)).toBeTruthy();
    const filas = container.querySelectorAll('tbody tr');
    expect(filas).toHaveLength(3);
    // El identificador que difiere entre normas se ve por norma.
    expect(within(filas[2] as HTMLElement).getByText(/6\.1\.3/)).toBeTruthy();
  });

  it('H5.7 cada entrada indica si su fondo es común, parcial o específico, y la pantalla explica qué significa', () => {
    const { container, getByText } = pantalla();
    const celdas = [...container.querySelectorAll('tbody tr')].map((f) => f.textContent ?? '');
    expect(celdas[0]).toContain('Común');
    expect(celdas[1]).toContain('Parcial');
    expect(celdas[2]).toContain('Específico');
    expect(getByText(/Compartir un número no significa pedir lo mismo/)).toBeTruthy();
  });

  it('H5.5 se rotula como librería de ejemplo con guías propias, no es la norma, y remite al ejemplar oficial de la empresa', () => {
    const { container } = pantalla();
    const texto = container.textContent ?? '';
    expect(texto).toContain('Librería de ejemplo con guías propias de SynapTech');
    expect(texto).toContain('No es el texto de la norma');
    expect(texto).toContain('el ejemplar que su empresa adquirió');
    expect(texto).toContain('borrador, numeraciones sin verificar'); // el nombre de la librería lo dice también
  });

  it('sin librería de ejemplo no aparece el rótulo de ejemplo', () => {
    const { container } = pantalla({
      librerias: [libreria({ esEjemplo: false })],
      entradas: [entrada({ esEjemplo: false })],
    });
    expect(container.textContent).not.toContain('Librería de ejemplo con guías propias');
  });

  it('H5.6 es solo de consulta: ni estados de cumplimiento, ni hallazgos, ni evidencias, ni acciones de edición', () => {
    const { container, queryByRole } = pantalla();
    const texto = (container.textContent ?? '').toLowerCase();
    for (const prohibida of [
      'cumplimiento',
      'cumple',
      'hallazgo',
      'evidencia',
      'semáforo',
      'nuevo requisito',
      'guardar',
    ]) {
      expect(texto, prohibida).not.toContain(prohibida);
    }
    expect(queryByRole('columnheader', { name: /estado/i })).toBeNull();
    expect(container.querySelectorAll('tbody button, tbody input, tbody select').length).toBe(0);
  });

  it('H5.2 ofrece buscar por texto y filtrar por capítulo (4 a 10) y por norma, con un formulario GET que funciona sin JavaScript', () => {
    const { container, getByLabelText } = pantalla({ filtros: { q: 'contexto', capitulo: 4, norma: 'ISO 9001' } });
    const form = container.querySelector('form[method="get"]') as HTMLFormElement;
    expect(form).toBeTruthy();
    expect((getByLabelText('Buscar por identificador o título') as HTMLInputElement).defaultValue).toBe('contexto');
    expect((getByLabelText('Buscar por identificador o título') as HTMLInputElement).name).toBe('q');
    const capitulo = getByLabelText('Capítulo') as HTMLSelectElement;
    expect(capitulo.name).toBe('capitulo');
    expect([...capitulo.options].map((o) => o.value)).toEqual(['', '4', '5', '6', '7', '8', '9', '10']);
    expect(capitulo.value).toBe('4');
    const norma = getByLabelText('Norma') as HTMLSelectElement;
    expect(norma.name).toBe('norma');
    expect([...norma.options].map((o) => o.value)).toEqual(['', 'ISO 9001', 'ISO/IEC 27001']);
    expect(norma.value).toBe('ISO 9001');
    expect(form.querySelector('a[href="/e/empresa-a/requisitos"]')).toBeTruthy(); // limpiar
  });

  it('un filtro de norma que ya no está entre las opciones no rompe el selector', () => {
    const { getByLabelText } = pantalla({ filtros: { norma: 'ISO 14001' } });
    expect((getByLabelText('Norma') as HTMLSelectElement).value).toBe('');
  });

  it('anuncia la cantidad de resultados en una región viva', () => {
    const { container } = pantalla();
    const vivo = container.querySelector('[aria-live="polite"]');
    expect(vivo?.textContent).toBe('3 entradas');
    expect(pantalla({ entradas: [entrada()] }).container.querySelector('[aria-live="polite"]')?.textContent).toBe(
      '1 entrada',
    );
  });

  it('avisa si algún filtro de la dirección no era válido', () => {
    expect(pantalla({ filtrosInvalidos: true }).container.textContent).toContain(
      'Algunos filtros no eran válidos y se ignoraron.',
    );
    expect(pantalla().container.textContent).not.toContain('Algunos filtros no eran válidos');
  });

  it('el marco muestra el nombre REAL de la persona con sesión (no el de demostración)', () => {
    const { container, getByRole, queryByRole } = pantalla({
      persona: { nombre: 'Laura Mena', roles: ['administrador_sig'] },
    });
    expect(getByRole('img', { name: 'Laura Mena' })).toBeTruthy();
    expect(queryByRole('img', { name: 'Ana Pérez' })).toBeNull();
    expect(container.textContent).toContain('Empresa A (prueba)');
  });
});

describe('PantallaListadoRequisitos — estados vacíos', () => {
  const sinAdopcion = { librerias: [libreria({ adoptada: false })], entradas: [], normasDisponibles: [] };

  it('H5.4 administrador SIG sin adopción: se le dice que puede adoptar, y se listan las librerías del catálogo', async () => {
    const { container } = pantalla({ ...sinAdopcion, persona: admin });
    const texto = container.textContent ?? '';
    expect(texto).toContain('Su empresa aún no adoptó ninguna librería');
    expect(texto).toContain('Usted es administrador SIG');
    expect(texto).toContain('Librerías disponibles en el catálogo');
    expect(texto).toContain('Ejemplo de Estructura Armonizada');
    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelector('form')).toBeNull(); // sin entradas no hay filtros que ofrecer
    expect(await axe(container)).toHaveNoViolations();
  });

  it('H5.4 colaborador sin adopción: se le dice a quién pedirlo', async () => {
    const { container } = pantalla({ ...sinAdopcion, persona: colaborador });
    const texto = container.textContent ?? '';
    expect(texto).toContain('Pida al administrador SIG de su empresa');
    expect(texto).not.toContain('Usted es administrador SIG');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('una persona con varios roles que incluyen administrador SIG recibe el mensaje de administrador', () => {
    const { container } = pantalla({
      ...sinAdopcion,
      persona: { nombre: 'X', roles: ['colaborador', 'administrador_sig'] },
    });
    expect(container.textContent).toContain('Usted es administrador SIG');
  });

  it('catálogo sin librerías: lo dice', () => {
    const { container } = pantalla({ librerias: [], entradas: [], normasDisponibles: [] });
    expect(container.textContent).toContain('Por ahora el catálogo no tiene librerías.');
  });

  it('con librería adoptada pero ningún resultado para los filtros: «sin resultados» y los filtros siguen visibles', async () => {
    const { container, getByLabelText } = pantalla({ entradas: [], filtros: { q: 'zzz' } });
    expect(container.textContent).toContain('Sin resultados');
    expect(container.querySelector('table')).toBeNull();
    expect((getByLabelText('Buscar por identificador o título') as HTMLInputElement).defaultValue).toBe('zzz');
    expect(await axe(container)).toHaveNoViolations();
  });
});
