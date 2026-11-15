import type { EventoBitacora } from '@sig/auditoria';
import { crearEmpresaId, type EmpresaId } from '@sig/tenancy';
import { describe, expect, it } from 'vitest';
import { ActualizarMarcaUseCase, MarcaNoValidaError, SinPermisoMarcaError } from './actualizar-marca.use-case.js';
import type { DatosEmpresa } from './empresa-repository.port.js';
import type { ContextoMarca } from './marca-repository.port.js';
import { EmpresaNoEncontradaError } from './obtener-marca.use-case.js';

const A = crearEmpresaId('a5eed000-0000-4000-8000-00000000000a');
const B = crearEmpresaId('b5eed000-0000-4000-8000-00000000000b');
const ADMIN = '5eed0001-0000-4000-8000-0000000000a1';
const COLAB = '5eed0002-0000-4000-8000-0000000000a2';

const montar = () => {
  const empresas = new Map<string, DatosEmpresa>([
    [A, { id: A, slug: 'empresa-a', nombre: 'Empresa A (prueba)', colorPrimario: '#0b5fff', logoUrl: null }],
    [B, { id: B, slug: 'empresa-b', nombre: 'Empresa B (prueba)', colorPrimario: '#b45309', logoUrl: null }],
  ]);
  let eventos: EventoBitacora[] = [];
  const f = { fallaBitacora: false, leeOtra: false };
  const permisos = { puede: async (u: string) => u === ADMIN };
  const unidad = {
    ejecutar: async <T>(empresaId: EmpresaId, fn: (c: ContextoMarca) => Promise<T>): Promise<T> => {
      const copia = new Map(empresas);
      const copiaEv = [...eventos];
      const ctx: ContextoMarca = {
        marcas: {
          // Como la RLS: solo la fila de la empresa de la unidad (salvo `leeOtra`, que simula un repositorio SIN aislamiento).
          obtener: async () => empresas.get(f.leeOtra ? B : empresaId) ?? null,
          actualizar: async (c) => {
            const e = empresas.get(empresaId)!;
            empresas.set(empresaId, { ...e, colorPrimario: c.colorPrimario, logoUrl: c.logoUrl });
          },
        },
        bitacora: {
          registrar: async (e) => {
            if (f.fallaBitacora) throw new Error('bitácora caída');
            if (e.empresaId !== empresaId) throw new Error('RLS: el registro no es de la empresa del contexto');
            eventos.push(e);
          },
        },
      };
      try {
        return await fn(ctx);
      } catch (error) {
        empresas.clear();
        for (const [k, v] of copia) empresas.set(k, v);
        eventos = copiaEv;
        throw error;
      }
    },
  };
  return { empresas, f, eventos: () => eventos, caso: new ActualizarMarcaUseCase(unidad, permisos) };
};

describe('ActualizarMarcaUseCase', () => {
  it('cambia el color y el logo, y deja UN hecho que dice qué cambió (sin el color ni la dirección)', async () => {
    const { caso, empresas, eventos } = montar();
    const m = await caso.ejecutar({ empresaId: A, usuarioId: ADMIN, colorPrimario: '#0E5C42', logoUrl: 'https://cdn.example.test/a.png' });
    expect(m).toMatchObject({ nombre: 'Empresa A (prueba)', colorOriginal: '#0e5c42', logoUrl: 'https://cdn.example.test/a.png' });
    expect(empresas.get(A)).toMatchObject({ colorPrimario: '#0e5c42', logoUrl: 'https://cdn.example.test/a.png' });
    expect(eventos()).toEqual([{ empresaId: A, actor: { tipo: 'usuario', usuarioId: ADMIN }, accion: 'marca.cambiada', resultado: 'ok', objeto: 'empresa:empresa-a', despues: { color_cambiado: true, logo_cambiado: true } }]);
    expect(JSON.stringify(eventos())).not.toContain('0e5c42');
    expect(JSON.stringify(eventos())).not.toContain('cdn.example');
  });

  it('el hecho distingue lo que cambió: solo el color, o solo el logo', async () => {
    const { caso, eventos } = montar();
    await caso.ejecutar({ empresaId: A, usuarioId: ADMIN, colorPrimario: '#112233', logoUrl: null });
    await caso.ejecutar({ empresaId: A, usuarioId: ADMIN, colorPrimario: '#112233', logoUrl: '/logos/a.png' });
    expect(eventos().map((e) => e.despues)).toEqual([{ color_cambiado: true, logo_cambiado: false }, { color_cambiado: false, logo_cambiado: true }]);
  });

  it('si no cambia nada, responde la marca vigente y NO registra ningún hecho', async () => {
    const { caso, eventos } = montar();
    const m = await caso.ejecutar({ empresaId: A, usuarioId: ADMIN, colorPrimario: '#0B5FFF', logoUrl: null });
    expect(m.colorOriginal).toBe('#0b5fff');
    expect(eventos()).toEqual([]);
  });

  it('un color que no cumple el contraste se guarda tal cual y se APLICA ajustado (y se avisa)', async () => {
    const { caso, empresas } = montar();
    const m = await caso.ejecutar({ empresaId: A, usuarioId: ADMIN, colorPrimario: '#ffe066', logoUrl: null });
    expect(m.ajustadoPorContraste).toBe(true);
    expect(m.colorOriginal).toBe('#ffe066');
    expect(m.colorPrimario).not.toBe('#ffe066');
    expect(empresas.get(A)!.colorPrimario).toBe('#ffe066');
  });

  it('sin permiso lanza SinPermisoMarcaError ANTES de validar o tocar nada', async () => {
    const { caso, empresas, eventos } = montar();
    await expect(caso.ejecutar({ empresaId: A, usuarioId: COLAB, colorPrimario: 'basura', logoUrl: 7 })).rejects.toBeInstanceOf(SinPermisoMarcaError);
    expect(empresas.get(A)!.colorPrimario).toBe('#0b5fff');
    expect(eventos()).toEqual([]);
  });

  it.each([
    ['un color mal formado', 'rojo', null],
    ['un logo con http', '#112233', 'http://inseguro.example.test/x.png'],
    ['un logo con javascript:', '#112233', 'javascript:alert(1)'],
    ['un logo que no es texto', '#112233', 42],
  ])('rechaza %s con MarcaNoValidaError y no cambia nada', async (_n, color, logo) => {
    const { caso, empresas, eventos } = montar();
    await expect(caso.ejecutar({ empresaId: A, usuarioId: ADMIN, colorPrimario: color, logoUrl: logo })).rejects.toBeInstanceOf(MarcaNoValidaError);
    expect(empresas.get(A)).toMatchObject({ colorPrimario: '#0b5fff', logoUrl: null });
    expect(eventos()).toEqual([]);
  });

  it('solo cambia la empresa del contexto: la de B no se toca', async () => {
    const { caso, empresas } = montar();
    await caso.ejecutar({ empresaId: A, usuarioId: ADMIN, colorPrimario: '#112233', logoUrl: null });
    expect(empresas.get(B)).toMatchObject({ colorPrimario: '#b45309', logoUrl: null });
  });

  it('si un repositorio no aislara y devolviera la fila de otra empresa, no se cambia ni se arma nada', async () => {
    const { caso, f, empresas } = montar();
    f.leeOtra = true;
    await expect(caso.ejecutar({ empresaId: A, usuarioId: ADMIN, colorPrimario: '#112233', logoUrl: null })).rejects.toBeInstanceOf(EmpresaNoEncontradaError);
    expect(empresas.get(A)!.colorPrimario).toBe('#0b5fff');
  });

  it('si la bitácora falla, el cambio se revierte (todo o nada)', async () => {
    const { caso, f, empresas, eventos } = montar();
    f.fallaBitacora = true;
    await expect(caso.ejecutar({ empresaId: A, usuarioId: ADMIN, colorPrimario: '#112233', logoUrl: null })).rejects.toThrow('bitácora caída');
    expect(empresas.get(A)!.colorPrimario).toBe('#0b5fff');
    expect(eventos()).toEqual([]);
  });

  it('rechaza una persona mal formada', async () => {
    await expect(montar().caso.ejecutar({ empresaId: A, usuarioId: 'no-uuid', colorPrimario: '#112233', logoUrl: null })).rejects.toThrow();
  });
});
