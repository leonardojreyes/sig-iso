// Datos de ejemplo SINTÉTICOS para las pruebas de consulta (sin texto de normas).
import { crearEmpresaId } from '@sig/tenancy';
import { EntradaLibreria } from '../../domain/entrada-libreria.js';
import { Libreria } from '../../domain/libreria.js';

export const A = crearEmpresaId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
export const B = crearEmpresaId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
export const USUARIO = '44444444-4444-4444-8444-444444444444';

export const LIB1 = '11111111-1111-4111-8111-111111111111';
export const LIB2 = '22222222-2222-4222-8222-222222222222';
export const libreria1 = Libreria.crear({ id: LIB1, codigo: 'ejemplo-uno', nombre: 'Ejemplo uno', version: '1.0.0', esEjemplo: true, fuente: 'propia' });
export const libreria2 = Libreria.crear({ id: LIB2, codigo: 'ejemplo-dos', nombre: 'Ejemplo dos', version: '2.1.0', esEjemplo: false, fuente: 'propia' });

const uuid = (n: number) => `e0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const entrada = (n: number, libreriaId: string, cambio: Record<string, unknown> = {}) =>
  EntradaLibreria.crear({
    id: uuid(n),
    libreriaId,
    idEstable: `ha-tema-${n}`,
    capitulo: 4,
    nivel: 1,
    titulo: `Tema número ${n}`,
    guia: 'Explica con palabras propias qué conviene tener resuelto en este apartado.',
    alcanceComun: 'comun',
    aplicaA: [{ norma: 'ISO 9001', edicion: '2015', clausula: `4.${n}` }],
    esEjemplo: true,
    orden: n,
    ...cambio,
  } as never);

export const E = {
  contexto: entrada(1, LIB1, { idEstable: 'ha-contexto', titulo: 'Contexto', capitulo: 4, orden: 1, aplicaA: [{ norma: 'ISO 9001', edicion: '2015', clausula: '4.1' }, { norma: 'ISO/IEC 27001', edicion: '2022', clausula: '4.1' }] }),
  liderazgo: entrada(2, LIB1, { idEstable: 'ha-liderazgo', titulo: 'Liderazgo y compromiso', capitulo: 5, orden: 2, aplicaA: [{ norma: 'ISO 9001', edicion: '2015', clausula: '5.1' }] }),
  riesgos: entrada(3, LIB1, { idEstable: 'ha-riesgos', titulo: 'Gestión de riesgos', capitulo: 6, orden: 3, alcanceComun: 'parcial', aplicaA: [{ norma: 'ISO/IEC 27001', edicion: '2022', clausula: '6.1' }] }),
  mejora: entrada(4, LIB1, { idEstable: 'ha-mejora', titulo: 'Mejora', capitulo: 10, orden: 4, aplicaA: [{ norma: 'ISO 9001', edicion: '2015', clausula: '10.3' }, { norma: 'ISO/IEC 27001', edicion: '2022', clausula: '10.1' }] }),
  otra: entrada(5, LIB2, { idEstable: 'ha-otra', titulo: 'Operación planificada', capitulo: 8, orden: 1, aplicaA: [{ norma: 'ISO 9001', edicion: '2015', clausula: '8.1' }] }),
};
