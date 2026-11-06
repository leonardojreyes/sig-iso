import { crearEmpresaId, EmpresaIdInvalidoError } from '@sig/tenancy';
import { describe, expect, it, vi } from 'vitest';
import { AdopcionLibreria } from '../domain/adopcion-libreria.js';
import { ErrorNormas } from '../domain/errores.js';
import { Libreria } from '../domain/libreria.js';
import type { AutorizacionPort } from './autorizacion.port.js';
import { AdoptarLibreriaUseCase, LibreriaNoEncontradaError, SinPermisoError } from './adoptar-libreria.use-case.js';
import { crearUnidadDeTrabajoFalsa, EstadoFalso } from './prueba/fakes.js';

const A = crearEmpresaId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
const B = crearEmpresaId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
const ADMIN = '44444444-4444-4444-8444-444444444444';
const COLAB = '55555555-5555-4555-8555-555555555555';
const LIB_ID = '11111111-1111-4111-8111-111111111111';
const INEXISTENTE = '99999999-9999-4999-8999-999999999999';
const libreria = Libreria.crear({ id: LIB_ID, codigo: 'ejemplo-estructura-armonizada', nombre: 'Ejemplo', version: '1.0.0', esEjemplo: true, fuente: 'propia' });
const AHORA = new Date('2026-11-06T10:00:00.000Z');

const montar = (opciones: { puede?: boolean; libreria?: Libreria | null } = {}) => {
  const estado = new EstadoFalso(opciones.libreria === undefined ? libreria : opciones.libreria, 21);
  const puede = vi.fn(async (usuarioId: string) => (opciones.puede ?? usuarioId === ADMIN));
  const autorizacion: AutorizacionPort = { puede };
  const caso = new AdoptarLibreriaUseCase(crearUnidadDeTrabajoFalsa(estado), autorizacion, () => AHORA);
  return { estado, puede, caso };
};
/** Ejecuta y devuelve el error lanzado (falla la prueba si no lanzó nada). */
const errorDe = async (promesa: Promise<unknown>): Promise<Error> => {
  try {
    await promesa;
  } catch (e) {
    return e as Error;
  }
  throw new Error('Se esperaba un error y no hubo ninguno');
};
const entrada = (cambio: Record<string, unknown> = {}) => ({ empresaId: A, usuarioId: ADMIN, libreriaId: LIB_ID, traceId: 'traza-1', ...cambio }) as never;

describe('AdoptarLibreria — primera adopción', () => {
  it('adopta, informa cuántas entradas quedaron disponibles (H4.9) y no es «ya adoptada»', async () => {
    const { caso, estado } = montar();
    const r = await caso.ejecutar(entrada());
    expect(r).toEqual({ libreriaId: LIB_ID, entradas: 21, yaAdoptada: false, adoptadaEn: '2026-11-06T10:00:00.000Z' });
    expect([...estado.adopciones.values()]).toHaveLength(1);
    expect(estado.adopciones.get(`${A}|${LIB_ID}`)).toMatchObject({ empresaId: A, adoptadaPor: ADMIN });
  });

  it('registra UN hecho «libreria.adoptada» con quién, empresa, librería, versión y resultado (H6.4)', async () => {
    const { caso, estado } = montar();
    await caso.ejecutar(entrada());
    expect(estado.bitacora).toHaveLength(1);
    expect(estado.bitacora[0]).toMatchObject({
      empresaId: A, actorTipo: 'usuario', usuarioId: ADMIN, accion: 'libreria.adoptada', resultado: 'ok', motivo: null,
      objeto: 'libreria:ejemplo-estructura-armonizada', objetoVersion: '1.0.0', traceId: 'traza-1',
      antes: { adoptada: false }, despues: { adoptada: true, entradas: 21 },
    });
  });

  it('pide permiso con el usuario, el permiso de adoptar y la empresa del contexto', async () => {
    const { caso, puede } = montar();
    await caso.ejecutar(entrada());
    expect(puede).toHaveBeenCalledWith(ADMIN, 'librerias.adoptar', A);
  });
});

describe('AdoptarLibreria — ya adoptada (H4.7)', () => {
  it('no es un rechazo: informa «ya adoptada», no duplica ni cambia nada', async () => {
    const { caso, estado } = montar();
    const primera = await caso.ejecutar(entrada());
    const antes = estado.adopciones.get(`${A}|${LIB_ID}`);
    const segunda = await new AdoptarLibreriaUseCase(crearUnidadDeTrabajoFalsa(estado), { puede: async () => true }, () => new Date('2027-01-01T00:00:00Z'))
      .ejecutar(entrada({ usuarioId: '66666666-6666-4666-8666-666666666666' }));
    expect(segunda).toEqual({ ...primera, yaAdoptada: true });
    expect(estado.adopciones.size).toBe(1);
    expect(estado.adopciones.get(`${A}|${LIB_ID}`)).toBe(antes);
  });

  it('el intento repetido también queda registrado, con motivo «ya_adoptada» y antes en verdadero', async () => {
    const { caso, estado } = montar();
    await caso.ejecutar(entrada());
    await caso.ejecutar(entrada());
    expect(estado.bitacora).toHaveLength(2);
    expect(estado.bitacora[1]).toMatchObject({ resultado: 'ok', motivo: 'ya_adoptada', antes: { adoptada: true }, despues: { adoptada: true, entradas: 21 } });
  });

  it('una carrera (otra adopción simultánea ganó) se trata como «ya adoptada», sin error y sin pisar a la ganadora', async () => {
    const { caso, estado } = montar();
    estado.ganadora = AdopcionLibreria.crear({ empresaId: A, libreriaId: LIB_ID, usuarioId: COLAB, ahora: new Date('2026-11-05T00:00:00Z') });
    const r = await caso.ejecutar(entrada());
    expect(r).toEqual({ libreriaId: LIB_ID, entradas: 21, yaAdoptada: true, adoptadaEn: '2026-11-05T00:00:00.000Z' });
    expect(estado.adopciones.get(`${A}|${LIB_ID}`)).toBe(estado.ganadora);
    expect(estado.bitacora[0]).toMatchObject({ motivo: 'ya_adoptada', antes: { adoptada: true } });
  });

  it('si tras la carrera la adopción ganadora desapareció, falla (no inventa una)', async () => {
    const { estado } = montar();
    const base = crearUnidadDeTrabajoFalsa(estado);
    const unidad = {
      ejecutar: (e: typeof A, fn: Parameters<typeof base.ejecutar>[1]) =>
        base.ejecutar(e, (ctx) => fn({ ...ctx, adopciones: { obtener: async () => null, crear: async () => 'ya_existia' as const } })),
    } as typeof base;
    await expect(new AdoptarLibreriaUseCase(unidad, { puede: async () => true }, () => AHORA).ejecutar(entrada())).rejects.toThrow(/ya no se encuentra/);
  });
});

describe('AdoptarLibreria — sin permiso (H4.6)', () => {
  it('un colaborador recibe SinPermisoError sin abrir ninguna unidad ni escribir nada', async () => {
    const { caso, estado, puede } = montar();
    await expect(caso.ejecutar(entrada({ usuarioId: COLAB }))).rejects.toBeInstanceOf(SinPermisoError);
    expect(puede).toHaveBeenCalledOnce();
    expect(estado.unidades).toEqual([]);
    expect(estado.adopciones.size).toBe(0);
    expect(estado.bitacora).toHaveLength(0);
  });

  it('el permiso se evalúa ANTES de mirar la librería: mismo error con un id existente y con uno inexistente', async () => {
    const { caso } = montar();
    const e1 = await errorDe(caso.ejecutar(entrada({ usuarioId: COLAB })));
    const e2 = await errorDe(caso.ejecutar(entrada({ usuarioId: COLAB, libreriaId: INEXISTENTE })));
    expect(e1).toBeInstanceOf(SinPermisoError);
    expect(e2).toBeInstanceOf(SinPermisoError);
    expect(e1.message).toBe(e2.message);
  });

  it('si el servicio de permisos falla, se cierra el acceso (no se adopta) y el error se propaga', async () => {
    const estado = new EstadoFalso(libreria, 21);
    const caso = new AdoptarLibreriaUseCase(crearUnidadDeTrabajoFalsa(estado), { puede: async () => { throw new Error('permisos caído'); } }, () => AHORA);
    await expect(caso.ejecutar(entrada())).rejects.toThrow('permisos caído');
    expect(estado.adopciones.size).toBe(0);
  });
});

describe('AdoptarLibreria — librería inexistente (H4.7)', () => {
  it('da LibreriaNoEncontradaError y no escribe nada', async () => {
    const { caso, estado } = montar();
    const e = await errorDe(caso.ejecutar(entrada({ libreriaId: INEXISTENTE })));
    expect(e).toBeInstanceOf(LibreriaNoEncontradaError);
    expect(e.message).not.toContain(INEXISTENTE);
    expect(estado.adopciones.size).toBe(0);
    expect(estado.bitacora).toHaveLength(0);
  });

  it('un catálogo vacío se comporta igual', async () => {
    const { caso } = montar({ libreria: null });
    await expect(caso.ejecutar(entrada())).rejects.toBeInstanceOf(LibreriaNoEncontradaError);
  });
});

describe('AdoptarLibreria — todo o nada (H4.10, H6.8)', () => {
  it.each(['obtener', 'obtenerLibreria', 'crear', 'contarEntradas', 'bitacora'])('si falla «%s» a mitad de camino la empresa queda como estaba', async (operacion) => {
    const { caso, estado } = montar();
    const error = new Error(`fallo en ${operacion}`);
    estado.fallos.set(operacion, error);
    await expect(caso.ejecutar(entrada())).rejects.toBe(error);
    expect(estado.adopciones.size).toBe(0);
    expect(estado.bitacora).toHaveLength(0);
  });

  it('un fallo de la bitácora en una repetición tampoco cambia lo adoptado antes', async () => {
    const { caso, estado } = montar();
    await caso.ejecutar(entrada());
    estado.fallos.set('bitacora', new Error('bitácora caída'));
    await expect(caso.ejecutar(entrada())).rejects.toThrow('bitácora caída');
    expect(estado.adopciones.size).toBe(1);
    expect(estado.bitacora).toHaveLength(1);
  });
});

describe('AdoptarLibreria — aislamiento entre empresas (H4.8)', () => {
  it('lo que adopta A no lo adopta B: B adopta por su cuenta y cada una usa solo su contexto', async () => {
    const { caso, estado } = montar({ puede: true });
    await caso.ejecutar(entrada());
    expect(estado.adopciones.has(`${B}|${LIB_ID}`)).toBe(false);
    const deB = await caso.ejecutar(entrada({ empresaId: B }));
    expect(deB.yaAdoptada).toBe(false);
    expect(estado.unidades).toEqual([A, B]);
    expect(estado.bitacora.map((r) => r.empresaId)).toEqual([A, B]);
  });

  it('las entradas solo cuentan tras adoptar: antes de adoptar B no ve ninguna', async () => {
    const { estado } = montar();
    await new AdoptarLibreriaUseCase(crearUnidadDeTrabajoFalsa(estado), { puede: async () => true }, () => AHORA).ejecutar(entrada());
    const visibleParaB = await crearUnidadDeTrabajoFalsa(estado).ejecutar(B, (ctx) => ctx.catalogo.contarEntradas(LIB_ID));
    expect(visibleParaB).toBe(0);
  });
});

describe('AdoptarLibreria — entradas inválidas', () => {
  it.each([
    ['empresaId', 'no-uuid', EmpresaIdInvalidoError],
    ['empresaId', undefined, EmpresaIdInvalidoError],
    ['usuarioId', 'x', ErrorNormas],
    ['libreriaId', '{11111111-1111-4111-8111-111111111111}', ErrorNormas],
    ['libreriaId', '11111111111141118111111111111111', ErrorNormas],
    ['libreriaId', "' or 1=1 --", ErrorNormas],
  ])('rechaza %s=%j antes de pedir permisos o abrir una unidad', async (campo, valor, tipo) => {
    const { caso, estado, puede } = montar();
    await expect(caso.ejecutar(entrada({ [campo]: valor }))).rejects.toBeInstanceOf(tipo);
    expect(puede).not.toHaveBeenCalled();
    expect(estado.unidades).toEqual([]);
  });

  it('un traceId que no cumple el formato de la bitácora hace fallar la adopción completa y la revierte', async () => {
    const { caso, estado } = montar();
    await expect(caso.ejecutar(entrada({ traceId: 'con espacios y símbolos <>' }))).rejects.toThrow();
    expect(estado.adopciones.size).toBe(0);
  });
});
