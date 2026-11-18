// Formas del contrato (packages/contracts/openapi.yaml) de los riesgos y de la justificación de la Declaración (ADR 037), como
// esquemas JSON en línea. Deben coincidir con el contrato: la prueba de conformidad compara lo que ve un cliente.

type Esquema = Record<string, unknown>;

const entero = (minimum: number, maximum?: number): Esquema => ({ type: 'integer', minimum, ...(maximum === undefined ? {} : { maximum }) });
const texto = (maxLength: number, extra: Esquema = {}): Esquema => ({ type: 'string', maxLength, ...extra });
const nulo = (e: Esquema): Esquema => ({ ...e, nullable: true });
const objeto = (properties: Record<string, Esquema>): Esquema => ({ type: 'object', properties, required: Object.keys(properties) });
const lista = (items: Esquema, maxItems: number): Esquema => ({ type: 'array', maxItems, items });

const UUID = texto(36, { format: 'uuid' });
const CODIGO_RIESGO = texto(8, { pattern: '^R-[0-9]{3,6}$' });
const CODIGO_CONTROL = texto(20, { pattern: '^[A-Za-z0-9][A-Za-z0-9._-]{0,19}$' });

export const NIVELES = ['bajo', 'medio', 'alto', 'critico'];
export const DECISIONES = ['mitigar', 'aceptar', 'transferir', 'evitar'];
export const TIPOS_MOTIVO_API = ['legal', 'contractual', 'negocio', 'otro'];
export const TIPOS_REFERENCIA_API = ['analisis', 'plan'];
const VIAS = ['control', 'previsto'];
const BLOQUEOS = ['sin_filas', 'por_decidir', 'sin_motivo'];

const enumerado = (valores: string[]): Esquema => ({ type: 'string', enum: valores });

const PROPIEDADES_RIESGO: Record<string, Esquema> = {
  id: UUID,
  codigo: CODIGO_RIESGO,
  titulo: texto(120),
  descripcion: nulo(texto(1000)),
  probabilidad: entero(1, 5),
  impacto: entero(1, 5),
  puntaje: entero(1, 25),
  nivel: enumerado(NIVELES),
  decision: enumerado(DECISIONES),
  responsableId: nulo(texto(36, { format: 'uuid' })),
  estado: enumerado(['vigente', 'retirado']),
  version: entero(1),
};

export const RIESGO = objeto(PROPIEDADES_RIESGO);
export const RIESGOS = lista(RIESGO, 500);
export const RIESGO_LISTADO = objeto({
  ...PROPIEDADES_RIESGO,
  controles: entero(0, 50),
  tratamientosPrevistos: entero(0, 50),
  sinTratamiento: { type: 'boolean' },
});
export const RIESGOS_LISTADO = lista(RIESGO_LISTADO, 500);
export const RIESGO_DETALLE = objeto({
  ...PROPIEDADES_RIESGO,
  controles: lista(objeto({ id: UUID, codigo: CODIGO_CONTROL, nombre: texto(120), estado: enumerado(['vigente', 'retirado']) }), 50),
  tratamientosPrevistos: lista(objeto({ libreriaCodigo: texto(64), idEstable: texto(41), titulo: nulo(texto(200)) }), 50),
});
export const AVISO_RETIRO_RIESGO = objeto({
  riesgoId: UUID,
  codigo: CODIGO_RIESGO,
  controlesSinMotivo: lista(objeto({ libreriaCodigo: texto(64), idEstable: texto(41), titulo: texto(200) }), 500),
});
export const VINCULO_RESULTADO = objeto({ creado: { type: 'boolean' } });

export const MOTIVO = objeto({ libreriaCodigo: texto(64), idEstable: texto(41), tipo: enumerado(TIPOS_MOTIVO_API), nota: texto(500), version: entero(1) });
export const MOTIVOS = lista(MOTIVO, 500);
const FECHA = texto(10, { format: 'date' });
export const REFERENCIA = objeto({ tipo: enumerado(TIPOS_REFERENCIA_API), titulo: texto(120), versionDoc: texto(40), fecha: FECHA, ubicacion: texto(200), version: entero(1) });
export const REFERENCIAS = lista(REFERENCIA, 2);

const ESCALA = objeto({ escalaMax: entero(2, 10), corteMedio: entero(2, 100), corteAlto: entero(3, 100), corteCritico: entero(4, 100) });

/** `justificacion` del borrador (siempre presente). */
export const JUSTIFICACION_BORRADOR = objeto({
  conMotivo: entero(0),
  sinMotivo: entero(0),
  riesgosVigentes: entero(0),
  riesgosSinTratamiento: entero(0),
  bloqueos: lista(enumerado(BLOQUEOS), 3),
  filas: lista(
    objeto({
      libreriaCodigo: texto(64),
      idEstable: texto(41),
      sinMotivo: { type: 'boolean' },
      motivos: lista(objeto({ tipo: enumerado(TIPOS_MOTIVO_API), nota: texto(500) }), 4),
      riesgos: lista(objeto({ codigo: CODIGO_RIESGO, titulo: texto(120), nivel: enumerado(NIVELES), via: enumerado(VIAS) }), 500),
    }),
    500,
  ),
  referencias: REFERENCIAS,
  escala: ESCALA,
  faltaPlanTratamiento: { type: 'boolean' },
});

/** `justificacion` de una versión congelada; nula en las aprobadas antes de la Declaración justificada. */
export const JUSTIFICACION_VERSION = nulo(
  objeto({
    escala: ESCALA,
    conMotivo: entero(0),
    riesgosVigentes: entero(0),
    motivos: lista(objeto({ libreriaCodigo: texto(64), idEstable: texto(41), tipo: enumerado(TIPOS_MOTIVO_API), nota: texto(500) }), 500),
    riesgos: lista(
      objeto({
        codigo: CODIGO_RIESGO,
        titulo: texto(120),
        probabilidad: entero(1, 10),
        impacto: entero(1, 10),
        nivel: enumerado(NIVELES),
        decision: enumerado(DECISIONES),
        responsableId: nulo(texto(36, { format: 'uuid' })),
        controles: lista(texto(20), 50),
      }),
      500,
    ),
    riesgosPorFila: lista(objeto({ libreriaCodigo: texto(64), idEstable: texto(41), riesgoCodigo: CODIGO_RIESGO, via: enumerado(VIAS) }), 5000),
    referencias: lista(objeto({ tipo: enumerado(TIPOS_REFERENCIA_API), titulo: texto(120), versionDoc: texto(40), fecha: FECHA, ubicacion: texto(200) }), 2),
  }),
);
