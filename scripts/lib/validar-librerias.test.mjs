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

  describe('reglas de contenido (control de texto copiado, ADR 026)', () => {
    const con = (cambio) => {
      const l = valida();
      cambio(l.entradas[0]);
      return validarDirectorio(crear({ 'contenido.yaml': stringify(l) }))[0];
    };

    it.each([
      ['más de 2 frases', (e) => (e.guia = 'Primera frase de prueba. Segunda frase de prueba. Tercera frase de prueba.'), 'entradas[0].guia', 'guia_demasiadas_frases'],
      ['tono normativo', (e) => (e.guia = 'La organización debe revisar esto con regularidad.'), 'entradas[0].guia', 'tono_normativo'],
      ['formato de lista', (e) => (e.guia = 'Incluye: a) esto, b) aquello, c) lo otro.'), 'entradas[0].guia', 'formato_de_lista'],
      ['un correo en la guía', (e) => (e.guia = 'Escribe a alguien@example.test para más información.'), 'entradas[0].guia', 'enlace_o_correo'],
      ['un salto de línea en el título', (e) => (e.titulo = 'Dos\nlíneas'), 'entradas[0].titulo', 'formato_de_lista'],
    ])('rechaza una librería válida en estructura pero con %s', (_n, cambio, ruta, codigo) => {
      const r = con(cambio);
      expect(r.ok).toBe(false);
      expect(r.errores).toContainEqual({ entrada: 'ha-4.1', indice: 0, ruta, codigo });
    });

    it('no repite el contenido revisado', () => {
      const r = con((e) => (e.guia = 'La organización debe escribir a ana.perez@example.test siempre.'));
      expect(r.ok).toBe(false);
      expect(JSON.stringify(r.errores)).not.toContain('ana.perez');
    });

    it('si la estructura ya falla, no se evalúa el contenido (no se mezclan errores)', () => {
      const r = con((e) => {
        e.guia = 'x'.repeat(300);
        e.titulo = 'Dos\nlíneas';
      });
      expect(r.errores.map((x) => x.codigo)).toEqual(['demasiado_largo']);
    });

    it('una librería correcta sigue aceptándose', () => {
      expect(con(() => {}).ok).toBe(true);
    });
  });

  it('las librerías REALES del repositorio cumplen el esquema y las reglas de contenido', () => {
    const reales = validarDirectorio(join(import.meta.dirname, '../../libraries/normas'));
    expect(reales.length).toBeGreaterThan(0);
    for (const r of reales) expect({ archivo: r.archivo, errores: r.errores }).toEqual({ archivo: r.archivo, errores: [] });
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

  it('sale con 1 si una guía incumple las reglas de contenido, aunque cumpla el esquema', () => {
    const l = valida();
    l.entradas[0].guia = 'La organización debe escribir a ana.perez@example.test siempre.';
    const r = ejecutar(crear({ 'normativa.yaml': stringify(l) }));
    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).toContain('tono_normativo');
    expect(r.stdout + r.stderr).toContain('enlace_o_correo');
    expect(r.stdout + r.stderr).not.toContain('ana.perez');
  });

  it('sin carpeta de librerías no hay nada que revisar y termina bien', () => {
    expect(ejecutar(join(tmpdir(), 'no-existe-sigiso-xyz')).status).toBe(0);
  });
});
