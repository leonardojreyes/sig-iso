// Formas del contrato (packages/contracts/openapi.yaml) de la auditoría interna (ADR 040), como esquemas JSON en línea. Deben
// coincidir con el contrato: la prueba de conformidad compara lo que ve un cliente.

type Esquema = Record<string, unknown>;

const entero = (minimum: number, maximum?: number): Esquema => ({ type: 'integer', minimum, ...(maximum === undefined ? {} : { maximum }) });
const texto = (maxLength: number, extra: Esquema = {}): Esquema => ({ type: 'string', maxLength, ...extra });
const nulo = (e: Esquema): Esquema => ({ ...e, nullable: true });
const objeto = (properties: Record<string, Esquema>): Esquema => ({ type: 'object', properties, required: Object.keys(properties) });
const lista = (items: Esquema, maxItems: number): Esquema => ({ type: 'array', maxItems, items });
const enumerado = (valores: string[]): Esquema => ({ type: 'string', enum: valores });
/** «Esto o nulo»: en el contrato es un `oneOf`, que la comparación no baja a campos. */
const oUnNulo = (e: Esquema): Esquema => ({ oneOf: [e, { type: 'null' }] });

const UUID = texto(36, { format: 'uuid' });

export const IMPORTANCIAS_API = ['alta', 'media', 'baja'];
export const FRECUENCIAS_API = ['semestral', 'anual', 'cada_dos_anios', 'cada_tres_anios'];
export const CAMBIOS_RELEVANTES_API = ['cambio', 'incidente'];
export const RELACIONES_API = ['duena', 'participa', 'diseno', 'supervisa'];

export const PROCESO = objeto({
  id: UUID,
  codigo: texto(9, { pattern: '^PR-[0-9]{3,6}$' }),
  nombre: texto(120),
  descripcion: nulo(texto(300)),
  duenaId: UUID,
  importancia: enumerado(IMPORTANCIAS_API),
  frecuencia: enumerado(FRECUENCIAS_API),
  transversal: { type: 'boolean' },
  cambioRelevante: oUnNulo(enumerado(CAMBIOS_RELEVANTES_API)),
  estado: enumerado(['vigente', 'retirado']),
  version: entero(1),
  personasRelacionadas: entero(0),
  avisos: lista(enumerado(['sin_relaciones', 'duena_inactiva']), 2),
});
export const LISTA_PROCESOS = objeto({ procesos: lista(PROCESO, 200), gestionSigVigente: { type: 'boolean' } });
export const RELACION_PROCESO = objeto({ procesoId: UUID, personaId: UUID, relacion: enumerado(RELACIONES_API) });
export const LISTA_RELACIONES = objeto({ relaciones: lista(RELACION_PROCESO, 100) });
