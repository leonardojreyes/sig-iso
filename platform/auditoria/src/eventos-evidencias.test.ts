import { describe, expect, it } from 'vitest';
import { EventoBitacoraInvalidoError } from './dominio/errores';
import { validarEvento } from './dominio/validacion';
import { ejemplos } from './prueba/ejemplos';

// Eventos de las evidencias con archivo (MVP, M4). La bitácora fija la HUELLA del archivo; nunca el título, el nombre ni el contenido.
const rechaza = (e: unknown) => expect(() => validarEvento(e)).toThrow(EventoBitacoraInvalidoError);
const OK = ['evidencia.creada', 'evidencia.reemplazada', 'evidencia.eliminada', 'evidencia.descargada'] as const;
const HUELLA = 'f'.repeat(64);

describe.each(OK)('%s', (accion) => {
  const e = ejemplos[accion];
  it('acepta su ejemplo', () => expect(() => validarEvento(e)).not.toThrow());
  it('lleva la huella SHA-256 como versión del objeto, y es obligatoria', () => {
    expect(e.objetoVersion).toMatch(/^[0-9a-f]{64}$/);
    rechaza({ ...e, objetoVersion: undefined });
    rechaza({ ...e, objetoVersion: 'abc' });
    rechaza({ ...e, objetoVersion: 'F'.repeat(64) });
    expect(() => validarEvento({ ...e, objetoVersion: HUELLA })).not.toThrow();
  });
  it('exige empresa, objeto y una persona como actor, y solo registra lo que salió bien', () => {
    rechaza({ ...e, empresaId: null });
    rechaza({ ...e, objeto: undefined });
    rechaza({ ...e, actor: { tipo: 'sistema' } });
    rechaza({ ...e, resultado: 'rechazado', motivo: 'sin_permiso' });
  });
  it('NUNCA admite el título, el nombre del archivo ni otro texto', () => {
    for (const clave of ['titulo', 'nombre', 'archivo', 'contenido', 'comentario', 'ruta', 'correo']) {
      rechaza({ ...e, despues: { [clave]: 'algo' } });
      rechaza({ ...e, antes: { [clave]: 'algo' } });
    }
  });
});

describe('evidencia.subida_rechazada', () => {
  const e = ejemplos['evidencia.subida_rechazada'];
  it('acepta su ejemplo, con o sin la huella del archivo rechazado', () => {
    expect(() => validarEvento(e)).not.toThrow();
    expect(() => validarEvento({ ...e, objetoVersion: HUELLA })).not.toThrow();
  });
  it.each(['tipo_no_permitido', 'tamano_excedido', 'firma_invalida'])('acepta el motivo %s', (motivo) => {
    expect(() => validarEvento({ ...e, motivo })).not.toThrow();
  });
  it('rechaza cualquier otro motivo y exige uno', () => {
    for (const motivo of ['sin_permiso', 'virus', 'es un exe', 'TIPO_NO_PERMITIDO']) rechaza({ ...e, motivo });
    rechaza({ ...e, motivo: undefined });
  });
  it('solo registra rechazos, de una persona y sobre un control', () => {
    rechaza({ ...e, resultado: 'ok' });
    rechaza({ ...e, actor: { tipo: 'sistema' } });
    rechaza({ ...e, objeto: undefined });
    rechaza({ ...e, empresaId: null });
  });
});

describe('el objeto', () => {
  it('acepta la evidencia por su UUID y no el título ni el nombre del archivo', () => {
    expect(() => validarEvento({ ...ejemplos['evidencia.creada'], objeto: 'evidencia:e0000000-1111-4111-8111-111111111111' })).not.toThrow();
    rechaza({ ...ejemplos['evidencia.creada'], objeto: 'evidencia:Política de contraseñas.pdf' });
    rechaza({ ...ejemplos['evidencia.descargada'], objeto: 'evidencia:../../etc/passwd' });
  });
});
