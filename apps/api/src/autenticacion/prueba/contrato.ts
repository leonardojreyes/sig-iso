// Valida respuestas REALES contra los esquemas de packages/contracts/openapi.yaml (la fuente de verdad del contrato).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse } from 'yaml';

const documento = parse(readFileSync(join(import.meta.dirname, '../../../../../packages/contracts/openapi.yaml'), 'utf8')) as { components: Record<string, unknown> };
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false });
ajv.addSchema({ $id: 'contrato', components: documento.components });

/** Devuelve los errores del valor frente al esquema `components.schemas.<nombre>` (lista vacía si cumple). */
export const erroresDeEsquema = (nombre: string, valor: unknown): string[] => {
  const validar = ajv.getSchema(`contrato#/components/schemas/${nombre}`);
  if (!validar) throw new Error(`El contrato no tiene el esquema ${nombre}`);
  return validar(valor) ? [] : (validar.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`);
};
