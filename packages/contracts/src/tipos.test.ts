import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generar } from '../scripts/generar-tipos.mjs';
import type { components, operations, paths } from './generado/api';

// Comprobaciones de compilación: si el contrato cambia de forma, `pnpm typecheck` falla aquí.
type Marca = components['schemas']['Marca'];
const marcaSinLogo: Marca = {
  nombre: 'Empresa A',
  colorPrimario: '#0a5',
  colorOriginal: '#0a5',
  ajustadoPorContraste: false,
  logoUrl: null, // [string, null]
};
type Codigos = keyof operations['adoptarLibreria']['responses'];
const exitos: Codigos[] = [200, 201]; // dos códigos de éxito
const ruta: keyof paths = '/librerias/{id}/adopcion';

describe('tipos generados desde el contrato', () => {
  it('compilan con los usos esperados', () => {
    expect(marcaSinLogo.logoUrl).toBeNull();
    expect(exitos).toEqual([200, 201]);
    expect(ruta).toContain('adopcion');
  });

  it('están al día con openapi.yaml (el CI falla si el contrato cambia sin regenerar)', async () => {
    const actual = readFileSync(join(import.meta.dirname, 'generado', 'api.d.ts'), 'utf8').replace(/\r\n/g, '\n');
    expect(actual).toBe(await generar());
  });
});
