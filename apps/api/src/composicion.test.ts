import { AutorizacionFake } from '@sig/autorizacion';
import { FuncionDeshabilitadaError } from '@sig/normas';
import { describe, expect, it } from 'vitest';
import { componerDesdeEntorno } from './composicion.js';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const U = '44444444-4444-4444-8444-444444444444';

describe('componerDesdeEntorno (producción)', () => {
  it('con el entorno vacío arma todo con los valores por defecto (la API puede arrancar)', () => {
    const c = componerDesdeEntorno({});
    expect(typeof c.autenticacion.verificador.verificar).toBe('function');
    expect(c.negocio.identidades).toBeDefined();
    expect(c.negocio.marcas).toBeDefined();
  });

  it('sin las URLs de la base de datos, registrar un hecho FALLA (nunca pasa en silencio)', async () => {
    const { hechos } = componerDesdeEntorno({});
    const evento = { empresaId: null, actor: { tipo: 'sistema' as const }, accion: 'token.invalido' as const, resultado: 'rechazado' as const, motivo: 'token_alterado' as const };
    await expect(hechos.registrar(evento)).rejects.toThrow();
    await expect(hechos.registrarUnaVez({ ...evento, origenId: 'x:1' })).rejects.toThrow();
  });

  it('sin la base de datos, la identidad y la marca fallan (no devuelven datos por omisión)', async () => {
    const { negocio } = componerDesdeEntorno({});
    await expect(negocio.marcas.ejecutar(A as never)).rejects.toThrow();
    await expect(negocio.identidades.ejecutar({ empresaId: A as never, usuarioId: U })).rejects.toThrow();
  });

  it('sin la base de datos, listar, adoptar y consultar requisitos fallan (no devuelven datos por omisión)', async () => {
    const { normas } = componerDesdeEntorno({});
    await expect(normas.librerias.ejecutar(A as never)).rejects.toThrow();
    await expect(normas.requisitos.ejecutar({ empresaId: A as never })).rejects.toThrow();
    await expect(normas.requisito.ejecutar({ empresaId: A as never, id: '11111111-1111-4111-8111-111111111111' })).rejects.toThrow();
  });

  it('la autorización real consulta la base (ADR 029): sin sus URLs FALLA, nunca responde «sí» ni inventa roles', async () => {
    const { autorizacion } = componerDesdeEntorno({});
    await expect(autorizacion.puede(U, 'librerias.adoptar', A as never)).rejects.toThrow(/DATABASE_URL_APP/);
    await expect(autorizacion.rolesDe(U, A as never)).rejects.toThrow(/DATABASE_URL_APP/);
  });

  it('adoptar una librería sin poder consultar la autorización falla cerrado: no adopta y no revela si la librería existe', async () => {
    const { normas } = componerDesdeEntorno({});
    await expect(normas.adoptar.ejecutar({ empresaId: A as never, usuarioId: U, libreriaId: '11111111-1111-4111-8111-111111111111' })).rejects.toThrow(/DATABASE_URL_APP/);
  });

  it('los límites de frecuencia se leen del entorno y uno inválido impide arrancar, nombrando la variable', () => {
    expect(() => componerDesdeEntorno({ RATE_LIMIT_PERSONA: '30', RATE_LIMIT_EMPRESA: '200' })).not.toThrow();
    expect(componerDesdeEntorno({ RATE_LIMIT_PERSONA: '30', RATE_LIMIT_EMPRESA: '200' }).autenticacion.limites).toEqual({ persona: 30, empresa: 200 });
    expect(componerDesdeEntorno({}).autenticacion.limites).toEqual({ persona: 120, empresa: 600 });
    expect(() => componerDesdeEntorno({ RATE_LIMIT_PERSONA: '0' })).toThrow(/RATE_LIMIT_PERSONA/);
  });

  it('el flag de adopción se lee del entorno: habilitado por defecto, apagable, y un valor inválido impide arrancar', async () => {
    expect(await componerDesdeEntorno({}).flags.habilitado('adopcion-habilitada', A as never)).toBe(true);
    expect(await componerDesdeEntorno({ FEATURE_ADOPCION_HABILITADA: 'false' }).flags.habilitado('adopcion-habilitada', A as never)).toBe(false);
    expect(() => componerDesdeEntorno({ FEATURE_ADOPCION_HABILITADA: 'quizá' })).toThrow(/FEATURE_ADOPCION_HABILITADA/);
  });

  describe('el flag de adopción está conectado a la composición real', () => {
    const LIB = '11111111-1111-4111-8111-111111111111';
    const conAdmin = () => {
      const autorizacion = new AutorizacionFake();
      autorizacion.asignar(A as never, U, 'administrador_sig');
      return autorizacion;
    };

    it('con el flag apagado, un administrador recibe FuncionDeshabilitadaError sin tocar la base de datos', async () => {
      const { normas } = componerDesdeEntorno({ FEATURE_ADOPCION_HABILITADA: 'false' }, { autorizacion: conAdmin() });
      await expect(normas.adoptar.ejecutar({ empresaId: A as never, usuarioId: U, libreriaId: LIB })).rejects.toBeInstanceOf(FuncionDeshabilitadaError);
    });

    it('con el flag encendido sigue adelante (y como no hay base de datos aquí, falla por eso y no por el flag)', async () => {
      const { normas } = componerDesdeEntorno({}, { autorizacion: conAdmin() });
      const error = await normas.adoptar.ejecutar({ empresaId: A as never, usuarioId: U, libreriaId: LIB }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(FuncionDeshabilitadaError);
    });
  });

  it('una configuración inválida de autenticación impide arrancar, nombrando la variable', () => {
    expect(() => componerDesdeEntorno({ OIDC_ISSUER_URL: 'no-es-url' })).toThrow(/OIDC_ISSUER_URL/);
  });
});
