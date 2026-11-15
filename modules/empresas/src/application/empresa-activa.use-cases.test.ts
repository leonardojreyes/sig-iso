import { crearEmpresaId, type EmpresaId } from '@sig/tenancy';
import { describe, expect, it } from 'vitest';
import type { EventoBitacora } from '@sig/auditoria';
import type { EmpresaActivaPort, EmpresaDePersona } from './empresa-activa.port.js';
import {
  CambiarEmpresaUseCase,
  EmpresaAjenaError,
  EmpresaPedidaInvalidaError,
  ListarMisEmpresasUseCase,
  OlvidarEmpresaActivaUseCase,
  ResolverEmpresaActivaUseCase,
  VIDA_EMPRESA_ACTIVA_MS,
} from './empresa-activa.use-cases.js';

const A = crearEmpresaId('a5eed000-0000-4000-8000-00000000000a');
const B = crearEmpresaId('b5eed000-0000-4000-8000-00000000000b');
const C = crearEmpresaId('c5eed000-0000-4000-8000-00000000000c');
const U = '5eed0005-0000-4000-8000-0000000000c1';
const OTRO = '5eed0001-0000-4000-8000-0000000000a1';
const SID = 'sesion-kc-1';
const AHORA = new Date('2026-11-15T10:00:00Z');

class Puerto implements EmpresaActivaPort {
  pertenencias = new Map<string, EmpresaDePersona[]>();
  activas = new Map<string, { usuario: string; empresa: EmpresaId; expira: Date }>();
  falla: string | null = null;
  async activaDe(sid: string, usuario: string, ahora: Date) {
    if (this.falla === 'activaDe') throw new Error('base caída');
    const a = this.activas.get(sid);
    if (!a || a.usuario !== usuario || a.expira <= ahora) return null;
    // Como la base: solo vale si la persona SIGUE perteneciendo a esa empresa.
    return (this.pertenencias.get(usuario) ?? []).some((e) => e.empresaId === a.empresa) ? a.empresa : null;
  }
  async empresasDe(usuario: string) {
    return this.pertenencias.get(usuario) ?? [];
  }
  async fijar(sid: string, usuario: string, empresa: EmpresaId, _ahora: Date, expira: Date) {
    if (this.falla === 'fijar') throw new Error('base caída');
    this.activas.set(sid, { usuario, empresa, expira });
  }
  async limpiar(sid: string) {
    this.activas.delete(sid);
  }
}

const montar = () => {
  const puerto = new Puerto();
  puerto.pertenencias.set(U, [
    { empresaId: A, slug: 'empresa-a', nombre: 'Empresa A (prueba)' },
    { empresaId: B, slug: 'empresa-b', nombre: 'Empresa B (prueba)' },
  ]);
  puerto.pertenencias.set(OTRO, [{ empresaId: A, slug: 'empresa-a', nombre: 'Empresa A (prueba)' }]);
  const eventos: EventoBitacora[] = [];
  const hechos = {
    falla: false,
    registrar: async (e: EventoBitacora) => {
      if (hechos.falla) throw new Error('bitácora caída');
      eventos.push(e);
    },
  };
  return { puerto, eventos, hechos, cambiar: new CambiarEmpresaUseCase(puerto, hechos, () => AHORA) };
};

describe('ResolverEmpresaActivaUseCase', () => {
  it('sin empresa activa manda la del token', async () => {
    const { puerto } = montar();
    expect(await new ResolverEmpresaActivaUseCase(puerto).ejecutar({ usuarioId: U, sesionId: SID, empresaDelToken: A, ahora: AHORA })).toBe(A);
  });
  it('con una empresa activa vigente manda esa', async () => {
    const { puerto } = montar();
    puerto.activas.set(SID, { usuario: U, empresa: B, expira: new Date(AHORA.getTime() + 1000) });
    expect(await new ResolverEmpresaActivaUseCase(puerto).ejecutar({ usuarioId: U, sesionId: SID, empresaDelToken: A, ahora: AHORA })).toBe(B);
  });
  it('si venció o la persona ya no pertenece a esa empresa, vuelve a la del token', async () => {
    const { puerto } = montar();
    const r = new ResolverEmpresaActivaUseCase(puerto);
    puerto.activas.set(SID, { usuario: U, empresa: B, expira: new Date(AHORA.getTime() - 1) });
    expect(await r.ejecutar({ usuarioId: U, sesionId: SID, empresaDelToken: A, ahora: AHORA })).toBe(A);
    puerto.activas.set(SID, { usuario: U, empresa: B, expira: new Date(AHORA.getTime() + 1000) });
    puerto.pertenencias.set(U, [{ empresaId: A, slug: 'empresa-a', nombre: 'A' }]); // se le quitó B
    expect(await r.ejecutar({ usuarioId: U, sesionId: SID, empresaDelToken: A, ahora: AHORA })).toBe(A);
  });
  it('la elección de una sesión no vale para otra persona ni para otra sesión', async () => {
    const { puerto } = montar();
    puerto.activas.set(SID, { usuario: U, empresa: B, expira: new Date(AHORA.getTime() + 1000) });
    const r = new ResolverEmpresaActivaUseCase(puerto);
    expect(await r.ejecutar({ usuarioId: OTRO, sesionId: SID, empresaDelToken: A, ahora: AHORA })).toBe(A);
    expect(await r.ejecutar({ usuarioId: U, sesionId: 'otra-sesion', empresaDelToken: A, ahora: AHORA })).toBe(A);
  });
  it('sin identificador de sesión manda el token, sin consultar', async () => {
    const { puerto } = montar();
    puerto.falla = 'activaDe';
    expect(await new ResolverEmpresaActivaUseCase(puerto).ejecutar({ usuarioId: U, sesionId: null, empresaDelToken: A, ahora: AHORA })).toBe(A);
  });
  it('si la base falla, el error sale (no se cae a «la del token» en silencio)', async () => {
    const { puerto } = montar();
    puerto.falla = 'activaDe';
    await expect(new ResolverEmpresaActivaUseCase(puerto).ejecutar({ usuarioId: U, sesionId: SID, empresaDelToken: A, ahora: AHORA })).rejects.toThrow('base caída');
  });
});

describe('ListarMisEmpresasUseCase', () => {
  it('lista las empresas de la persona, marcando la actual, sin exponer identificadores', async () => {
    const { puerto } = montar();
    const r = await new ListarMisEmpresasUseCase(puerto).ejecutar({ usuarioId: U, empresaActual: B });
    expect(r).toEqual([
      { slug: 'empresa-a', nombre: 'Empresa A (prueba)', activa: false },
      { slug: 'empresa-b', nombre: 'Empresa B (prueba)', activa: true },
    ]);
  });
  it('una persona con una sola empresa ve solo esa', async () => {
    const { puerto } = montar();
    expect(await new ListarMisEmpresasUseCase(puerto).ejecutar({ usuarioId: OTRO, empresaActual: A })).toEqual([{ slug: 'empresa-a', nombre: 'Empresa A (prueba)', activa: true }]);
  });
  it('una persona sin empresas ve una lista vacía', async () => {
    expect(await new ListarMisEmpresasUseCase(montar().puerto).ejecutar({ usuarioId: '5eed0099-0000-4000-8000-000000000099', empresaActual: A })).toEqual([]);
  });
});

describe('CambiarEmpresaUseCase', () => {
  it('cambia a una empresa a la que pertenece: deja el hecho en la empresa DESTINO y guarda la elección con su vencimiento', async () => {
    const { cambiar, puerto, eventos } = montar();
    expect(await cambiar.ejecutar({ usuarioId: U, sesionId: SID, slug: 'empresa-b' })).toEqual({ slug: 'empresa-b', nombre: 'Empresa B (prueba)' });
    expect(eventos).toEqual([{ empresaId: B, actor: { tipo: 'usuario', usuarioId: U }, accion: 'empresa.cambiada', resultado: 'ok', objeto: 'empresa:empresa-b' }]);
    expect(puerto.activas.get(SID)).toEqual({ usuario: U, empresa: B, expira: new Date(AHORA.getTime() + VIDA_EMPRESA_ACTIVA_MS) });
  });

  it('una empresa a la que NO pertenece (aunque exista) es «ajena»: nada se guarda ni se registra', async () => {
    const { cambiar, puerto, eventos } = montar();
    puerto.pertenencias.set('5eed0099-0000-4000-8000-000000000099', [{ empresaId: C, slug: 'empresa-c', nombre: 'C' }]);
    await expect(cambiar.ejecutar({ usuarioId: OTRO, sesionId: SID, slug: 'empresa-b' })).rejects.toBeInstanceOf(EmpresaAjenaError);
    await expect(cambiar.ejecutar({ usuarioId: U, sesionId: SID, slug: 'empresa-c' })).rejects.toBeInstanceOf(EmpresaAjenaError);
    await expect(cambiar.ejecutar({ usuarioId: U, sesionId: SID, slug: 'no-existe' })).rejects.toBeInstanceOf(EmpresaAjenaError);
    expect(puerto.activas.size).toBe(0);
    expect(eventos).toEqual([]);
  });

  it.each([[undefined], [null], [''], [42], [{ slug: 'x' }], [['empresa-b']], ['EMPRESA-B'], ['empresa b'], ['a'.repeat(33)], ["empresa-b' or '1'='1"], ['../empresa-b']])('un dato mal formado (%j) es 400 y no consulta nada', async (slug) => {
    const { cambiar, puerto, eventos } = montar();
    await expect(cambiar.ejecutar({ usuarioId: U, sesionId: SID, slug })).rejects.toBeInstanceOf(EmpresaPedidaInvalidaError);
    expect(puerto.activas.size).toBe(0);
    expect(eventos).toEqual([]);
  });

  it('sin identificador de sesión no se puede cambiar', async () => {
    const { cambiar, puerto } = montar();
    await expect(cambiar.ejecutar({ usuarioId: U, sesionId: null, slug: 'empresa-b' })).rejects.toThrow(/sesión/);
    expect(puerto.activas.size).toBe(0);
  });

  it('si no se puede registrar el hecho, NO se cambia (falla cerrada)', async () => {
    const { cambiar, puerto, hechos } = montar();
    hechos.falla = true;
    await expect(cambiar.ejecutar({ usuarioId: U, sesionId: SID, slug: 'empresa-b' })).rejects.toThrow('bitácora caída');
    expect(puerto.activas.size).toBe(0);
  });

  it('si no se puede guardar, el error sale', async () => {
    const { cambiar, puerto } = montar();
    puerto.falla = 'fijar';
    await expect(cambiar.ejecutar({ usuarioId: U, sesionId: SID, slug: 'empresa-b' })).rejects.toThrow('base caída');
  });

  it('volver a la empresa de origen también es un cambio explícito', async () => {
    const { cambiar, puerto } = montar();
    await cambiar.ejecutar({ usuarioId: U, sesionId: SID, slug: 'empresa-b' });
    await cambiar.ejecutar({ usuarioId: U, sesionId: SID, slug: 'empresa-a' });
    expect(puerto.activas.get(SID)?.empresa).toBe(A);
  });
});

describe('OlvidarEmpresaActivaUseCase', () => {
  it('al cerrar la sesión se olvida la elección; sin sesión no hace nada', async () => {
    const { puerto } = montar();
    puerto.activas.set(SID, { usuario: U, empresa: B, expira: new Date(AHORA.getTime() + 1000) });
    const olvidar = new OlvidarEmpresaActivaUseCase(puerto);
    await olvidar.ejecutar(null);
    expect(puerto.activas.size).toBe(1);
    await olvidar.ejecutar(SID);
    expect(puerto.activas.size).toBe(0);
  });
});
