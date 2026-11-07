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

  it('mientras no exista el adaptador de OpenFGA (tarea 9.3), la autorización NO responde «sí» ni inventa roles', async () => {
    const { autorizacion } = componerDesdeEntorno({});
    await expect(autorizacion.puede(U, 'librerias.adoptar', A as never)).rejects.toThrow(/autorizaci/i);
    await expect(autorizacion.rolesDe(U, A as never)).rejects.toThrow(/autorizaci/i);
  });

  it('adoptar una librería sin autorización configurada falla cerrado: no adopta y no revela si la librería existe', async () => {
    const { normas } = componerDesdeEntorno({});
    await expect(normas.adoptar.ejecutar({ empresaId: A as never, usuarioId: U, libreriaId: '11111111-1111-4111-8111-111111111111' })).rejects.toThrow(/autorizaci/i);
  });

  it('una configuración inválida de autenticación impide arrancar, nombrando la variable', () => {
    expect(() => componerDesdeEntorno({ OIDC_ISSUER_URL: 'no-es-url' })).toThrow(/OIDC_ISSUER_URL/);
  });
});
