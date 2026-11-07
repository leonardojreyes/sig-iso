import { crearEmpresaId, type EmpresaId } from '@sig/tenancy';
import type { Rol } from '@sig/autorizacion';
import { describe, expect, it, vi } from 'vitest';
import type { DatosEmpresa, DatosPersona, EmpresaRepositoryPort } from './empresa-repository.port.js';
import { EmpresaNoEncontradaError } from './obtener-marca.use-case.js';
import { ObtenerIdentidadUseCase, PersonaNoEncontradaError, type RolesPort } from './obtener-identidad.use-case.js';

const A = crearEmpresaId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
const B = crearEmpresaId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
const ADMIN_A = '44444444-4444-4444-8444-444444444444';
const COLAB_A = '55555555-5555-4555-8555-555555555555';
const ADMIN_B = '66666666-6666-4666-8666-666666666666';

const empresas: Record<string, DatosEmpresa> = {
  [A]: { id: A, slug: 'empresa-a', nombre: 'Empresa A (prueba)', colorPrimario: '#0b5fff', logoUrl: null },
  [B]: { id: B, slug: 'empresa-b', nombre: 'Empresa B (prueba)', colorPrimario: '#b45309', logoUrl: null },
};
// Personas por empresa: como la RLS, el repositorio solo ve las de la empresa que se le indica.
const personas: Record<string, Record<string, DatosPersona>> = {
  [A]: { [ADMIN_A]: { id: ADMIN_A, nombre: 'Administradora A' }, [COLAB_A]: { id: COLAB_A, nombre: 'Colaborador A' } },
  [B]: { [ADMIN_B]: { id: ADMIN_B, nombre: 'Administrador B' } },
};
const roles: Record<string, Rol[]> = { [`${A}|${ADMIN_A}`]: ['administrador_sig'], [`${A}|${COLAB_A}`]: ['colaborador'], [`${B}|${ADMIN_B}`]: ['administrador_sig'] };

const montar = () => {
  const llamadas: { que: string; empresa: EmpresaId; usuario?: string }[] = [];
  const repo: EmpresaRepositoryPort = {
    obtenerPropia: async (e) => { llamadas.push({ que: 'empresa', empresa: e }); return empresas[e] ?? null; },
    obtenerPersona: async (e, u) => { llamadas.push({ que: 'persona', empresa: e, usuario: u }); return personas[e]?.[u] ?? null; },
  };
  const rolesDe = vi.fn(async (u: string, e: EmpresaId) => roles[`${e}|${u}`] ?? []);
  const port: RolesPort = { rolesDe };
  return { caso: new ObtenerIdentidadUseCase(repo, port), llamadas, rolesDe };
};

describe('ObtenerIdentidad (H1.1: llego a «mi» empresa con su nombre visible)', () => {
  it('devuelve la persona, sus roles y SOLO el nombre y el slug de su empresa', async () => {
    const { caso } = montar();
    expect(await caso.ejecutar({ empresaId: A, usuarioId: ADMIN_A })).toEqual({
      usuarioId: ADMIN_A, nombre: 'Administradora A', roles: ['administrador_sig'], empresa: { slug: 'empresa-a', nombre: 'Empresa A (prueba)' },
    });
  });

  it('un colaborador recibe su propio rol', async () => {
    expect((await montar().caso.ejecutar({ empresaId: A, usuarioId: COLAB_A })).roles).toEqual(['colaborador']);
  });

  it('la respuesta no expone el identificador interno de la empresa ni el color', async () => {
    const texto = JSON.stringify(await montar().caso.ejecutar({ empresaId: A, usuarioId: ADMIN_A }));
    expect(texto).not.toContain(A);
    expect(texto).not.toContain('0b5fff');
  });

  it('las personas de A y de B ven cada una su empresa', async () => {
    const { caso } = montar();
    expect((await caso.ejecutar({ empresaId: B, usuarioId: ADMIN_B })).empresa).toEqual({ slug: 'empresa-b', nombre: 'Empresa B (prueba)' });
  });

  it('pide a los repositorios y a los roles únicamente la empresa y la persona recibidas', async () => {
    const { caso, llamadas, rolesDe } = montar();
    await caso.ejecutar({ empresaId: A, usuarioId: ADMIN_A });
    expect(llamadas.every((l) => l.empresa === A)).toBe(true);
    expect(llamadas.filter((l) => l.que === 'persona').map((l) => l.usuario)).toEqual([ADMIN_A]);
    expect(rolesDe).toHaveBeenCalledWith(ADMIN_A, A);
  });
});

describe('ObtenerIdentidad — cuentas que ya no valen (401)', () => {
  it('una persona de OTRA empresa no existe en esta: PersonaNoEncontradaError', async () => {
    await expect(montar().caso.ejecutar({ empresaId: A, usuarioId: ADMIN_B })).rejects.toBeInstanceOf(PersonaNoEncontradaError);
  });

  it('una persona sin ningún rol en la empresa (cuenta desactivada) también', async () => {
    const { caso } = montar();
    const sinRoles = new ObtenerIdentidadUseCase(
      { obtenerPropia: async (e) => empresas[e] ?? null, obtenerPersona: async (e, u) => personas[e]?.[u] ?? null },
      { rolesDe: async () => [] },
    );
    await expect(sinRoles.ejecutar({ empresaId: A, usuarioId: ADMIN_A })).rejects.toBeInstanceOf(PersonaNoEncontradaError);
    expect(caso).toBeDefined();
  });

  it('una empresa sin fila da EmpresaNoEncontradaError', async () => {
    const { caso } = montar();
    await expect(caso.ejecutar({ empresaId: crearEmpresaId('cccccccc-cccc-4ccc-8ccc-cccccccccccc'), usuarioId: ADMIN_A })).rejects.toBeInstanceOf(EmpresaNoEncontradaError);
  });

  it('un repositorio que devolviera datos de otra empresa o persona se rechaza (defensa en profundidad)', async () => {
    const cruzado = new ObtenerIdentidadUseCase(
      { obtenerPropia: async () => empresas[B]!, obtenerPersona: async () => personas[A]![ADMIN_A]! },
      { rolesDe: async () => ['administrador_sig'] },
    );
    await expect(cruzado.ejecutar({ empresaId: A, usuarioId: ADMIN_A })).rejects.toBeInstanceOf(EmpresaNoEncontradaError);
    const personaCruzada = new ObtenerIdentidadUseCase(
      { obtenerPropia: async (e) => empresas[e] ?? null, obtenerPersona: async () => personas[B]![ADMIN_B]! },
      { rolesDe: async () => ['administrador_sig'] },
    );
    await expect(personaCruzada.ejecutar({ empresaId: A, usuarioId: ADMIN_A })).rejects.toBeInstanceOf(PersonaNoEncontradaError);
  });

  it('los errores no repiten identificadores', async () => {
    let mensaje = '';
    try {
      await montar().caso.ejecutar({ empresaId: A, usuarioId: ADMIN_B });
    } catch (e) {
      mensaje = (e as Error).message;
    }
    expect(mensaje).not.toBe('');
    expect(mensaje).not.toContain(ADMIN_B);
    expect(mensaje).not.toContain(A);
  });
});

describe('ObtenerIdentidad — entradas y fallos', () => {
  it.each(['', 'no-uuid', '00000000-0000-0000-0000-000000000000', undefined, 7])('un usuarioId inválido (%j) falla antes de consultar', async (u) => {
    const { caso, llamadas } = montar();
    await expect(caso.ejecutar({ empresaId: A, usuarioId: u as never })).rejects.toThrow();
    expect(llamadas).toEqual([]);
  });

  it('una empresa inválida falla antes de consultar', async () => {
    const { caso, llamadas } = montar();
    await expect(caso.ejecutar({ empresaId: 'x' as never, usuarioId: ADMIN_A })).rejects.toThrow();
    expect(llamadas).toEqual([]);
  });

  it('si el servicio de roles falla, el error se propaga (no se inventan roles)', async () => {
    const roto = new ObtenerIdentidadUseCase(
      { obtenerPropia: async (e) => empresas[e] ?? null, obtenerPersona: async (e, u) => personas[e]?.[u] ?? null },
      { rolesDe: async () => { throw new Error('OpenFGA caído'); } },
    );
    await expect(roto.ejecutar({ empresaId: A, usuarioId: ADMIN_A })).rejects.toThrow('OpenFGA caído');
  });

  it('si falla el repositorio, el error se propaga', async () => {
    const roto = new ObtenerIdentidadUseCase(
      { obtenerPropia: async () => { throw new Error('base caída'); }, obtenerPersona: async () => null },
      { rolesDe: async () => ['colaborador'] },
    );
    await expect(roto.ejecutar({ empresaId: A, usuarioId: ADMIN_A })).rejects.toThrow('base caída');
  });
});
