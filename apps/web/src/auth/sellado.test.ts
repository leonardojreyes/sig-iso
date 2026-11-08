// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { CompactEncrypt } from 'jose';
import { describe, expect, it } from 'vitest';
import { seCreaClave, sellar, TransaccionInvalidaError, abrirSello } from './sellado';

const clave = () => randomBytes(32).toString('base64url');
const AHORA = new Date('2026-11-08T10:00:00Z');
const carga = { s: 'state', n: 'nonce', v: 'verificador', r: '/panel' };

describe('sellado de la cookie de la transacción (JWE dir + A256GCM)', () => {
  it('ida y vuelta con la clave activa', async () => {
    const k = clave();
    const sello = await sellar(carga, { claves: [{ id: 'k1', secreto: k }], vigenciaSegundos: 300, ahora: AHORA });
    expect(await abrirSello(sello, { claves: [{ id: 'k1', secreto: k }], ahora: AHORA })).toEqual(carga);
  });

  it('el sello es opaco: no contiene la carga en claro', async () => {
    const sello = await sellar(carga, {
      claves: [{ id: 'k1', secreto: clave() }],
      vigenciaSegundos: 300,
      ahora: AHORA,
    });
    expect(sello).not.toContain('verificador');
    expect(Buffer.from(sello.split('.')[0]!, 'base64url').toString()).not.toContain('verificador');
    expect(sello.split('.')).toHaveLength(5);
  });

  it('con otra clave no se abre', async () => {
    const sello = await sellar(carga, {
      claves: [{ id: 'k1', secreto: clave() }],
      vigenciaSegundos: 300,
      ahora: AHORA,
    });
    await expect(abrirSello(sello, { claves: [{ id: 'k1', secreto: clave() }], ahora: AHORA })).rejects.toBeInstanceOf(
      TransaccionInvalidaError,
    );
  });

  it('rotación: sella con la primera clave y abre también con las anteriores por su identificador', async () => {
    const vieja = { id: 'vieja', secreto: clave() };
    const nueva = { id: 'nueva', secreto: clave() };
    const selloViejo = await sellar(carga, { claves: [vieja], vigenciaSegundos: 300, ahora: AHORA });
    expect(await abrirSello(selloViejo, { claves: [nueva, vieja], ahora: AHORA })).toEqual(carga);
    const selloNuevo = await sellar(carga, { claves: [nueva, vieja], vigenciaSegundos: 300, ahora: AHORA });
    await expect(abrirSello(selloNuevo, { claves: [vieja], ahora: AHORA })).rejects.toBeInstanceOf(
      TransaccionInvalidaError,
    );
  });

  it('vence a los 300 s (y no antes)', async () => {
    const k = [{ id: 'k1', secreto: clave() }];
    const sello = await sellar(carga, { claves: k, vigenciaSegundos: 300, ahora: AHORA });
    expect(await abrirSello(sello, { claves: k, ahora: new Date(AHORA.getTime() + 299_000) })).toEqual(carga);
    await expect(abrirSello(sello, { claves: k, ahora: new Date(AHORA.getTime() + 301_000) })).rejects.toThrow(
      /vencid/i,
    );
  });

  it('un sello sin vencimiento, alterado o que no es un JWE se rechaza', async () => {
    const k = [{ id: 'k1', secreto: clave() }];
    const sello = await sellar(carga, { claves: k, vigenciaSegundos: 300, ahora: AHORA });
    const alterado = `${sello.slice(0, -4)}AAAA`;
    for (const malo of ['', 'abc', 'a.b.c', alterado, `${sello}x`]) {
      await expect(abrirSello(malo, { claves: k, ahora: AHORA }), malo).rejects.toBeInstanceOf(
        TransaccionInvalidaError,
      );
    }
    const bytes = Buffer.from(k[0]!.secreto, 'base64url');
    const sinExp = await new CompactEncrypt(new TextEncoder().encode(JSON.stringify(carga)))
      .setProtectedHeader({ alg: 'dir', enc: 'A256GCM', kid: 'k1' })
      .encrypt(bytes);
    await expect(abrirSello(sinExp, { claves: k, ahora: AHORA })).rejects.toBeInstanceOf(TransaccionInvalidaError);
  });

  it('rechaza un algoritmo distinto de dir + A256GCM', async () => {
    const k = [{ id: 'k1', secreto: clave() }];
    const bytes = Buffer.from(k[0]!.secreto, 'base64url');
    const otro = await new CompactEncrypt(
      new TextEncoder().encode(JSON.stringify({ ...carga, exp: Math.floor(AHORA.getTime() / 1000) + 100 })),
    )
      .setProtectedHeader({ alg: 'dir', enc: 'A128GCM', kid: 'k1' })
      .encrypt(bytes.subarray(0, 16));
    await expect(abrirSello(otro, { claves: k, ahora: AHORA })).rejects.toBeInstanceOf(TransaccionInvalidaError);
  });

  it('rechaza otro algoritmo de cifrado aunque la clave de 32 bytes sirva (A128CBC-HS256)', async () => {
    const k = [{ id: 'k1', secreto: clave() }];
    const bytes = Buffer.from(k[0]!.secreto, 'base64url');
    const otro = await new CompactEncrypt(
      new TextEncoder().encode(JSON.stringify({ ...carga, exp: Math.floor(AHORA.getTime() / 1000) + 100 })),
    )
      .setProtectedHeader({ alg: 'dir', enc: 'A128CBC-HS256', kid: 'k1' })
      .encrypt(bytes);
    await expect(abrirSello(otro, { claves: k, ahora: AHORA })).rejects.toBeInstanceOf(TransaccionInvalidaError);
  });

  it('la clave debe ser de 32 bytes en base64url; si no, no se usa', async () => {
    expect(seCreaClave(randomBytes(32).toString('base64url'))).toBe(true);
    for (const mala of [
      '',
      'corta',
      randomBytes(16).toString('base64url'),
      randomBytes(33).toString('base64url'),
      '!!!!'.repeat(11),
    ]) {
      expect(seCreaClave(mala), mala).toBe(false);
      await expect(
        sellar(carga, { claves: [{ id: 'k1', secreto: mala }], vigenciaSegundos: 300, ahora: AHORA }),
      ).rejects.toThrow(/clave/i);
    }
    await expect(sellar(carga, { claves: [], vigenciaSegundos: 300, ahora: AHORA })).rejects.toThrow(/clave/i);
  });
});
