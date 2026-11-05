import { crearEmpresaId, EmpresaIdInvalidoError } from '@sig/tenancy';
import { describe, expect, it } from 'vitest';
import { conTenant } from './con-tenant';

const A = crearEmpresaId('3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c');

// Sin base de datos: estas validaciones ocurren antes de tocar la conexión.
describe('conTenant (validaciones, sin conexión)', () => {
  it.each(['', 'empresa-a', "x'; select 1 --", '00000000-0000-0000-0000-000000000000'])('rechaza un identificador que no es EmpresaId válido: "%s"', async (malo) => {
    await expect(conTenant({} as never, malo as never, async () => 1)).rejects.toThrow(EmpresaIdInvalidoError);
  });

  it('rechaza anidarse dentro de otra transacción (no se puede cambiar de empresa a mitad)', async () => {
    await expect(conTenant({ isTransaction: true } as never, A, async () => 1)).rejects.toThrow(/anidar/);
  });
});
