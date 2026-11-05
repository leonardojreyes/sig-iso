import { describe, expect, it } from 'vitest';
import { ACCIONES } from './dominio/catalogo';
import { EventoBitacoraInvalidoError } from './dominio/errores';
import { validarEvento } from './dominio/validacion';
import type { EventoBitacora } from './dominio/tipos';
import { EMPRESA, HUELLA, USUARIO, ejemplos } from './prueba/ejemplos';

const base = ejemplos['libreria.adoptada'];
const con = (cambios: Record<string, unknown>): unknown => ({ ...base, ...cambios });
/** Copia del objeto sin una de sus claves. */
const sin = (objeto: object, clave: string): unknown => Object.fromEntries(Object.entries(objeto).filter(([k]) => k !== clave));
const rechaza = (evento: unknown) => expect(() => validarEvento(evento)).toThrow(EventoBitacoraInvalidoError);
const problemas = (evento: unknown): readonly string[] => {
  try {
    validarEvento(evento);
  } catch (e) {
    if (e instanceof EventoBitacoraInvalidoError) return e.problemas;
    throw e;
  }
  return [];
};

describe('eventos válidos', () => {
  it.each([...ACCIONES])('acepta el ejemplo de %s', (accion) => {
    expect(() => validarEvento(ejemplos[accion])).not.toThrow();
  });

  it('normaliza: lo ausente pasa a null y no modifica el evento recibido', () => {
    const evento: EventoBitacora = { empresaId: EMPRESA, actor: { tipo: 'usuario', usuarioId: USUARIO }, accion: 'login.ok', resultado: 'ok' };
    const copia = JSON.parse(JSON.stringify(evento));
    const r = validarEvento(evento);
    expect(r).toMatchObject({ empresaId: EMPRESA, actorTipo: 'usuario', usuarioId: USUARIO, accion: 'login.ok', objeto: null, objetoVersion: null, resultado: 'ok', motivo: null, traceId: null, origenId: null, antes: null, despues: null });
    expect(JSON.parse(JSON.stringify(evento))).toEqual(copia);
  });

  it('el registro resultante no se puede modificar', () => {
    const r = validarEvento(ejemplos['libreria.adoptada']);
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.despues)).toBe(true);
  });

  it('acepta una huella como versión del objeto', () => {
    expect(() => validarEvento(con({ objetoVersion: HUELLA }))).not.toThrow();
  });
});

describe('estructura del evento', () => {
  it.each([null, undefined, 'texto', 42, []])('rechaza algo que no es un objeto: %s', (v) => rechaza(v));

  it('rechaza una acción que no está en el catálogo', () => {
    rechaza(con({ accion: 'usuario.exportado' }));
    rechaza(con({ accion: "login.ok'; drop" }));
  });

  it('rechaza campos que no existen en el evento (por ejemplo, una dirección de red)', () => {
    rechaza(con({ ip: '10.0.0.1' }));
    rechaza(con({ correo: 'ana@example.test' }));
  });

  it('rechaza un tipo de actor no permitido para la acción', () => {
    rechaza({ ...ejemplos['login.ok'], actor: { tipo: 'plataforma' } });
    rechaza({ ...ejemplos['catalogo.cargado'], actor: { tipo: 'usuario', usuarioId: USUARIO } });
  });

  it('rechaza un resultado no permitido para la acción', () => {
    rechaza({ ...ejemplos['login.ok'], resultado: 'rechazado' });
    rechaza({ ...ejemplos['login.fallido'], resultado: 'ok' });
    rechaza(con({ resultado: 'quizas' }));
  });
});

describe('empresa y persona', () => {
  it('exige empresa en los hechos de empresa', () => {
    rechaza({ ...ejemplos['login.ok'], empresaId: null });
  });

  it('prohíbe empresa en los hechos de plataforma', () => {
    rechaza({ ...ejemplos['catalogo.cargado'], empresaId: EMPRESA });
  });

  it('admite empresa o no en los hechos donde puede ser desconocida', () => {
    expect(() => validarEvento({ ...ejemplos['login.fallido'], empresaId: EMPRESA })).not.toThrow();
    expect(() => validarEvento({ ...ejemplos['login.fallido'], empresaId: null })).not.toThrow();
  });

  it('rechaza una empresa que no es un UUID válido (aunque se fuerce el tipo)', () => {
    rechaza(con({ empresaId: 'empresa-a' }));
  });

  it.each(['ana@example.test', '1234', 'no-es-uuid', '', 42])('rechaza un identificador de persona que no es un UUID: %s', (v) => {
    rechaza(con({ actor: { tipo: 'usuario', usuarioId: v } }));
  });

  it('exige persona cuando el actor es un usuario', () => {
    rechaza(con({ actor: { tipo: 'usuario' } }));
  });

  it('rechaza campos extra en el actor (nombre, correo...)', () => {
    rechaza(con({ actor: { tipo: 'usuario', usuarioId: USUARIO, nombre: 'Ana Pérez' } }));
  });
});

describe('motivo: código de una lista cerrada, nunca texto libre', () => {
  it('rechaza un texto libre como motivo', () => {
    rechaza({ ...ejemplos['acceso.denegado'], motivo: 'La persona intentó entrar sin permiso' });
  });

  it('rechaza un código que no está en la lista de esa acción', () => {
    rechaza({ ...ejemplos['acceso.denegado'], motivo: 'token_vencido' });
  });

  it('rechaza un motivo en una acción que no admite ninguno', () => {
    rechaza({ ...ejemplos['login.ok'], motivo: 'sin_permiso' });
  });

  it('exige motivo cuando la acción lo requiere', () => {
    rechaza(sin(ejemplos['acceso.denegado'], 'motivo'));
  });
});

describe('objeto, versión y trazabilidad', () => {
  it.each(['libreria ejemplo', 'ana@example.test', 'libreria:', ':id', 'libreria:con espacio', `libreria:${'x'.repeat(101)}`, 'LIBRERIA:x'])('rechaza el objeto "%s"', (objeto) => {
    rechaza(con({ objeto }));
  });

  it.each(['v1', '1.0', 'texto libre', 'a'.repeat(63), 'g'.repeat(64)])('rechaza la versión del objeto "%s"', (objetoVersion) => {
    rechaza(con({ objetoVersion }));
  });

  it.each(['con espacios', 'a@b.c', '', 'x'.repeat(201)])('rechaza un origenId inválido: "%s"', (origenId) => {
    rechaza(con({ origenId }));
  });

  it.each(['con espacios', 'a.b', '', 'x'.repeat(65)])('rechaza un traceId inválido: "%s"', (traceId) => {
    rechaza(con({ traceId }));
  });

  it('exige el objeto cuando la acción lo requiere y lo prohíbe cuando no corresponde', () => {
    rechaza(sin(ejemplos['libreria.adoptada'], 'objeto'));
    rechaza({ ...ejemplos['login.ok'], objeto: 'libreria:x' });
  });
});

describe('antes y despues: lista blanca de claves y de valores', () => {
  it('rechaza una clave que no está permitida para la acción', () => {
    rechaza(con({ despues: { adoptada: true, entradas: 21, correo: 'ana@example.test' } }));
    rechaza(con({ despues: { adoptada: true, nombre: 'Ana' } }));
  });

  it('rechaza un valor del tipo equivocado', () => {
    rechaza(con({ despues: { adoptada: 'si', entradas: 21 } }));
    rechaza(con({ despues: { adoptada: true, entradas: '21' } }));
    rechaza(con({ despues: { adoptada: true, entradas: 1.5 } }));
    rechaza(con({ despues: { adoptada: true, entradas: -1 } }));
    rechaza(con({ despues: { adoptada: true, entradas: Number.MAX_SAFE_INTEGER } }));
  });

  it('rechaza un estado fuera de la lista cerrada', () => {
    rechaza({ ...ejemplos['rol.cambiado'], despues: { rol: 'superadministrador' } });
    rechaza({ ...ejemplos['rol.cambiado'], despues: { rol: 'Ana Pérez es administradora' } });
  });

  it('rechaza valores que no son escalares (objetos, listas, nulos)', () => {
    rechaza(con({ despues: { adoptada: { x: 1 }, entradas: 21 } }));
    rechaza(con({ despues: { adoptada: [true], entradas: 21 } }));
    rechaza(con({ despues: { adoptada: null, entradas: 21 } }));
  });

  it.each([null, 'texto', 5, [], [{ adoptada: true }]])('rechaza un antes/despues que no es un objeto: %j', (v) => {
    rechaza(con({ despues: v }));
  });

  it('un texto con forma de correo o de dirección de red no pasa por ninguna clave', () => {
    rechaza({ ...ejemplos['rol.cambiado'], despues: { rol: 'ana@example.test' } });
    rechaza({ ...ejemplos['rol.cambiado'], despues: { rol: '192.168.0.10' } });
    rechaza({ ...ejemplos['rol.cambiado'], objeto: 'usuario:192.168.0.10@x' });
  });

  it('rechaza acciones que no admiten antes/despues', () => {
    rechaza({ ...ejemplos['login.ok'], despues: { adoptada: true } });
  });

  it('acepta claves ausentes (todas son opcionales)', () => {
    expect(() => validarEvento(con({ antes: undefined, despues: { adoptada: true } }))).not.toThrow();
  });
});

describe('los mensajes de error no filtran datos', () => {
  const secreto = 'ana.perez@example.test';

  it('no repiten ningún valor recibido, solo nombres de campo y códigos', () => {
    const casos: unknown[] = [
      con({ actor: { tipo: 'usuario', usuarioId: secreto } }),
      con({ motivo: secreto }),
      con({ objeto: secreto }),
      con({ origenId: secreto }),
      con({ despues: { adoptada: secreto, entradas: 21 } }),
      { ...ejemplos['rol.cambiado'], despues: { rol: secreto } },
      con({ despues: { [secreto]: true } }),
      con({ accion: secreto }),
    ];
    for (const caso of casos) {
      const texto = [...problemas(caso)].join(' | ');
      expect(texto.length).toBeGreaterThan(0);
      expect(texto).not.toContain(secreto);
      expect(texto).not.toContain('ana.perez');
    }
  });

  it('el error de validación incluye todos los problemas encontrados', () => {
    const p = problemas({ ...base, resultado: 'quizas', motivo: 'texto libre', objeto: 'mal objeto' });
    expect(p.length).toBeGreaterThanOrEqual(3);
  });
});

describe('exceso de claves', () => {
  it('rechaza un antes/despues con muchísimas claves (nada fuera de la lista blanca pasa)', () => {
    const muchas = Object.fromEntries(Array.from({ length: 400 }, (_, i) => [`clave_${i}`, true]));
    rechaza({ ...ejemplos['rol.cambiado'], despues: muchas });
  });
});
