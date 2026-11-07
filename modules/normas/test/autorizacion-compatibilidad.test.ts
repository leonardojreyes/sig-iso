import { AutorizacionFake } from '@sig/autorizacion';
import { describe, expect, it } from 'vitest';
import type { AutorizacionPort } from '../src/index.js';

// El puerto de autorización de platform debe servir donde el módulo pide el suyo. Si divergen, `pnpm typecheck` falla aquí.
describe('AutorizacionFake implementa el AutorizacionPort de normas', () => {
  it('encaja por tipos', () => {
    const puerto: AutorizacionPort = new AutorizacionFake();
    expect(typeof puerto.puede).toBe('function');
  });
});
