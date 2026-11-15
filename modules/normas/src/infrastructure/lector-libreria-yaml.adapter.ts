// Adaptador de LectorLibreriaPort: texto UTF-8 y YAML seguro (ADR 034). Los errores son códigos: el mensaje del analizador puede
// citar el contenido, que podría ser texto de una norma, y no se propaga.
import { createHash } from 'node:crypto';
import { parse } from 'yaml';
import type { LectorLibreriaPort, LecturaLibreria } from '../application/libreria-propia.port.js';

export class LectorLibreriaYaml implements LectorLibreriaPort {
  huellaDe(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex');
  }

  leer(bytes: Uint8Array): LecturaLibreria {
    let texto: string;
    try {
      texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return { ok: false, motivo: 'tipo_no_permitido', codigo: 'no_es_texto' };
    }
    if (texto.includes('\u0000')) return { ok: false, motivo: 'tipo_no_permitido', codigo: 'no_es_texto' };
    try {
      // Sin alias ni anclas (no hay expansión de «bomba YAML») y sin claves repetidas.
      return { ok: true, datos: parse(texto, { maxAliasCount: 0, uniqueKeys: true, prettyErrors: false }) };
    } catch {
      return { ok: false, motivo: 'formato_invalido', codigo: 'yaml_invalido' };
    }
  }
}
