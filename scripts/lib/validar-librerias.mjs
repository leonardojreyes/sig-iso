// Valida las librerías de normas (YAML) con el validador del esquema v2 y las reglas de contenido (@sig/normas-schema, ADR 026).
// Los errores salen como código y ruta: nunca repiten el contenido del archivo (podría ser texto de una norma).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { validarLibreria } from '@sig/normas-schema';
import { revisarContenido } from '@sig/normas-schema/contenido';
import { parse } from 'yaml';

/** Archivos .yaml/.yml de una carpeta y sus subcarpetas, ordenados. Una carpeta que no existe no tiene archivos. */
export const archivosYaml = (dir) => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .flatMap((nombre) => {
      const ruta = join(dir, nombre);
      return statSync(ruta).isDirectory() ? archivosYaml(ruta) : /\.ya?ml$/.test(nombre) ? [ruta] : [];
    });
};

/** @returns {{ archivo: string, ok: boolean, errores: object[] }[]} */
export const validarDirectorio = (dir) =>
  archivosYaml(dir).map((archivo) => {
    let datos;
    try {
      datos = parse(readFileSync(archivo, 'utf8'));
    } catch {
      // El mensaje del analizador puede citar el contenido: solo se informa el código.
      return { archivo, ok: false, errores: [{ entrada: null, indice: null, ruta: '', codigo: 'yaml_invalido' }] };
    }
    const r = validarLibreria(datos);
    if (!r.ok) return { archivo, ok: false, errores: r.errores };
    // Control de texto copiado (ADR 026): solo se evalúa con la estructura ya válida. Los hallazgos son códigos, sin contenido.
    const errores = revisarContenido(r.libreria).map((h) => ({
      entrada: h.entrada,
      indice: h.indice,
      ruta: `entradas[${h.indice}].${h.campo}`,
      codigo: h.codigo,
    }));
    return { archivo, ok: errores.length === 0, errores };
  });
