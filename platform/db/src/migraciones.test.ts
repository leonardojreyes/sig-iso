import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ejecutarConReintentos, leerMigracionesSql, MigracionFallidaError, MigracionInvalidaError, type ResultadoEjecucion } from './migraciones';

describe('leerMigracionesSql', () => {
  let dir: string | undefined;
  const crear = (archivos: Record<string, string>) => {
    dir = mkdtempSync(join(tmpdir(), 'sigiso-mig-'));
    for (const [nombre, contenido] of Object.entries(archivos)) writeFileSync(join(dir, nombre), contenido);
    return dir;
  };
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('devuelve las migraciones .sql ordenadas por nombre', () => {
    const d = crear({ '0002_segunda.sql': 'select 2;', '0001_primera.sql': 'select 1;', '0010_decima.sql': 'select 10;' });
    expect(leerMigracionesSql(d).map((m) => m.nombre)).toEqual(['0001_primera', '0002_segunda', '0010_decima']);
  });

  it('lee el contenido de cada archivo', () => {
    const d = crear({ '0001_a.sql': 'select 1;' });
    expect(leerMigracionesSql(d)[0]?.sql).toBe('select 1;');
  });

  it('ignora lo que no es .sql', () => {
    const d = crear({ '0001_a.sql': 'select 1;', 'LEEME.md': '# notas', '0002_b.txt': 'x' });
    expect(leerMigracionesSql(d).map((m) => m.nombre)).toEqual(['0001_a']);
  });

  it('una carpeta vacía no tiene migraciones', () => {
    expect(leerMigracionesSql(crear({}))).toEqual([]);
  });

  it.each(['abc.sql', '1_corta.sql', '0001-guion.sql', '0001_Mayusculas.sql', '0001_con espacio.sql'])('rechaza el nombre de archivo mal formado: %s', (nombre) => {
    expect(() => leerMigracionesSql(crear({ [nombre]: 'select 1;' }))).toThrow(MigracionInvalidaError);
  });

  it('rechaza un archivo .sql vacío (suele ser un error al crearlo)', () => {
    expect(() => leerMigracionesSql(crear({ '0001_vacia.sql': '  \n' }))).toThrow(MigracionInvalidaError);
  });

  it('rechaza una carpeta que no existe', () => {
    const base = mkdtempSync(join(tmpdir(), 'sigiso-mig-'));
    dir = base;
    expect(() => leerMigracionesSql(join(base, 'no-existe'))).toThrow(MigracionInvalidaError);
    mkdirSync(join(base, 'existe'));
  });
});

describe('ejecutarConReintentos', () => {
  const ok = (...nombres: string[]): ResultadoEjecucion => ({ results: nombres.map((migrationName) => ({ migrationName, status: 'Success' as const })) });
  const secuencia = (...respuestas: ResultadoEjecucion[]) => {
    const f = vi.fn(async () => respuestas[Math.min(f.mock.calls.length - 1, respuestas.length - 1)]!);
    return f;
  };
  const sinPausa = { pausaMs: 0 };

  it('si sale bien a la primera, no reintenta y devuelve lo aplicado', async () => {
    const f = secuencia(ok('0001_a', '0002_b'));
    expect(await ejecutarConReintentos(f, sinPausa)).toEqual({ aplicadas: ['0001_a', '0002_b'] });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('solo cuenta como aplicadas las migraciones con éxito', async () => {
    const f = secuencia({ results: [{ migrationName: '0001_a', status: 'Success' }, { migrationName: '0002_b', status: 'NotExecuted' }] });
    expect(await ejecutarConReintentos(f, sinPausa)).toEqual({ aplicadas: ['0001_a'] });
  });

  it('reintenta cuando falla la preparación del registro (no se aplicó nada) y termina bien', async () => {
    const f = secuencia({ error: new Error('relation "public.tabla_ajena" does not exist') }, ok('0001_a'));
    expect(await ejecutarConReintentos(f, sinPausa)).toEqual({ aplicadas: ['0001_a'] });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('si el error persiste, lo informa tras 6 intentos con la causa', async () => {
    const f = secuencia({ error: new Error('causa persistente') });
    const intento = ejecutarConReintentos(f, sinPausa);
    await expect(intento).rejects.toThrow(MigracionFallidaError);
    await expect(intento).rejects.toThrow(/registro de migraciones.*causa persistente/);
    expect(f).toHaveBeenCalledTimes(6);
  });

  it('una migración que falla NO se reintenta: se informa con su nombre', async () => {
    const f = secuencia({ error: new Error('división por cero'), results: [{ migrationName: '0004_mala', status: 'Error' }] });
    await expect(ejecutarConReintentos(f, sinPausa)).rejects.toThrow(/0004_mala/);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('espera entre intentos', async () => {
    vi.useFakeTimers();
    try {
      const f = secuencia({ error: new Error('x') }, ok('0001_a'));
      const promesa = ejecutarConReintentos(f, { pausaMs: 1000 });
      await vi.advanceTimersByTimeAsync(0);
      expect(f).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1000);
      await promesa;
      expect(f).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
