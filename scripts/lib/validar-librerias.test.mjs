import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { stringify } from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';
import { archivosYaml, validarDirectorio } from './validar-librerias.mjs';

// Librería SINTÉTICA (ningún texto de norma).
const valida = () => ({
  esquema: 2,
  codigo: 'prueba-sintetica',
  nombre: 'Librería sintética de prueba',
  version: '1.0.0',
  es_ejemplo: true,
  fuente: 'elaboración propia SynapTech',
  referencias: [{ norma: 'Norma A', edicion: '2015' }],
  entradas: [{ id: 'ha-4.1', capitulo: 4, nivel: 1, titulo: 'Primer tema de prueba', guia: 'Texto sintético de prueba, sin relación con ninguna norma.', alcance_comun: 'comun', aplica_a: [{ norma: 'Norma A', edicion: '2015', clausula: '4.1' }] }],
});

let dir;
const crear = (archivos) => {
  dir = mkdtempSync(join(tmpdir(), 'sigiso-lib-'));
  for (const [ruta, contenido] of Object.entries(archivos)) {
    const completa = join(dir, ruta);
    mkdirSync(join(completa, '..'), { recursive: true });
    writeFileSync(completa, contenido);
  }
  return dir;
};
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

describe('archivosYaml', () => {
  it('encuentra .yaml y .yml, también en subcarpetas, ordenados, e ignora lo demás', () => {
    const d = crear({ 'b.yaml': '', 'a.yml': '', 'sub/c.yaml': '', 'LEEME.md': '', 'x.txt': '' });
    expect(archivosYaml(d).map((r) => relative(d, r).split(sep).join('/'))).toEqual(['a.yml', 'b.yaml', 'sub/c.yaml']);
  });

  it('una carpeta que no existe no tiene archivos', () => {
    expect(archivosYaml(join(tmpdir(), 'no-existe-sigiso-xyz'))).toEqual([]);
  });
});

describe('validarDirectorio', () => {
  it('acepta una librería válida', () => {
    const d = crear({ 'ok.yaml': stringify(valida()) });
    const r = validarDirectorio(d);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ ok: true, errores: [] });
  });

  it('rechaza una guía demasiado larga y lo informa con código y ruta, sin repetir el contenido', () => {
    const l = valida();
    l.entradas[0].guia = 'ana.perez@example.test '.repeat(20);
    const r = validarDirectorio(crear({ 'mala.yaml': stringify(l) }));
    expect(r[0].ok).toBe(false);
    expect(r[0].errores).toEqual([{ entrada: 'ha-4.1', indice: 0, ruta: 'entradas[0].guia', codigo: 'demasiado_largo' }]);
    expect(JSON.stringify(r)).not.toContain('ana.perez');
  });

  it('aplica las reglas entre campos (id repetido)', () => {
    const l = valida();
    l.entradas.push({ ...l.entradas[0] });
    const r = validarDirectorio(crear({ 'dup.yaml': stringify(l) }));
    expect(r[0].errores.map((e) => e.codigo)).toEqual(['id_repetido']);
  });

  it('un YAML mal formado se informa con un código, sin el texto del error (podría contener el contenido)', () => {
    const r = validarDirectorio(crear({ 'roto.yaml': 'esquema: 2\ncodigo: [sin cerrar ana.perez@example.test\n' }));
    expect(r[0]).toMatchObject({ ok: false, errores: [{ entrada: null, indice: null, ruta: '', codigo: 'yaml_invalido' }] });
    expect(JSON.stringify(r)).not.toContain('ana.perez');
  });

  it('un YAML vacío o que no es un objeto se rechaza', () => {
    const r = validarDirectorio(crear({ 'vacio.yaml': '', 'lista.yaml': '- a\n- b\n' }));
    expect(r.every((x) => !x.ok)).toBe(true);
  });

  it('revisa cada archivo por separado', () => {
    const mala = valida();
    delete mala.fuente;
    const r = validarDirectorio(crear({ 'a.yaml': stringify(valida()), 'b.yaml': stringify(mala) }));
    expect(r.map((x) => x.ok)).toEqual([true, false]);
  });
});

describe('pnpm libraries:validate (CLI)', () => {
  const ejecutar = (d) => spawnSync(process.execPath, ['--import', 'tsx', 'scripts/validate-libraries.mjs', '--dir', d], { cwd: join(import.meta.dirname, '../..'), encoding: 'utf8' });

  it('sale con 0 si todas las librerías son válidas', () => {
    const r = ejecutar(crear({ 'ok.yaml': stringify(valida()) }));
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('1 librería(s) revisada(s), 0 con errores');
  });

  it('sale con 1 y no imprime contenido si alguna falla', () => {
    const l = valida();
    l.entradas[0].guia = 'ana.perez@example.test '.repeat(20);
    const r = ejecutar(crear({ 'mala.yaml': stringify(l) }));
    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).toContain('demasiado_largo');
    expect(r.stdout + r.stderr).not.toContain('ana.perez');
  });

  it('sin carpeta de librerías no hay nada que revisar y termina bien', () => {
    expect(ejecutar(join(tmpdir(), 'no-existe-sigiso-xyz')).status).toBe(0);
  });
});
