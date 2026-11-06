/** Incumplimiento de una regla del dominio de normas. Lleva el campo y códigos de motivo; nunca repite el valor recibido. */
export class ErrorNormas extends Error {
  constructor(
    readonly campo: string,
    readonly motivos: readonly string[] = [],
  ) {
    super(`Valor no válido en «${campo}»${motivos.length > 0 ? `: ${motivos.join(', ')}` : ''}`);
    this.name = 'ErrorNormas';
  }
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UUID_NULO = '00000000-0000-0000-0000-000000000000';

export const exigirUuid = (campo: string, valor: unknown): string => {
  if (typeof valor !== 'string' || !UUID.test(valor) || valor === UUID_NULO) throw new ErrorNormas(campo);
  return valor;
};

export const exigirTexto = (campo: string, valor: unknown, min: number, max: number): string => {
  if (typeof valor !== 'string') throw new ErrorNormas(campo);
  const t = valor.trim();
  if (t.length < min || t.length > max) throw new ErrorNormas(campo);
  return t;
};
