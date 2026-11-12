import { describe, expect, it } from 'vitest';
import { EventoBitacoraInvalidoError } from './dominio/errores';
import { validarEvento } from './dominio/validacion';
import { ejemplos } from './prueba/ejemplos';

// Eventos de la Declaración de Aplicabilidad (MVP, M5): solo versión, conteos y la huella del documento; nunca texto.
const rechaza = (e: unknown) => expect(() => validarEvento(e)).toThrow(EventoBitacoraInvalidoError);

describe('declaracion.aprobada', () => {
  const e = ejemplos['declaracion.aprobada'];
  it('acepta su ejemplo', () => expect(() => validarEvento(e)).not.toThrow());
  it('exige empresa, objeto y una persona como actor, y solo registra lo que salió bien', () => {
    rechaza({ ...e, empresaId: null });
    rechaza({ ...e, objeto: undefined });
    rechaza({ ...e, actor: { tipo: 'sistema' } });
    rechaza({ ...e, resultado: 'rechazado', motivo: 'sin_permiso' });
  });
  it('solo admite los cuatro conteos, como enteros', () => {
    rechaza({ ...e, despues: { ...e.despues, total: -1 } });
    rechaza({ ...e, despues: { ...e.despues, total: 1.5 } });
    rechaza({ ...e, despues: { ...e.despues, total: '93' } });
    for (const clave of ['alcance', 'texto', 'justificacion', 'titulo', 'controles', 'comentario']) rechaza({ ...e, despues: { ...e.despues, [clave]: 'algo' } });
    rechaza({ ...e, antes: { total: 1 } });
  });
});

describe('declaracion.exportada', () => {
  const e = ejemplos['declaracion.exportada'];
  it('acepta su ejemplo, para el borrador y para una versión', () => {
    expect(() => validarEvento(e)).not.toThrow();
    expect(() => validarEvento({ ...e, objeto: 'declaracion:borrador' })).not.toThrow();
  });
  it('fija la huella SHA-256 del documento entregado, y es obligatoria', () => {
    expect(e.objetoVersion).toMatch(/^[0-9a-f]{64}$/);
    rechaza({ ...e, objetoVersion: undefined });
    rechaza({ ...e, objetoVersion: 'abc' });
    rechaza({ ...e, objetoVersion: 'F'.repeat(64) });
  });
  it('exige empresa, objeto y una persona, y no admite texto ni conteos', () => {
    rechaza({ ...e, empresaId: null });
    rechaza({ ...e, objeto: undefined });
    rechaza({ ...e, actor: { tipo: 'sistema' } });
    rechaza({ ...e, despues: { total: 1 } });
    rechaza({ ...e, despues: { nombre: 'declaracion.docx' } });
  });
});
