import { describe, expect, it } from 'vitest';
import { EventoBitacoraInvalidoError } from './dominio/errores';
import { validarEvento } from './dominio/validacion';
import { ejemplos } from './prueba/ejemplos';

// Eventos del diagnóstico y del alcance (MVP, M2). La bitácora guarda estados, nunca el comentario ni el texto del alcance.
const rechaza = (e: unknown) => expect(() => validarEvento(e)).toThrow(EventoBitacoraInvalidoError);

describe('evaluacion.cambiada', () => {
  const e = ejemplos['evaluacion.cambiada'];
  it('acepta el cambio de «sin evaluar» a un estado y entre estados', () => {
    expect(() => validarEvento(e)).not.toThrow();
    expect(() => validarEvento({ ...e, antes: { estado: 'cumple' }, despues: { estado: 'no_cumple' } })).not.toThrow();
  });
  it('el estado posterior nunca es «sin evaluar» y los estados son de lista cerrada', () => {
    rechaza({ ...e, despues: { estado: 'sin_evaluar' } });
    rechaza({ ...e, despues: { estado: 'quizas' } });
  });
  it('NUNCA admite el comentario ni otro texto', () => {
    for (const clave of ['comentario', 'texto', 'justificacion', 'responsable', 'correo']) rechaza({ ...e, despues: { estado: 'cumple', [clave]: 'algo' } });
  });
  it('exige empresa, usuario y objeto, y solo lo hace una persona', () => {
    rechaza({ ...e, empresaId: null });
    rechaza({ ...e, objeto: undefined });
    rechaza({ ...e, actor: { tipo: 'sistema' } });
  });
});

describe('alcance.cambiado y alcance.aprobado', () => {
  it('aceptan sus ejemplos', () => {
    expect(() => validarEvento(ejemplos['alcance.cambiado'])).not.toThrow();
    expect(() => validarEvento(ejemplos['alcance.aprobado'])).not.toThrow();
  });
  it('no llevan el texto del alcance y exigen el objeto', () => {
    rechaza({ ...ejemplos['alcance.cambiado'], despues: { aprobado: false, texto: 'El alcance es...' } });
    rechaza({ ...ejemplos['alcance.aprobado'], objeto: undefined });
    rechaza({ ...ejemplos['alcance.aprobado'], despues: { aprobado: true } });
  });
});
