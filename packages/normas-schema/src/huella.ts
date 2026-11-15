// Huella de una librería (ADR 026): SHA-256 del contenido canónico. No depende del formato del archivo ni del orden de las claves,
// pero sí del orden de las entradas. La comparten la carga del catálogo (scripts) y la carga de librerías propias (modules/normas).
import { createHash } from 'node:crypto';

const canonico = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`;
  if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonico(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
};

export const huellaCanonica = (libreria: unknown): string => createHash('sha256').update(canonico(libreria)).digest('hex');
