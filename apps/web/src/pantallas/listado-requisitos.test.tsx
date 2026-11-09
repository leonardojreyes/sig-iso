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
    expect(container.querySelector('form[method="get"]')).toBeNull(); // sin entradas no hay filtros que ofrecer
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

describe('PantallaListadoRequisitos — adoptar (H4.6, H4.9)', () => {
  const sinAdopcion = { librerias: [libreria({ adoptada: false })], entradas: [], normasDisponibles: [] };
  const otraLibreria = libreria({
    id: '5eed0009-0000-4000-8000-0000000000a9',
    codigo: 'otra',
    nombre: 'Otra librería',
    esEjemplo: false,
    adoptada: false,
  });

  it('H4.6 el administrador SIG ve un botón «Adoptar» por cada librería sin adoptar, con un formulario POST a su propia ruta', async () => {
    const { container, getAllByRole } = pantalla({
      ...sinAdopcion,
      librerias: [libreria({ adoptada: false }), otraLibreria],
      persona: admin,
    });
    const botones = getAllByRole('button', { name: /Adoptar/ });
    expect(botones).toHaveLength(2);
    const formularios = [...container.querySelectorAll('form[method="post"]')] as HTMLFormElement[];
    expect(formularios.map((f) => f.getAttribute('action'))).toEqual([
      '/e/empresa-a/librerias/' + UUID + '/adopcion',
      '/e/empresa-a/librerias/5eed0009-0000-4000-8000-0000000000a9/adopcion',
    ]);
    // El formulario no manda datos: ni empresa, ni persona, ni librería en el cuerpo (todo sale de la dirección y del token).
    for (const f of formularios)
      expect(f.querySelectorAll('input:not([type="submit"]), select, textarea')).toHaveLength(0);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('H4.6 el colaborador NO ve el botón ni ningún formulario de adopción', async () => {
    const { container, queryAllByRole } = pantalla({ ...sinAdopcion, persona: colaborador });
    expect(queryAllByRole('button', { name: /Adoptar/ })).toHaveLength(0);
    expect(container.querySelectorAll('form[method="post"]')).toHaveLength(0);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('una librería ya adoptada no ofrece el botón; con otra pendiente, el administrador la ve debajo del listado', () => {
    const { container, getAllByRole, getByText } = pantalla({ librerias: [libreria(), otraLibreria], persona: admin });
    const botones = getAllByRole('button', { name: /Adoptar/ });
    expect(botones).toHaveLength(1);
    expect(botones[0]!.getAttribute('aria-label')).toBe('Adoptar Otra librería');
    expect(getByText('Librerías disponibles para adoptar')).toBeTruthy();
    expect(container.querySelectorAll('form[method="post"]')).toHaveLength(1);
  });

  it('con todo adoptado, o para un colaborador, no aparece la sección de adopción dentro del listado', () => {
    expect(pantalla().container.querySelectorAll('form[method="post"]')).toHaveLength(0);
    expect(
      pantalla({ librerias: [libreria(), otraLibreria], persona: colaborador }).container.textContent,
    ).not.toContain('Librerías disponibles para adoptar');
  });

  it('H4.9 tras adoptar informa cuántas entradas quedaron disponibles', async () => {
    const { container } = pantalla({ aviso: { tipo: 'adoptada', libreriaId: UUID } });
    const texto = container.textContent ?? '';
    expect(texto).toContain('Librería adoptada');
    expect(texto).toContain('3 entradas disponibles');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('si ya estaba adoptada lo dice con claridad y sin dar a entender que hubo un cambio', () => {
    const texto = pantalla({ aviso: { tipo: 'ya_adoptada', libreriaId: UUID } }).container.textContent ?? '';
    expect(texto).toContain('Esa librería ya estaba adoptada');
    expect(texto).toContain('No hubo cambios');
    expect(texto).toContain('3 entradas disponibles');
  });

  it('un aviso de éxito de una librería que NO está adoptada (dirección inventada) no se muestra', () => {
    const texto =
      pantalla({ aviso: { tipo: 'adoptada', libreriaId: '5eed0009-0000-4000-8000-0000000000a9' } }).container
        .textContent ?? '';
    expect(texto).not.toContain('Librería adoptada');
    expect(texto).not.toContain('entradas disponibles');
  });

  it('un aviso de éxito de una librería que EXISTE pero no está adoptada no se muestra', () => {
    const texto =
      pantalla({ ...sinAdopcion, aviso: { tipo: 'adoptada', libreriaId: UUID } }).container.textContent ?? '';
    expect(texto).not.toContain('Librería adoptada');
    expect(texto).not.toContain('entradas disponibles');
  });

  it('con todo adoptado, ni siquiera el administrador ve la sección «disponibles para adoptar»', () => {
    const texto = pantalla({ persona: admin }).container.textContent ?? '';
    expect(texto).not.toContain('Librerías disponibles para adoptar');
    expect(texto).not.toContain('Por ahora el catálogo no tiene librerías.');
  });

  it.each([
    ['capítulo', { capitulo: 4 }],
    ['norma', { norma: 'ISO 9001' }],
    ['texto', { q: 'contexto' }],
  ])('con un filtro de %s el aviso de éxito tampoco da un número engañoso', (_n, filtros) => {
    const texto = pantalla({ aviso: { tipo: 'adoptada', libreriaId: UUID }, filtros }).container.textContent ?? '';
    expect(texto).toContain('Librería adoptada');
    expect(texto).not.toContain('entradas disponibles');
  });

  it('con filtros activos el aviso de éxito no da un número engañoso (el listado está recortado)', () => {
    const texto =
      pantalla({ aviso: { tipo: 'adoptada', libreriaId: UUID }, filtros: { q: 'contexto' } }).container.textContent ??
      '';
    expect(texto).toContain('Librería adoptada');
    expect(texto).not.toContain('entradas disponibles');
  });

  it.each([
    ['sin_permiso', 'No tiene permiso para adoptar librerías'],
    ['no_encontrada', 'La librería no existe o la adopción no está disponible'],
    ['no_disponible', 'No se pudo adoptar la librería'],
  ] as const)('el aviso «%s» se muestra como advertencia', async (tipo, frase) => {
    const { container } = pantalla({ aviso: { tipo }, ...sinAdopcion, persona: colaborador });
    expect(container.textContent).toContain(frase);
    expect(container.querySelector('[role="alert"]')).toBeTruthy();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('sin aviso no aparece ninguno', () => {
    const texto = pantalla().container.textContent ?? '';
    for (const frase of ['Librería adoptada', 'ya estaba adoptada', 'No tiene permiso', 'No se pudo adoptar'])
      expect(texto).not.toContain(frase);
  });
});
