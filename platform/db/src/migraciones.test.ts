import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { leerMigracionesSql, MigracionInvalidaError } from './migraciones';

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
