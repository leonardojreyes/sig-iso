import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { EntradaLibreria, Libreria } from '../src/index.js';

// La librería de ejemplo (YAML) debe cumplir las reglas del dominio: lo que se cargue al catálogo se podrá leer sin error.
interface EntradaYaml { id: string; capitulo: number; nivel: 1 | 2; titulo: string; guia: string; alcance_comun: 'comun' | 'parcial' | 'especifico'; aplica_a: { norma: string; edicion: string; clausula: string }[] }
const yaml = parse(readFileSync(join(import.meta.dirname, '../../../libraries/normas/ejemplo-estructura-armonizada.yaml'), 'utf8'));

describe('librería de ejemplo frente al dominio', () => {
  const libreria = Libreria.crear({ id: randomUUID(), codigo: yaml.codigo, nombre: yaml.nombre, version: yaml.version, esEjemplo: yaml.es_ejemplo, fuente: yaml.fuente });

  it('los metadatos son una Libreria válida', () => {
    expect(libreria.esEjemplo).toBe(true);
  });

  it('las 21 entradas son EntradaLibreria válidas, con el capítulo 10 por tema', () => {
    const entradas = yaml.entradas.map((e: EntradaYaml, orden: number) =>
      EntradaLibreria.crear({ id: randomUUID(), libreriaId: libreria.id, idEstable: e.id, capitulo: e.capitulo, nivel: e.nivel, titulo: e.titulo, guia: e.guia, alcanceComun: e.alcance_comun, aplicaA: e.aplica_a, esEjemplo: libreria.esEjemplo, orden }),
    );
    expect(entradas).toHaveLength(21);
    expect(entradas.filter((e: EntradaLibreria) => e.capitulo === 10).map((e: EntradaLibreria) => e.idEstable)).toEqual(['ha-mejora', 'ha-no-conformidad']);
  });
});
