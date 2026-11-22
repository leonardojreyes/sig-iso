const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `AAAA-MM-DD` de un día que existe en el calendario (rechaza «2026-02-31»). */
export const fechaValida = (texto: unknown): texto is string => {
  if (typeof texto !== 'string') return false;
  const m = FECHA.exec(texto);
  if (!m) return false;
  const [, a, mes, d] = m;
  const f = new Date(Date.UTC(Number(a), Number(mes) - 1, Number(d)));
  return f.getUTCFullYear() === Number(a) && f.getUTCMonth() === Number(mes) - 1 && f.getUTCDate() === Number(d);
};

const FORMATO_ECUADOR = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' });

/** La fecha de hoy en Ecuador (`AAAA-MM-DD`): una vigencia «hasta el 10» sigue vigente todo el día 10 de Ecuador, no del servidor. */
export const hoyEnEcuador = (ahora: Date): string => FORMATO_ECUADOR.format(ahora);

/** Resta `meses` a una fecha `AAAA-MM-DD` (ajusta el día si el mes destino es más corto). */
export const restarMeses = (fecha: string, meses: number): string => {
  const [a, m, d] = fecha.split('-').map(Number) as [number, number, number];
  const total = a * 12 + (m - 1) - meses;
  const anio = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`;
};
