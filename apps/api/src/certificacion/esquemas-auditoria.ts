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

const NORMA = texto(80, { pattern: '^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$' });
const FECHA = texto(10, { format: 'date' });
const ESTADOS_AUDITORIA_API = ['planificada', 'en_preparacion', 'en_ejecucion', 'informe_emitido', 'cerrada', 'cancelada'];

export const PROGRAMA = objeto({
  id: UUID,
  anio: entero(2000, 2100),
  objetivo: texto(500),
  estado: enumerado(['sin_aprobar', 'aprobado']),
  aprobadoPor: oUnNulo(UUID),
  aprobadoEn: oUnNulo(texto(40, { format: 'date-time' })),
  version: entero(1),
  normas: lista(NORMA, 10),
});
export const LISTA_PROGRAMAS = objeto({ programas: lista(PROGRAMA, 100) });
export const EXCLUSION_PROGRAMA = objeto({
  id: UUID,
  tipo: enumerado(['proceso', 'capitulo']),
  procesoId: oUnNulo(UUID),
  libreriaCodigo: oUnNulo(NORMA),
  capitulo: nulo(texto(60)),
  motivo: texto(300),
});
export const DETALLE_PROGRAMA = objeto({
  programa: PROGRAMA,
  auditorias: lista(
    objeto({
      id: UUID,
      codigo: texto(12, { pattern: '^AI-[0-9]{4}-[0-9]{2,3}$' }),
      objetivo: texto(500),
      estado: enumerado(ESTADOS_AUDITORIA_API),
      inicio: FECHA,
      fin: FECHA,
      trimestre: entero(1, 4),
      normas: lista(NORMA, 10),
      combinada: { type: 'boolean' },
      procesosIds: lista(UUID, 200),
      liderId: oUnNulo(UUID),
    }),
    200,
  ),
  exclusiones: lista(EXCLUSION_PROGRAMA, 500),
  procesos: lista(
    objeto({
      procesoId: UUID,
      codigo: texto(9, { pattern: '^PR-[0-9]{3,6}$' }),
      nombre: texto(120),
      importancia: enumerado(IMPORTANCIAS_API),
      frecuencia: enumerado(FRECUENCIAS_API),
      cambioRelevante: oUnNulo(enumerado(CAMBIOS_RELEVANTES_API)),
      ultimaAuditoria: oUnNulo(FECHA),
      hallazgosAbiertos: entero(0),
      incluido: { type: 'boolean' },
    }),
    200,
  ),
  pendientes: objeto({
    procesos: lista(UUID, 200),
    capitulos: lista(objeto({ libreriaCodigo: NORMA, capitulo: texto(60) }), 500),
    procesosIncluidos: entero(0),
    capitulosIncluidos: entero(0),
  }),
});
export const TIPOS_EXCLUSION_API = ['proceso', 'capitulo'];

const MIEMBRO = objeto({
  personaId: UUID,
  rol: enumerado(['lider', 'auditor']),
  excepcion: { type: 'boolean' },
  autoautorizada: { type: 'boolean' },
  excepcionMotivo: nulo(texto(300)),
  excepcionMedida: nulo(texto(300)),
  excepcionAutorizadaPor: oUnNulo(UUID),
});
export const MIEMBRO_EQUIPO = MIEMBRO;
export const MOTIVOS_CAMBIO_API = ['sin_recursos', 'cambio_de_alcance', 'reprogramada', 'otro'];
export const AUDITORIA = objeto({
  id: UUID,
  programaId: UUID,
  codigo: texto(12, { pattern: '^AI-[0-9]{4}-[0-9]{2,3}$' }),
  anio: entero(2000, 2100),
  objetivo: texto(500),
  estado: enumerado(ESTADOS_AUDITORIA_API),
  inicio: FECHA,
  fin: FECHA,
  reunionApertura: oUnNulo(FECHA),
  reunionCierre: oUnNulo(FECHA),
  reprogramaciones: entero(0),
  cancelacionMotivo: oUnNulo(enumerado(MOTIVOS_CAMBIO_API)),
  informeEmitidoEn: oUnNulo(texto(40, { format: 'date-time' })),
  cerradaEn: oUnNulo(texto(40, { format: 'date-time' })),
  version: entero(1),
  normas: lista(NORMA, 10),
  combinada: { type: 'boolean' },
  procesosIds: lista(UUID, 200),
  procesosDelAlcance: lista(UUID, 201),
  capitulos: lista(objeto({ libreriaCodigo: NORMA, capitulo: texto(60, { minLength: 1 }) }), 100),
  equipo: lista(MIEMBRO, 20),
});
export const INDEPENDENCIA = objeto({
  personaId: UUID,
  independiente: { type: 'boolean' },
  conflictos: lista(objeto({ procesoId: UUID, relaciones: lista(enumerado(RELACIONES_API), 4) }), 201),
  avisos: lista(objeto({ procesoId: UUID, ultimaFecha: FECHA }), 201),
  procesosDelAlcance: lista(UUID, 201),
});
export const ROLES_EQUIPO_API = ['lider', 'auditor'];
export const ESTADOS_AVANCE_API = ['en_preparacion', 'en_ejecucion'];

// --- Lista de verificación, hallazgos, informe y panel ---------------------------------------------------------------------------------
const FECHA_HORA = texto(40, { format: 'date-time' });
const RESULTADOS_API = ['por_evaluar', 'conforme', 'no_conforme', 'observacion', 'oportunidad', 'no_aplica', 'no_verificado'];
export const TIPOS_HALLAZGO_API = ['nc_mayor', 'nc_menor', 'observacion', 'oportunidad'];
export const MOTIVOS_ANULACION_API = ['duplicado', 'error_de_registro', 'otro'];
const conteo = (claves: string[]): Esquema => objeto(Object.fromEntries(claves.map((k) => [k, entero(0)])));
const ESTADOS_DIAGNOSTICO_API = ['cumple', 'parcial', 'no_cumple', 'no_aplica'];

export const PREGUNTA_LISTA = objeto({ id: UUID, texto: texto(300) });
export const FILA_LISTA = objeto({
  id: UUID,
  libreriaCodigo: NORMA,
  idEstable: texto(80),
  titulo: nulo(texto(200)),
  guia: nulo(texto(1000)),
  agrupador: nulo(texto(60)),
  resultado: enumerado(RESULTADOS_API),
  nota: nulo(texto(500)),
  version: entero(1),
  evaluadoPor: oUnNulo(UUID),
  evaluadoEn: oUnNulo(FECHA_HORA),
  diagnostico: oUnNulo(enumerado(ESTADOS_DIAGNOSTICO_API)),
  preguntas: lista(PREGUNTA_LISTA, 5),
});
export const LISTA_VERIFICACION = objeto({
  auditoriaId: UUID,
  filas: lista(FILA_LISTA, 2000),
  avance: objeto({ total: entero(0), evaluadas: entero(0), porResultado: conteo(RESULTADOS_API) }),
});
export const REGENERACION_LISTA = conteo(['total', 'agregadas', 'quitadas', 'conservadas', 'conservadasFueraDeAlcance']);

export const HALLAZGO = objeto({
  id: UUID,
  codigo: texto(9, { pattern: '^H-[0-9]{3,6}$' }),
  itemId: oUnNulo(UUID),
  tipo: enumerado(TIPOS_HALLAZGO_API),
  procesoId: oUnNulo(UUID),
  libreriaCodigo: oUnNulo(NORMA),
  idEstable: nulo(texto(80)),
  enunciado: texto(500),
  evidencia: texto(1000),
  justificacionGravedad: nulo(texto(500)),
  estado: enumerado(['abierto', 'anulado']),
  anulacionMotivo: oUnNulo(enumerado(MOTIVOS_ANULACION_API)),
  registradoPor: UUID,
  version: entero(1),
});
export const LISTA_HALLAZGOS = objeto({ hallazgos: lista(HALLAZGO, 500), abiertos: conteo(TIPOS_HALLAZGO_API) });

const CONTENIDO_INFORME = objeto({
  version: entero(1),
  auditoria: objeto({
    codigo: texto(12),
    anio: { type: 'integer' },
    objetivo: texto(500),
    inicio: FECHA,
    fin: FECHA,
    reunionApertura: oUnNulo(FECHA),
    reunionCierre: oUnNulo(FECHA),
    combinada: { type: 'boolean' },
    normas: lista(NORMA, 10),
    capitulos: lista(objeto({ libreriaCodigo: NORMA, capitulo: texto(60, { minLength: 1 }) }), 100),
    procesos: lista(objeto({ codigo: texto(9), nombre: texto(120), transversal: { type: 'boolean' } }), 201),
  }),
  programa: objeto({ anio: { type: 'integer' }, objetivo: texto(500) }),
  equipo: lista(
    objeto({
      personaId: UUID,
      nombre: texto(120),
      rol: enumerado(['lider', 'auditor']),
      excepcion: { type: 'boolean' },
      autoautorizada: { type: 'boolean' },
      excepcionMotivo: nulo(texto(300)),
      excepcionMedida: nulo(texto(300)),
    }),
    20,
  ),
  conteos: conteo([...RESULTADOS_API, 'total', 'cubiertas']),
  filas: lista(objeto({ libreriaCodigo: NORMA, idEstable: texto(80), titulo: nulo(texto(200)), resultado: enumerado(RESULTADOS_API), nota: nulo(texto(500)) }), 2000),
  noVerificadas: lista(objeto({ libreriaCodigo: NORMA, idEstable: texto(80), nota: nulo(texto(500)) }), 2000),
  hallazgos: lista(
    objeto({
      codigo: texto(9),
      tipo: enumerado(TIPOS_HALLAZGO_API),
      proceso: nulo(texto(9)),
      requisito: nulo(texto(170)),
      enunciado: texto(500),
      evidencia: texto(1000),
      justificacionGravedad: nulo(texto(500)),
      estado: enumerado(['abierto', 'anulado']),
    }),
    500,
  ),
  conclusion: texto(1000),
  limitaciones: nulo(texto(1000)),
  emitidoPor: objeto({ personaId: UUID, nombre: texto(120) }),
  emitidoEn: FECHA_HORA,
});
export const INFORME_AUDITORIA = objeto({
  auditoriaId: UUID,
  codigo: texto(12, { pattern: '^AI-[0-9]{4}-[0-9]{2,3}$' }),
  huella: texto(64, { pattern: '^[0-9a-f]{64}$' }),
  emitidoPor: UUID,
  emitidoEn: FECHA_HORA,
  contenido: CONTENIDO_INFORME,
});
export const CIERRE_AUDITORIA = objeto({ id: UUID, codigo: texto(12), estado: enumerado(ESTADOS_AUDITORIA_API), cerradaEn: FECHA_HORA, version: entero(1) });
export const PANEL_AUDITORIA = objeto({
  programaAnio: { type: 'integer', nullable: true },
  prerrequisito: objeto({
    cumple: { type: 'boolean' },
    auditoriasCerradas: entero(0),
    brechas: objeto({ clausulas: lista(texto(170), 2000), procesos: lista(UUID, 200), controles: lista(texto(170), 2000), sinDeclaracion: { type: 'boolean' } }),
  }),
  cobertura12Meses: objeto({
    clausulas: objeto({ total: entero(0), cubiertas: entero(0) }),
    controles: objeto({ total: entero(0), cubiertos: entero(0), sinDeclaracion: { type: 'boolean' } }),
    procesos: objeto({ total: entero(0), cubiertos: entero(0) }),
  }),
  auditorias: objeto({ total: entero(0), cerradas: entero(0), porEstado: conteo(ESTADOS_AUDITORIA_API) }),
});
