// Utilidades compartidas por los hooks (Node, multiplataforma).
import { readFileSync } from 'node:fs';

export const leerEntrada = () => {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
};

/** Bloquea la acción: stderr vuelve a Claude y exit 2 cancela la herramienta. */
export const bloquear = (motivo) => {
  process.stderr.write(`BLOQUEADO por hook: ${motivo}\n`);
  process.exit(2);
};

export const normalizar = (ruta = '') => ruta.replaceAll('\\', '/');
