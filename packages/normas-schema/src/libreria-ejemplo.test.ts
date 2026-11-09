import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { revisarContenido } from './contenido';
import { validarLibreria, type Libreria } from './validar';

// El ARTEFACTO REAL: la librería de ejemplo de la Estructura Armonizada debe cumplir el esquema y las reglas de contenido.
const ruta = join(import.meta.dirname, '../../../libraries/normas/ejemplo-estructura-armonizada.yaml');
const texto = readFileSync(ruta, 'utf8');
const resultado = validarLibreria(parse(texto));
const libreria = (resultado.ok ? resultado.libreria : undefined) as Libreria;

describe('libraries/normas/ejemplo-estructura-armonizada.yaml', () => {
  it('cumple el esquema v2 y sus reglas entre campos', () => {
    expect(resultado.ok ? [] : resultado.errores).toEqual([]);
  });

  it('cumple las reglas de contenido (frases, longitud, tono, formato)', () => {
    expect(revisarContenido(libreria)).toEqual([]);
  });

  it('es una librería de ejemplo de elaboración propia', () => {
    expect(libreria.codigo).toBe('ejemplo-estructura-armonizada');
    expect(libreria.es_ejemplo).toBe(true);
    expect(libreria.fuente).toMatch(/elaboración propia/);
  });

  it('hace referencia a las tres normas de la v1, con sus ediciones', () => {
    expect(libreria.referencias.map((r) => `${r.norma} ${r.edicion}`)).toEqual([
      'ISO 9001 2015',
      'ISO/IEC 27001 2022',
      'ISO/IEC 42001 2023',
    ]);
  });

  it('tiene las 21 entradas previstas, de primer nivel, con id único', () => {
    expect(libreria.entradas).toHaveLength(21);
    expect(new Set(libreria.entradas.map((e) => e.id)).size).toBe(21);
    expect(libreria.entradas.every((e) => e.nivel === 1)).toBe(true);
  });

  it('cubre los capítulos 4 a 10 en el número previsto', () => {
    const porCapitulo = (c: number) => libreria.entradas.filter((e) => e.capitulo === c).length;
    expect([4, 5, 6, 7, 8, 9, 10].map(porCapitulo)).toEqual([4, 3, 3, 5, 1, 3, 2]);
  });

  it('cada entrada indica su cláusula en las tres normas', () => {
    for (const e of libreria.entradas)
      expect(
        e.aplica_a.map((a) => a.norma),
        e.id,
      ).toEqual(['ISO 9001', 'ISO/IEC 27001', 'ISO/IEC 42001']);
  });

  it('el capítulo 10 se modela por tema, con el identificador que le da cada norma (no coinciden entre normas)', () => {
    const cap10 = libreria.entradas.filter((e) => e.capitulo === 10);
    const claves = (id: string) => cap10.find((e) => e.id === id)!.aplica_a.map((a) => a.clausula);
    expect(cap10.map((e) => e.id).sort()).toEqual(['ha-mejora', 'ha-no-conformidad']);
    expect(new Set(claves('ha-mejora')).size).toBeGreaterThan(1); // según la tabla pendiente de verificación: la mejora continua no tiene el mismo número en las tres normas
  });

  it('las guías son todas distintas entre sí y propias (ni enlaces ni correos)', () => {
    expect(new Set(libreria.entradas.map((e) => e.guia)).size).toBe(21);
    expect(texto).not.toMatch(/https?:\/\/|@/);
  });

  it('ninguna guía presenta como requisito de la norma lo que es práctica del proceso de certificación (etapas de auditoría externa)', () => {
    for (const e of libreria.entradas) expect(e.guia, e.id).not.toMatch(/etapa\s*[12]/i);
  });

  it('las entradas cuyo contenido de fondo difiere entre normas están marcadas como parciales', () => {
    const parciales = libreria.entradas.filter((e) => e.alcance_comun === 'parcial').map((e) => e.id);
    for (const id of ['ha-4.4', 'ha-6.1', 'ha-6.3', 'ha-7.1', 'ha-8.1', 'ha-9.1', 'ha-mejora'])
      expect(parciales, id).toContain(id);
  });

  it('BORRADOR y SIN VERIFICAR van juntos: la versión 0.x lleva la marca; la 1.0.0 en adelante, no', () => {
    const borrador = libreria.version.startsWith('0.');
    const marca = /NUMERACIONES SIN VERIFICAR/.test(texto);
    expect(marca, `versión ${libreria.version}`).toBe(borrador);
    // El nombre es lo que viaja al catálogo y se ve en pantalla: un borrador sin verificar debe decirlo ahí también.
    expect(/sin verificar/i.test(libreria.nombre), `nombre de la versión ${libreria.version}`).toBe(borrador);
  });
});
