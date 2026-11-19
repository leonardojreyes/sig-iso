import { describe, expect, it } from 'vitest';
import { ACCIONES } from './dominio/catalogo';
import { EventoBitacoraInvalidoError } from './dominio/errores';
import { validarEvento } from './dominio/validacion';
import { ejemplos } from './prueba/ejemplos';

// Control documental (ADR 039): objetos de forma exacta y nunca texto libre.
const rechaza = (e: unknown) => expect(() => validarEvento(e)).toThrow(EventoBitacoraInvalidoError);
const DOCUMENTALES = ACCIONES.filter((a) => /^(documento|version|lectura|retencion)\./.test(a));

describe.each(DOCUMENTALES)('%s', (accion) => {
  const e = ejemplos[accion];
  it('acepta su ejemplo y exige empresa, objeto y una persona como actor', () => {
    expect(() => validarEvento(e)).not.toThrow();
    rechaza({ ...e, empresaId: null });
    rechaza({ ...e, objeto: undefined });
    rechaza({ ...e, actor: { tipo: 'sistema' } });
  });
  it('NUNCA admite títulos, notas, motivos escritos ni nombres', () => {
    for (const clave of ['titulo', 'nota', 'nombre', 'correo', 'comentario', 'archivo', 'motivo_texto']) {
      rechaza({ ...e, despues: { [clave]: 'algo' } });
      rechaza({ ...e, antes: { [clave]: 'algo' } });
    }
  });
});

describe('forma de los objetos documentales', () => {
  it('admite códigos y versiones, y rechaza títulos o rutas', () => {
    expect(() => validarEvento({ ...ejemplos['documento.creado'], objeto: 'documento:PRO-0042' })).not.toThrow();
    expect(() => validarEvento({ ...ejemplos['version.creada'], objeto: 'version:EXT-001.v12' })).not.toThrow();
    rechaza({ ...ejemplos['documento.creado'], objeto: 'documento:Política de claves' });
    rechaza({ ...ejemplos['documento.creado'], objeto: 'documento:pol-001' });
    rechaza({ ...ejemplos['version.creada'], objeto: 'version:POL-001' });
    rechaza({ ...ejemplos['retencion.cambiada'], objeto: 'retencion:cualquiera' });
  });
  it('la huella del archivo es obligatoria al crear, aprobar y descargar una versión', () => {
    for (const a of ['version.creada', 'version.aprobada', 'version.descargada'] as const) {
      rechaza({ ...ejemplos[a], objetoVersion: undefined });
      rechaza({ ...ejemplos[a], objetoVersion: 'abc' });
    }
  });
  it('la aprobación y la devolución solo admiten valores cerrados', () => {
    rechaza({ ...ejemplos['version.devuelta'], despues: { motivo: 'porque me parece' } });
    rechaza({ ...ejemplos['version.aprobada'], despues: { por_su_autor: 'sí', requiere_lectura: true, destinatarios: 1 } });
  });
});
