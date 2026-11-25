// Formas del contrato (packages/contracts/openapi.yaml) de los criterios de evaluación (ADR 038), como esquemas JSON en línea. Deben
// coincidir con el contrato: la prueba de conformidad compara lo que ve un cliente.
type Esquema = Record<string, unknown>;
const entero = (minimum: number, maximum?: number): Esquema => ({ type: 'integer', minimum, ...(maximum === undefined ? {} : { maximum }) });
const objeto = (properties: Record<string, Esquema>): Esquema => ({ type: 'object', properties, required: Object.keys(properties) });
const NIVELES = ['bajo', 'medio', 'alto', 'critico'];

const CELDA = objeto({ probabilidad: entero(1, 5), impacto: entero(1, 5), puntaje: entero(1, 25), nivel: { type: 'string', enum: NIVELES }, cantidad: entero(0, 500) });
const ESCALA: Esquema = { type: 'array', minItems: 5, maxItems: 5, items: { type: 'string', maxLength: 200 } };

export const CRITERIOS_RESPUESTA = objeto({
  origen: { type: 'string', enum: ['omision', 'empresa'] },
  version: entero(0),
  probabilidad: ESCALA,
  impacto: ESCALA,
  nivelAceptacion: { oneOf: [{ type: 'string', enum: NIVELES }, { type: 'null' }] },
  creadoEn: { type: 'string', format: 'date-time', maxLength: 40, nullable: true },
  riesgosVigentes: entero(0, 500),
  matriz: { type: 'array', minItems: 25, maxItems: 25, items: CELDA },
});
export { NIVELES as NIVELES_CRITERIOS };
