import { describe, expect, it } from 'vitest';
import { empresaActual, empresaActualOpcional, ejecutarConEmpresa } from './contexto';
import { crearEmpresaId } from './empresa-id';
import { SinEmpresaError } from './errores';

const A = crearEmpresaId('3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c');
const B = crearEmpresaId('0190a5b2-7c3e-7a1d-9f40-123456789abc');
const pausa = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('contexto de empresa', () => {
  it('fuera de un contexto, empresaActual lanza SinEmpresaError', () => {
    expect(() => empresaActual()).toThrow(SinEmpresaError);
    expect(empresaActualOpcional()).toBeUndefined();
  });

  it('dentro de un contexto devuelve la empresa y devuelve el resultado de la función', async () => {
    const r = await ejecutarConEmpresa(A, async () => {
      await pausa(1);
      return empresaActual();
    });
    expect(r).toBe(A);
  });

  it('también funciona con funciones síncronas', () => {
    expect(ejecutarConEmpresa(A, () => empresaActual())).toBe(A);
  });

  it('el contexto no se filtra al terminar', async () => {
    await ejecutarConEmpresa(A, async () => pausa(1));
    expect(empresaActualOpcional()).toBeUndefined();
  });

  it('dos ejecuciones concurrentes no comparten empresa', async () => {
    const vistas: string[] = [];
    const tarea = (id: typeof A, retardo: number) =>
      ejecutarConEmpresa(id, async () => {
        await pausa(retardo);
        vistas.push(`${id}:${empresaActual()}`);
        await pausa(retardo);
        return empresaActual();
      });
    const [ra, rb] = await Promise.all([tarea(A, 5), tarea(B, 2)]);
    expect(ra).toBe(A);
    expect(rb).toBe(B);
    for (const v of vistas) {
      const [esperada, vista] = [v.slice(0, 36), v.slice(37)];
      expect(vista).toBe(esperada);
    }
  });

  it('un contexto anidado reemplaza al externo y lo restaura al salir', async () => {
    await ejecutarConEmpresa(A, async () => {
      await ejecutarConEmpresa(B, async () => {
        expect(empresaActual()).toBe(B);
      });
      expect(empresaActual()).toBe(A);
    });
  });

  it('propaga los errores y deja limpio el contexto', async () => {
    await expect(
      ejecutarConEmpresa(A, async () => {
        throw new Error('falla');
      }),
    ).rejects.toThrow('falla');
    expect(empresaActualOpcional()).toBeUndefined();
  });
});
