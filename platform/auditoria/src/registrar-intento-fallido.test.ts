import { crearEmpresaId } from '@sig/tenancy';
import { describe, expect, it, vi } from 'vitest';
import { EventoIdentidadInvalidoError, RegistrarIntentoFallido } from './servicio/registrar-intento-fallido';
import { Bitacora } from './servicio/bitacora';
import type { RegistroBitacora } from './dominio/tipos';
import type { BitacoraPort, ResultadoRegistro } from './puertos/bitacora.port';

const EMPRESA = crearEmpresaId('3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c');
const USUARIO = '11111111-2222-4333-8444-555555555555';
const T = Date.UTC(2026, 10, 5, 21, 0, 0, 123); // 2026-11-05T21:00:00.123Z

/** Evento tal como lo entrega el sistema de identidad: trae MUCHO más de lo que se debe guardar. */
const crudo = (cambios: Record<string, unknown> = {}): Record<string, unknown> => ({
  time: T,
  type: 'LOGIN_ERROR',
  realmId: 'sigiso',
  clientId: 'sigiso-web',
  userId: undefined,
  sessionId: 'sesion-secreta-123',
  ipAddress: '203.0.113.77',
  error: 'user_not_found',
  details: { username: 'ana.perez@example.test', auth_method: 'openid-connect', redirect_uri: 'http://localhost:3000/auth/callback' },
  ...cambios,
});

/** Puerto en memoria con la misma semántica de idempotencia que el real. */
const montar = (resolverEmpresa?: (usuarioId: string) => Promise<ReturnType<typeof crearEmpresaId> | null>) => {
  const guardados = new Map<string, RegistroBitacora>();
  const puerto: BitacoraPort = {
    registrar: vi.fn(async () => {}),
    registrarUnaVez: vi.fn(async (r): Promise<ResultadoRegistro> => {
      if (guardados.has(r.origenId!)) return 'ya_existia';
      guardados.set(r.origenId!, r);
      return 'registrado';
    }),
  };
  // Se usa el servicio REAL de la bitácora: el evento que produce el caso de uso se valida contra el catálogo.
  const caso = new RegistrarIntentoFallido(new Bitacora(puerto), resolverEmpresa);
  return { caso, puerto, guardados };
};
const unico = (guardados: Map<string, RegistroBitacora>): RegistroBitacora => [...guardados.values()][0]!;

describe('RegistrarIntentoFallido: qué se registra', () => {
  it('registra un intento fallido de una cuenta inexistente como hecho de plataforma, sin persona', async () => {
    const { caso, guardados } = montar();
    expect(await caso.ejecutar(crudo())).toBe('registrado');
    expect(unico(guardados)).toMatchObject({
      empresaId: null,
      actorTipo: 'proceso',
      usuarioId: null,
      accion: 'login.fallido',
      resultado: 'rechazado',
      motivo: 'cuenta_inexistente',
      despues: { ocurrio_en: '2026-11-05T21:00:00.123Z' },
    });
  });

  it('con una cuenta conocida guarda solo su identificador opaco (en minúsculas)', async () => {
    const { caso, guardados } = montar();
    await caso.ejecutar(crudo({ userId: USUARIO.toUpperCase(), error: 'invalid_user_credentials' }));
    expect(unico(guardados)).toMatchObject({ usuarioId: USUARIO, motivo: 'credenciales_invalidas' });
  });

  it.each([
    ['invalid_user_credentials', 'credenciales_invalidas'],
    ['user_not_found', 'cuenta_inexistente'],
    ['user_disabled', 'cuenta_bloqueada'],
    ['user_temporarily_disabled', 'cuenta_bloqueada'],
    ['algo_nuevo_de_la_version_26', 'error_no_clasificado'],
    ['La persona escribió mal su contraseña', 'error_no_clasificado'],
    [undefined, 'error_no_clasificado'],
    [42, 'error_no_clasificado'],
  ])('el código de error %j se registra con el motivo %s', async (error, motivo) => {
    const { caso, guardados } = montar();
    await caso.ejecutar(crudo({ error }));
    expect(unico(guardados).motivo).toBe(motivo);
  });

  it('ignora lo que no es un intento fallido de ingreso y no escribe nada', async () => {
    const { caso, puerto } = montar();
    for (const type of ['LOGIN', 'LOGOUT', 'REGISTER', 'UPDATE_PASSWORD', 'login_error', undefined, 42]) {
      expect(await caso.ejecutar(crudo({ type })), String(type)).toBe('ignorado');
    }
    expect(puerto.registrarUnaVez).not.toHaveBeenCalled();
  });
});

describe('RegistrarIntentoFallido: lista blanca (ADR 028)', () => {
  const secretos = ['203.0.113.77', 'ana.perez', 'example.test', 'sesion-secreta', 'auth_method', 'redirect_uri', 'localhost', 'sigiso-web', 'realmId', 'sessionId', 'ipAddress', 'username'];

  it('no copia la dirección de red, el nombre de usuario ni los detalles: no aparecen en ninguna parte del registro', async () => {
    const { caso, guardados } = montar();
    await caso.ejecutar(crudo({ userId: USUARIO }));
    const texto = JSON.stringify(unico(guardados));
    for (const s of secretos) expect(texto, s).not.toContain(s);
  });

  it('un identificador de persona con forma de correo o de texto se descarta, no se guarda ni rompe el registro', async () => {
    const { caso, guardados } = montar();
    await caso.ejecutar(crudo({ userId: 'ana.perez@example.test' }));
    const r = unico(guardados);
    expect(r.usuarioId).toBeNull();
    expect(JSON.stringify(r)).not.toContain('ana.perez');
  });

  it('un campo desconocido cualquiera del evento tampoco llega al registro', async () => {
    const { caso, guardados } = montar();
    await caso.ejecutar(crudo({ campoNuevo: 'ana@example.test', otro: { x: 1 } }));
    expect(JSON.stringify(unico(guardados))).not.toContain('ana@example.test');
  });
});

describe('RegistrarIntentoFallido: idempotencia', () => {
  it('el mismo evento dos veces se registra una sola vez', async () => {
    const { caso, guardados } = montar();
    expect(await caso.ejecutar(crudo())).toBe('registrado');
    expect(await caso.ejecutar(crudo())).toBe('ya_existia');
    expect(guardados.size).toBe(1);
  });

  it('la clave no depende de los campos que no se guardan (dirección de red, nombre de usuario...)', async () => {
    const { caso, guardados } = montar();
    await caso.ejecutar(crudo());
    expect(await caso.ejecutar(crudo({ ipAddress: '198.51.100.9', details: { username: 'otra.persona@example.test' }, sessionId: 'otra' }))).toBe('ya_existia');
    expect(guardados.size).toBe(1);
  });

  it.each([
    ['la hora', { time: T + 1 }],
    ['la cuenta', { userId: USUARIO }],
    ['la aplicación cliente', { clientId: 'otra-aplicacion' }],
    ['el código de error', { error: 'invalid_user_credentials' }],
  ])('un evento distinto en %s es otro hecho', async (_n, cambio) => {
    const { caso, guardados } = montar();
    await caso.ejecutar(crudo());
    expect(await caso.ejecutar(crudo(cambio))).toBe('registrado');
    expect(guardados.size).toBe(2);
  });

  it('la clave es estable y no deja ver ningún dato: solo un prefijo y una huella', async () => {
    const a = montar();
    const b = montar();
    await a.caso.ejecutar(crudo({ userId: USUARIO }));
    await b.caso.ejecutar(crudo({ userId: USUARIO }));
    const clave = unico(a.guardados).origenId!;
    expect(clave).toBe(unico(b.guardados).origenId);
    expect(clave).toMatch(/^kc:login_error:[0-9a-f]{64}$/);
    expect(clave).not.toContain(USUARIO);
  });
});

describe('RegistrarIntentoFallido: empresa', () => {
  it('sin resolvedor de empresa, el hecho es de plataforma', async () => {
    const { caso, guardados } = montar();
    await caso.ejecutar(crudo({ userId: USUARIO }));
    expect(unico(guardados).empresaId).toBeNull();
  });

  it('si el resolvedor conoce la empresa de la cuenta, el hecho es de esa empresa', async () => {
    const resolver = vi.fn(async () => EMPRESA);
    const { caso, guardados } = montar(resolver);
    await caso.ejecutar(crudo({ userId: USUARIO }));
    expect(resolver).toHaveBeenCalledWith(USUARIO);
    expect(unico(guardados).empresaId).toBe(EMPRESA);
  });

  it('si el resolvedor no la conoce, o falla, el hecho se registra igualmente como de plataforma', async () => {
    const desconocida = montar(async () => null);
    await desconocida.caso.ejecutar(crudo({ userId: USUARIO }));
    expect(unico(desconocida.guardados).empresaId).toBeNull();

    const rota = montar(async () => {
      throw new Error('base de datos caída');
    });
    expect(await rota.caso.ejecutar(crudo({ userId: USUARIO }))).toBe('registrado');
    expect(unico(rota.guardados).empresaId).toBeNull();
  });

  it('no consulta el resolvedor cuando no hay cuenta', async () => {
    const resolver = vi.fn(async () => EMPRESA);
    const { caso } = montar(resolver);
    await caso.ejecutar(crudo());
    expect(resolver).not.toHaveBeenCalled();
  });
});

describe('RegistrarIntentoFallido: eventos mal formados', () => {
  it.each([null, undefined, 'texto', 42, []])('rechaza algo que no es un objeto: %j', async (v) => {
    await expect(montar().caso.ejecutar(v)).rejects.toThrow(EventoIdentidadInvalidoError);
  });

  it.each([undefined, null, 'ayer', Number.NaN, -1, 0, 1.5, 9e15, Number.POSITIVE_INFINITY])('rechaza un intento fallido sin hora válida: %j', async (time) => {
    const { caso, puerto } = montar();
    await expect(caso.ejecutar(crudo({ time }))).rejects.toThrow(EventoIdentidadInvalidoError);
    expect(puerto.registrarUnaVez).not.toHaveBeenCalled();
  });

  it('el error no repite ningún valor del evento', async () => {
    try {
      await montar().caso.ejecutar(crudo({ time: 'ana.perez@example.test' }));
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).not.toContain('ana.perez');
    }
  });

  it('si la bitácora falla, el error sube (el proceso de sincronización lo reintenta)', async () => {
    const { caso, puerto } = montar();
    vi.mocked(puerto.registrarUnaVez).mockRejectedValueOnce(new Error('sin conexión'));
    await expect(caso.ejecutar(crudo())).rejects.toThrow('sin conexión');
  });
});
