import { crearEmpresaId, EmpresaIdInvalidoError } from '@sig/tenancy';
import { describe, expect, it } from 'vitest';
import { AutorizacionFake } from './autorizacion-fake.js';
import { ErrorAutorizacion } from './errores.js';
import { PERMISOS, permisosDe, ROLES, type Permiso, type Rol } from './roles.js';

const A = crearEmpresaId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
const B = crearEmpresaId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
const ADMIN = '44444444-4444-4444-8444-444444444444';
const COLAB = '55555555-5555-4555-8555-555555555555';
const OTRO = '66666666-6666-4666-8666-666666666666';

const montar = () => {
  const f = new AutorizacionFake();
  f.asignar(A, ADMIN, 'administrador_sig');
  f.asignar(A, COLAB, 'colaborador');
  return f;
};

describe('matriz de permisos por rol (ADR 008, corte 0.6)', () => {
  it('administrador_sig puede todo', () => {
    expect([...permisosDe('administrador_sig')].sort()).toEqual([...PERMISOS].sort());
  });

  it('colaborador solo consulta: no puede adoptar librerías', () => {
    expect(permisosDe('colaborador')).toContain('requisitos.ver');
    expect(permisosDe('colaborador')).not.toContain('librerias.adoptar');
  });

  it.each(['dueno_proceso', 'auditor_interno', 'auditor_externo', 'alta_direccion'] as Rol[])(
    'el rol %s aún no tiene permisos definidos en este corte (cerrado por defecto)',
    (rol) => {
      expect(permisosDe(rol)).toEqual([]);
    },
  );

  it('la matriz no se puede alterar desde fuera', () => {
    const lista = permisosDe('colaborador') as Permiso[];
    expect(() => lista.push('librerias.adoptar')).toThrow();
    expect(permisosDe('colaborador')).not.toContain('librerias.adoptar');
    expect(Object.isFrozen(ROLES)).toBe(true);
    expect(Object.isFrozen(PERMISOS)).toBe(true);
  });
});

describe('AutorizacionFake.puede', () => {
  it('administrador adopta; colaborador no, pero sí consulta', async () => {
    const f = montar();
    expect(await f.puede(ADMIN, 'librerias.adoptar', A)).toBe(true);
    expect(await f.puede(COLAB, 'librerias.adoptar', A)).toBe(false);
    expect(await f.puede(COLAB, 'requisitos.ver', A)).toBe(true);
    expect(await f.puede(COLAB, 'librerias.ver', A)).toBe(true);
    expect(await f.puede(COLAB, 'marca.ver', A)).toBe(true);
  });

  it('sin rol en la empresa no puede nada', async () => {
    const f = montar();
    for (const p of PERMISOS) expect(await f.puede(OTRO, p, A)).toBe(false);
  });

  it('el rol vale solo en SU empresa: administrador de A no puede nada en B', async () => {
    const f = montar();
    for (const p of PERMISOS) expect(await f.puede(ADMIN, p, B)).toBe(false);
    f.asignar(B, ADMIN, 'colaborador');
    expect(await f.puede(ADMIN, 'librerias.adoptar', B)).toBe(false);
    expect(await f.puede(ADMIN, 'librerias.adoptar', A)).toBe(true);
  });

  it('varios roles se suman; revocar uno deja los demás', async () => {
    const f = montar();
    f.asignar(A, COLAB, 'administrador_sig');
    expect(await f.puede(COLAB, 'librerias.adoptar', A)).toBe(true);
    f.revocar(A, COLAB, 'administrador_sig');
    expect(await f.puede(COLAB, 'librerias.adoptar', A)).toBe(false);
    expect(await f.puede(COLAB, 'requisitos.ver', A)).toBe(true);
  });

  it('un permiso desconocido se niega (cerrado por defecto), incluidos nombres del prototipo', async () => {
    const f = montar();
    for (const p of ['', 'todo', 'LIBRERIAS.ADOPTAR', '__proto__', 'constructor', 'toString', 'hasOwnProperty', 'librerias.adoptar ']) {
      expect(await f.puede(ADMIN, p as never, A)).toBe(false);
    }
  });

  it('el identificador de usuario se compara sin distinguir mayúsculas', async () => {
    const f = montar();
    expect(await f.puede(ADMIN.toUpperCase(), 'librerias.adoptar', A)).toBe(true);
  });

  it('un usuario no hereda el rol de otro', async () => {
    const f = montar();
    expect(await f.puede(OTRO, 'librerias.adoptar', A)).toBe(false);
  });

  it.each(['', 'no-uuid', '00000000-0000-0000-0000-000000000000', undefined, null, 7, "' or 1=1 --"])(
    'un usuario inválido (%j) NO se decide: falla, nunca responde «sí»',
    async (id) => {
      await expect(montar().puede(id as never, 'librerias.adoptar', A)).rejects.toBeInstanceOf(ErrorAutorizacion);
    },
  );

  it.each(['x', undefined, '00000000-0000-0000-0000-000000000000'])('una empresa inválida (%j) falla', async (e) => {
    await expect(montar().puede(ADMIN, 'librerias.adoptar', e as never)).rejects.toBeInstanceOf(EmpresaIdInvalidoError);
  });

  it('los errores no repiten el valor recibido', async () => {
    let mensaje = '';
    try {
      await montar().puede('dato-que-no-debe-repetirse', 'librerias.adoptar', A);
    } catch (e) {
      mensaje = (e as Error).message;
    }
    expect(mensaje).not.toBe('');
    expect(mensaje).not.toContain('dato-que-no-debe-repetirse');
  });
});

describe('AutorizacionFake.asignar y revocar', () => {
  it.each(['superusuario', '', undefined, '__proto__', 'ninguno'])('rechaza el rol %j', (rol) => {
    expect(() => new AutorizacionFake().asignar(A, ADMIN, rol as never)).toThrow(ErrorAutorizacion);
    expect(() => new AutorizacionFake().revocar(A, ADMIN, rol as never)).toThrow(ErrorAutorizacion);
  });
  it('rechaza ids inválidos', () => {
    expect(() => new AutorizacionFake().asignar(A, 'x', 'colaborador')).toThrow(ErrorAutorizacion);
    expect(() => new AutorizacionFake().asignar('x' as never, ADMIN, 'colaborador')).toThrow(EmpresaIdInvalidoError);
  });
  it('revocar algo que no estaba asignado no falla', () => {
    expect(() => new AutorizacionFake().revocar(A, ADMIN, 'colaborador')).not.toThrow();
  });
  it('asignar dos veces es idempotente', async () => {
    const f = new AutorizacionFake();
    f.asignar(A, ADMIN, 'colaborador');
    f.asignar(A, ADMIN, 'colaborador');
    f.revocar(A, ADMIN, 'colaborador');
    expect(await f.puede(ADMIN, 'requisitos.ver', A)).toBe(false);
  });
});

describe('AutorizacionFake.rolesDe', () => {
  it('devuelve los roles de la persona en ESA empresa, en el orden del catálogo y sin repetir', async () => {
    const f = new AutorizacionFake();
    f.asignar(A, ADMIN, 'colaborador');
    f.asignar(A, ADMIN, 'administrador_sig');
    f.asignar(A, ADMIN, 'colaborador');
    expect(await f.rolesDe(ADMIN, A)).toEqual(['administrador_sig', 'colaborador']);
  });

  it('sin roles en la empresa devuelve una lista vacía (nunca los de otra empresa)', async () => {
    const f = montar();
    expect(await f.rolesDe(ADMIN, B)).toEqual([]);
    expect(await f.rolesDe(OTRO, A)).toEqual([]);
  });

  it('no deja alterar el estado interno desde la lista devuelta', async () => {
    const f = montar();
    const lista = (await f.rolesDe(ADMIN, A)) as Rol[];
    expect(() => lista.push('colaborador')).toThrow();
    expect(await f.rolesDe(ADMIN, A)).toEqual(['administrador_sig']);
  });

  it('el identificador se compara sin distinguir mayúsculas', async () => {
    expect(await montar().rolesDe(ADMIN.toUpperCase(), A)).toEqual(['administrador_sig']);
  });

  it.each(['', 'no-uuid', undefined, null, 7])('un usuario inválido (%j) falla en vez de devolver una lista vacía', async (id) => {
    await expect(montar().rolesDe(id as never, A)).rejects.toBeInstanceOf(ErrorAutorizacion);
  });

  it.each(['x', undefined, '00000000-0000-0000-0000-000000000000'])('una empresa inválida (%j) falla', async (e) => {
    await expect(montar().rolesDe(ADMIN, e as never)).rejects.toBeInstanceOf(EmpresaIdInvalidoError);
  });
});

describe('permisos del diagnóstico y del alcance (MVP, M2)', () => {
  it('el colaborador consulta y evalúa, pero no gestiona ni aprueba el alcance', async () => {
    const f = montar();
    for (const p of ['diagnostico.ver', 'diagnostico.evaluar', 'alcance.ver'] as const) expect(await f.puede(COLAB, p, A), p).toBe(true);
    for (const p of ['alcance.gestionar', 'alcance.aprobar'] as const) expect(await f.puede(COLAB, p, A), p).toBe(false);
  });
  it('el administrador SIG puede todo, incluida la aprobación del alcance', async () => {
    const f = montar();
    for (const p of ['diagnostico.ver', 'diagnostico.evaluar', 'alcance.ver', 'alcance.gestionar', 'alcance.aprobar'] as const) expect(await f.puede(ADMIN, p, A), p).toBe(true);
  });
  it('sin rol o con el rol de otra empresa no puede nada', async () => {
    const f = montar();
    expect(await f.puede(OTRO, 'diagnostico.evaluar', A)).toBe(false);
    expect(await f.puede(ADMIN, 'alcance.aprobar', B)).toBe(false);
  });
});

describe('permisos de los controles de la empresa (MVP, M3)', () => {
  it('el colaborador consulta el marco de controles, pero no lo gestiona', async () => {
    const f = montar();
    expect(await f.puede(COLAB, 'controles.ver', A)).toBe(true);
    expect(await f.puede(COLAB, 'controles.gestionar', A)).toBe(false);
  });
  it('el administrador SIG consulta y gestiona', async () => {
    const f = montar();
    for (const p of ['controles.ver', 'controles.gestionar'] as const) expect(await f.puede(ADMIN, p, A), p).toBe(true);
  });
  it('ningún rol sin permisos ve ni gestiona controles, y no hay permiso en otra empresa', async () => {
    const f = montar();
    for (const p of ['controles.ver', 'controles.gestionar'] as const) {
      expect(await f.puede(OTRO, p, A), p).toBe(false);
      expect(await f.puede(ADMIN, p, B), p).toBe(false);
    }
  });
});
