// Formas del contrato (packages/contracts/openapi.yaml) del control documental (ADR 039), como esquemas JSON en línea. Deben
// coincidir con el contrato: la prueba de conformidad compara lo que ve un cliente.

type Esquema = Record<string, unknown>;

const entero = (minimum: number, maximum?: number): Esquema => ({
  type: 'integer',
  minimum,
  ...(maximum === undefined ? {} : { maximum }),
});
const texto = (maxLength: number, extra: Esquema = {}): Esquema => ({ type: 'string', maxLength, ...extra });
const nulo = (e: Esquema): Esquema => ({ ...e, nullable: true });
const objeto = (properties: Record<string, Esquema>): Esquema => ({ type: 'object', properties, required: Object.keys(properties) });
const lista = (items: Esquema, maxItems: number): Esquema => ({ type: 'array', maxItems, items });
const enumerado = (valores: string[]): Esquema => ({ type: 'string', enum: valores });
/** «Esto o nulo»: en el contrato es un `oneOf`, que la comparación no baja a campos. */
const oUnNulo = (e: Esquema): Esquema => ({ oneOf: [e, { type: 'null' }] });

const UUID = texto(36, { format: 'uuid' });
const FECHA = texto(10, { format: 'date' });
const FECHA_HORA = texto(40, { format: 'date-time' });
const CODIGO = texto(10, { pattern: '^[A-Z]{3}-[0-9]{3,6}$' });

export const TIPOS_DOCUMENTO_API = ['politica', 'procedimiento', 'instructivo', 'formato', 'manual', 'externo', 'otro'];
export const CLASIFICACIONES_API = ['publica', 'interna', 'confidencial', 'restringida'];
export const ESTADOS_VERSION_API = ['borrador', 'en_revision', 'aprobada', 'obsoleta', 'descartada'];
export const MOTIVOS_DEVOLUCION_API = ['incompleta', 'incorrecta', 'otro'];
export const MOTIVOS_REVISION_API = ['periodica', 'auditoria', 'cambio_de_contexto'];
const ESTADOS_REVISION = ['vencida', 'por_vencer', 'al_dia'];

const LECTURAS = objeto({ confirmadas: entero(0), total: entero(0) });

const PROPIEDADES_DOCUMENTO: Record<string, Esquema> = {
  id: UUID,
  codigo: CODIGO,
  tipo: enumerado(TIPOS_DOCUMENTO_API),
  titulo: texto(120),
  area: nulo(texto(60)),
  clasificacion: enumerado(CLASIFICACIONES_API),
  responsableId: UUID,
  emisor: nulo(texto(120)),
  edicionFuente: nulo(texto(60)),
  estado: enumerado(['activo', 'retirado']),
  proximaRevision: nulo(FECHA),
  revision: oUnNulo(enumerado(ESTADOS_REVISION)),
  ultimaRevisionEn: nulo(FECHA_HORA),
  vigente: oUnNulo(objeto({ versionId: UUID, numero: entero(1), aprobadaEn: FECHA_HORA })),
  sinVigente: { type: 'boolean' },
  lecturas: oUnNulo(LECTURAS),
  lecturaPendiente: { type: 'boolean' },
  version: entero(1),
};

export const DOCUMENTO = objeto(PROPIEDADES_DOCUMENTO);
export const LISTA_DOCUMENTOS = objeto({ hoy: FECHA, documentos: lista(DOCUMENTO, 1000) });

export const VERSION_DOCUMENTO = objeto({
  id: UUID,
  documentoId: UUID,
  numero: entero(1),
  estado: enumerado(ESTADOS_VERSION_API),
  vigente: { type: 'boolean' },
  nota: texto(500),
  archivo: objeto({ nombre: texto(120), tipo: texto(120), bytes: entero(1, 26214400), sha256: texto(64, { pattern: '^[0-9a-f]{64}$' }) }),
  autorId: UUID,
  aprobadorId: nulo(texto(36, { format: 'uuid' })),
  aprobadaPor: nulo(texto(36, { format: 'uuid' })),
  aprobadaEn: nulo(FECHA_HORA),
  porSuAutor: { type: 'boolean' },
  motivoExcepcion: nulo(texto(300)),
  requiereLectura: { type: 'boolean' },
  devueltaMotivo: oUnNulo(enumerado(MOTIVOS_DEVOLUCION_API)),
  devueltaNota: nulo(texto(300)),
  obsoletaEn: nulo(FECHA_HORA),
  elegibleParaDisposicion: { type: 'boolean' },
  lecturas: oUnNulo(LECTURAS),
  creadaEn: FECHA_HORA,
});

export const DOCUMENTO_DETALLE = objeto({
  ...PROPIEDADES_DOCUMENTO,
  versiones: lista(VERSION_DOCUMENTO, 500),
  destinatarios: lista(UUID, 500),
  controles: lista(UUID, 50),
  entradas: lista(objeto({ libreriaCodigo: texto(64), idEstable: texto(41) }), 50),
  retencion: oUnNulo(objeto({ anios: entero(1, 100), motivo: texto(200) })),
  unicoAdministrador: { type: 'boolean' },
});

export const DISTRIBUCION = objeto({ destinatarios: lista(UUID, 500) });
export const VINCULO_DOCUMENTO_RESULTADO = objeto({ creado: { type: 'boolean' } });
export const LECTURAS_PENDIENTES = lista(
  objeto({ versionId: UUID, documentoId: UUID, codigo: CODIGO, titulo: texto(120), numeroVersion: entero(1) }),
  1000,
);
export const COBERTURA_DOCUMENTAL = objeto({
  normas: lista(texto(60), 50),
  total: entero(0),
  cubiertas: entero(0),
  entradas: lista(
    objeto({
      libreriaCodigo: texto(64),
      idEstable: texto(41),
      tipo: enumerado(['clausula', 'control']),
      titulo: texto(200),
      normas: lista(texto(60), 20),
      documentos: lista(objeto({ id: UUID, codigo: CODIGO }), 50),
      cubierta: { type: 'boolean' },
    }),
    500,
  ),
});
export const RETENCION = objeto({ tipo: enumerado(TIPOS_DOCUMENTO_API), anios: entero(1, 100), motivo: texto(200), version: entero(1) });
export const RETENCIONES = lista(RETENCION, 7);
export const DIRECTORIO_PERSONAS = lista(objeto({ id: UUID, nombre: texto(120), activa: { type: 'boolean' } }), 1000);
