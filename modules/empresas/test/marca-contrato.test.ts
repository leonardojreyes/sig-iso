import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { crearMarca } from '../src/domain/marca-empresa.js';

// La regla del logo del dominio debe ser la misma que el patrón del contrato OpenAPI (nota de la tarea 5.3).
const contrato = parse(readFileSync(join(import.meta.dirname, '../../../packages/contracts/openapi.yaml'), 'utf8'));
const esquema = contrato.components.schemas.Marca.properties.logoUrl;
const patron = new RegExp(esquema.pattern);

const casos = [
  'https://cdn.empresa.ec/logo.png', 'https://cdn.empresa.ec:8443/a.svg', '/logos/a.png', 'http://x.ec/l.png',
  'https://u:p@x.ec/l.png', '//evil.example/l.png', '/\\evil.example/l.png', 'javascript:alert(1)', 'data:image/png;base64,AA',
  'logo.png', 'https://x.ec/a b.png', 'https://x.ec', 'https://x.ec/', '/', '/a', 'https://x.ec/a\n', '',
];

describe('regla del logo = patrón del contrato', () => {
  it.each(casos)('coincide para %j', (logo) => {
    const aceptado = logo.length <= esquema.maxLength && patron.test(logo);
    expect(crearMarca({ nombre: 'Alfa', colorPrimario: '#0b5fff', logoUrl: logo }).logoUrl).toBe(aceptado ? logo : null);
  });
});
