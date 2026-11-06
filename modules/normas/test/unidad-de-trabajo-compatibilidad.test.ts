import { UnidadDeTrabajoKysely } from '@sig/db';
import type { Kysely } from 'kysely';
import { describe, expect, it } from 'vitest';
import type { UnidadDeTrabajoPort } from '../src/index.js';

// El adaptador de platform/db debe poder usarse donde el módulo pide el puerto. Si las firmas se separan, `pnpm typecheck` falla aquí.
interface Ctx { readonly marca: string }

describe('UnidadDeTrabajoKysely implementa UnidadDeTrabajoPort', () => {
  it('encaja por tipos', () => {
    const adaptador = new UnidadDeTrabajoKysely<Ctx>({} as Kysely<unknown>, () => ({ marca: 'x' }));
    const puerto: UnidadDeTrabajoPort<Ctx> = adaptador;
    expect(typeof puerto.ejecutar).toBe('function');
  });
});
