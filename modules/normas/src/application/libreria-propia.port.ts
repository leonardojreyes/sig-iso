import type { Libreria as LibreriaYaml } from '@sig/normas-schema';

export const LIBRERIA_PROPIA_REPOSITORY = Symbol('LIBRERIA_PROPIA_REPOSITORY');

/**
 * Puerto de salida: guarda una librería PROPIA de la empresa del contexto (ADR 034). Las versiones son inmutables: si ya existe
 * la misma versión, responde `ya` (misma huella) o `distinto` (otra huella) y no escribe nada.
 */
export interface LibreriaPropiaRepositoryPort {
  guardar(libreria: LibreriaYaml, huella: string): Promise<'nueva' | 'ya' | 'distinto'>;
}

export const LECTOR_LIBRERIA = Symbol('LECTOR_LIBRERIA');

export type LecturaLibreria =
  | { readonly ok: true; readonly datos: unknown }
  | { readonly ok: false; readonly motivo: 'tipo_no_permitido' | 'formato_invalido'; readonly codigo: string };

/**
 * Puerto de salida: convierte los bytes subidos en datos (sin validar el esquema). Lo hace el adaptador: texto UTF-8 sin bytes
 * nulos y YAML SIN alias ni anclas ni claves repetidas. Nunca devuelve ni cita el contenido en los errores.
 */
export interface LectorLibreriaPort {
  /** SHA-256 (hex) de los bytes. */
  huellaDe(bytes: Uint8Array): string;
  leer(bytes: Uint8Array): LecturaLibreria;
}
