// Formas del contrato (packages/contracts/openapi.yaml) de los activos de información (ADR 038), como esquemas JSON en línea. Deben
// coincidir con el contrato: la prueba de conformidad compara lo que ve un cliente.
type Esquema = Record<string, unknown>;
const entero = (minimum: number, maximum?: number): Esquema => ({ type: 'integer', minimum, ...(maximum === undefined ? {} : { maximum }) });
const texto = (maxLength: number, extra: Esquema = {}): Esquema => ({ type: 'string', maxLength, ...extra });
const nulo = (e: Esquema): Esquema => ({ ...e, nullable: true });
const objeto = (properties: Record<string, Esquema>): Esquema => ({ type: 'object', properties, required: Object.keys(properties) });
const lista = (items: Esquema, maxItems: number): Esquema => ({ type: 'array', maxItems, items });
const enumerado = (valores: string[]): Esquema => ({ type: 'string', enum: valores });

const UUID = texto(36, { format: 'uuid' });
export const TIPOS_ACTIVO_API = ['informacion', 'aplicacion_sistema', 'infraestructura', 'persona', 'servicio_terceros', 'instalacion'];
export const CLASIFICACIONES_ACTIVO_API = ['publica', 'interna', 'confidencial', 'restringida'];
const NIVELES = ['bajo', 'medio', 'alto', 'critico'];
const ESTADOS = ['vigente', 'retirado'];
const CODIGO_ACTIVO = texto(8, { pattern: '^A-[0-9]{3,6}$' });
const CODIGO_RIESGO = texto(8, { pattern: '^R-[0-9]{3,6}$' });

const PROPIEDADES: Record<string, Esquema> = {
  id: UUID,
  codigo: CODIGO_ACTIVO,
  nombre: texto(120),
  descripcion: nulo(texto(500)),
  tipo: enumerado(TIPOS_ACTIVO_API),
  clasificacion: enumerado(CLASIFICACIONES_ACTIVO_API),
  responsableId: UUID,
  estado: enumerado(ESTADOS),
  version: entero(1),
};
export const ACTIVO = objeto(PROPIEDADES);
export const ACTIVOS = lista(ACTIVO, 50);
export const ACTIVOS_LISTADO = lista(objeto({ ...PROPIEDADES, riesgos: entero(0, 500), sinRiesgos: { type: 'boolean' } }), 500);
export const ACTIVO_DETALLE = objeto({
  ...PROPIEDADES,
  riesgos: lista(objeto({ id: UUID, codigo: CODIGO_RIESGO, titulo: texto(120), nivel: enumerado(NIVELES), puntaje: entero(1, 25), estado: enumerado(ESTADOS) }), 500),
  nivelMasAlto: { oneOf: [enumerado(NIVELES), { type: 'null' }] },
});
export const AVISO_RETIRO_ACTIVO = objeto({ activoId: UUID, codigo: CODIGO_ACTIVO, riesgosSinActivo: lista(objeto({ id: UUID, codigo: CODIGO_RIESGO, titulo: texto(120) }), 500) });
export const LIGA_ACTIVO_RESULTADO = objeto({ creado: { type: 'boolean' } });
