// Sellado de cookies con JWE `dir` + `A256GCM` y `kid` (ADR 027): la primera clave sella; todas sirven para abrir, así se rota
// sin cerrar sesiones. La carga lleva un vencimiento propio (`exp`) que se comprueba al abrir.
import { CompactEncrypt, compactDecrypt, errors } from 'jose';

export interface ClaveSellado {
  readonly id: string;
  /** 32 bytes en base64url. */
  readonly secreto: string;
}

export class TransaccionInvalidaError extends Error {
  constructor(readonly motivo: 'ilegible' | 'vencida') {
    super(motivo === 'vencida' ? 'El sello está vencido' : 'El sello no es válido');
    this.name = 'TransaccionInvalidaError';
  }
}

const A_BYTES = /^[A-Za-z0-9_-]{43}$/;
export const seCreaClave = (secreto: unknown): boolean =>
  typeof secreto === 'string' && A_BYTES.test(secreto) && Buffer.from(secreto, 'base64url').length === 32;

const bytes = (c: ClaveSellado): Uint8Array => {
  if (!seCreaClave(c.secreto) || !/^[A-Za-z0-9_-]{1,32}$/.test(c.id))
    throw new Error('La clave de sellado no es válida (32 bytes en base64url)');
  return new Uint8Array(Buffer.from(c.secreto, 'base64url'));
};

export const sellar = async (
  carga: Record<string, unknown>,
  opciones: { claves: readonly ClaveSellado[]; vigenciaSegundos: number; ahora: Date },
): Promise<string> => {
  const activa = opciones.claves[0];
  if (!activa) throw new Error('Falta la clave de sellado');
  const exp = Math.floor(opciones.ahora.getTime() / 1000) + opciones.vigenciaSegundos;
  return new CompactEncrypt(new TextEncoder().encode(JSON.stringify({ ...carga, exp })))
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM', kid: activa.id })
    .encrypt(bytes(activa));
};

export const abrirSello = async <T extends Record<string, unknown>>(
  sello: string,
  opciones: { claves: readonly ClaveSellado[]; ahora: Date },
): Promise<T> => {
  if (typeof sello !== 'string' || sello.length === 0 || sello.length > 4096)
    throw new TransaccionInvalidaError('ilegible');
  try {
    const { protectedHeader, plaintext } = await compactDecrypt(
      sello,
      async (cabecera) => {
        const clave = opciones.claves.find((c) => c.id === cabecera.kid);
        if (!clave) throw new errors.JWEDecryptionFailed();
        return bytes(clave);
      },
      { keyManagementAlgorithms: ['dir'], contentEncryptionAlgorithms: ['A256GCM'] },
    );
    if (protectedHeader.alg !== 'dir' || protectedHeader.enc !== 'A256GCM')
      throw new TransaccionInvalidaError('ilegible');
    const { exp, ...carga } = JSON.parse(new TextDecoder().decode(plaintext)) as Record<string, unknown>;
    if (typeof exp !== 'number') throw new TransaccionInvalidaError('ilegible');
    if (Math.floor(opciones.ahora.getTime() / 1000) >= exp) throw new TransaccionInvalidaError('vencida');
    return carga as T;
  } catch (e) {
    if (e instanceof TransaccionInvalidaError) throw e;
    throw new TransaccionInvalidaError('ilegible');
  }
};
