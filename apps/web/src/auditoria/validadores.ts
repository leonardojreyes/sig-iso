// Validadores de las respuestas de la API de auditoría interna (ADR 040): forma EXACTA, tipos y topes del contrato.
import { booleano, entero, enLista, esObjeto, fecha, fechaHora, forma, lista, oNulo, texto, uuid } from './forma';
import {
  AVISOS_PROCESO,
  CAMBIOS_RELEVANTES,
  ESTADOS_AUDITORIA,
  ESTADOS_DIAGNOSTICO,
  ESTADOS_PROGRAMA,
  FRECUENCIAS,
  IMPORTANCIAS,
  MOTIVOS_ANULACION,
  MOTIVOS_CAMBIO,
  RELACIONES,
  RESULTADOS,
  ROLES_EQUIPO,
  TIPOS_HALLAZGO,
  type Auditoria,
  type DetallePrograma,
  type Independencia,
  type InformeAuditoria,
  type ListaHallazgos,
  type ListaProcesos,
  type ListaProgramas,
  type ListaRelaciones,
  type ListaVerificacion,
  type PanelAuditoria,
} from './tipos';

const NORMA = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const normas = lista(texto(80, NORMA), 10);
const cuenta = (claves: readonly string[]) => forma(Object.fromEntries(claves.map((k) => [k, entero()])));
const capitulo = forma({ libreriaCodigo: texto(80, NORMA), capitulo: texto(60, undefined, 1) });

const proceso = forma({
  id: uuid,
  codigo: texto(9, /^PR-\d{3,6}$/),
  nombre: texto(120, undefined, 1),
  descripcion: oNulo(texto(300, undefined, 1)),
  duenaId: uuid,
  importancia: enLista(IMPORTANCIAS),
  frecuencia: enLista(FRECUENCIAS),
  transversal: booleano,
  cambioRelevante: oNulo(enLista(CAMBIOS_RELEVANTES)),
  estado: enLista(['vigente', 'retirado']),
  version: entero(1),
  personasRelacionadas: entero(),
  avisos: lista(enLista(AVISOS_PROCESO), 2),
});
const programa = forma({
  id: uuid,
  anio: entero(2000, 2100),
  objetivo: texto(500, undefined, 1),
  estado: enLista(ESTADOS_PROGRAMA),
  aprobadoPor: oNulo(uuid),
  aprobadoEn: oNulo(fechaHora),
  version: entero(1),
  normas,
});
const miembro = forma({
  personaId: uuid,
  rol: enLista(ROLES_EQUIPO),
  excepcion: booleano,
  autoautorizada: booleano,
  excepcionMotivo: oNulo(texto(300, undefined, 1)),
  excepcionMedida: oNulo(texto(300, undefined, 1)),
  excepcionAutorizadaPor: oNulo(uuid),
});
const fila = forma({
  id: uuid,
  libreriaCodigo: texto(80, NORMA),
  idEstable: texto(80, undefined, 1),
  titulo: oNulo(texto(200)),
  guia: oNulo(texto(1000)),
  agrupador: oNulo(texto(60)),
  resultado: enLista(RESULTADOS),
  nota: oNulo(texto(500, undefined, 1)),
  version: entero(1),
  evaluadoPor: oNulo(uuid),
  evaluadoEn: oNulo(fechaHora),
  diagnostico: oNulo(enLista(ESTADOS_DIAGNOSTICO)),
  preguntas: lista(forma({ id: uuid, texto: texto(300, undefined, 1) }), 5),
});
const hallazgo = forma({
  id: uuid,
  codigo: texto(9, /^H-\d{3,6}$/),
  itemId: oNulo(uuid),
  tipo: enLista(TIPOS_HALLAZGO),
  procesoId: oNulo(uuid),
  libreriaCodigo: oNulo(texto(80, NORMA)),
  idEstable: oNulo(texto(80, undefined, 1)),
  enunciado: texto(500, undefined, 1),
  evidencia: texto(1000, undefined, 1),
  justificacionGravedad: oNulo(texto(500, undefined, 1)),
  estado: enLista(['abierto', 'anulado']),
  anulacionMotivo: oNulo(enLista(MOTIVOS_ANULACION)),
  registradoPor: uuid,
  version: entero(1),
});
const auditoria = forma({
  id: uuid,
  programaId: uuid,
  codigo: texto(12, /^AI-\d{4}-\d{2,3}$/),
  anio: entero(2000, 2100),
  objetivo: texto(500, undefined, 1),
  estado: enLista(ESTADOS_AUDITORIA),
  inicio: fecha,
  fin: fecha,
  reunionApertura: oNulo(fecha),
  reunionCierre: oNulo(fecha),
  reprogramaciones: entero(),
  cancelacionMotivo: oNulo(enLista(MOTIVOS_CAMBIO)),
  informeEmitidoEn: oNulo(fechaHora),
  cerradaEn: oNulo(fechaHora),
  version: entero(1),
  normas,
  combinada: booleano,
  procesosIds: lista(uuid, 200),
  procesosDelAlcance: lista(uuid, 201),
  capitulos: lista(capitulo, 100),
  equipo: lista(miembro, 20),
});

const como = <T>(v: Validador1, x: unknown): T | null => (v(x) ? (x as T) : null);
type Validador1 = (v: unknown) => boolean;

const listaProcesos = forma({ procesos: lista(proceso, 200), gestionSigVigente: booleano });
const listaRelaciones = forma({ relaciones: lista(forma({ procesoId: uuid, personaId: uuid, relacion: enLista(RELACIONES) }), 100) });
const listaProgramas = forma({ programas: lista(programa, 100) });
const detallePrograma = forma({
  programa,
  auditorias: lista(
    forma({
      id: uuid,
      codigo: texto(12, /^AI-\d{4}-\d{2,3}$/),
      objetivo: texto(500, undefined, 1),
      estado: enLista(ESTADOS_AUDITORIA),
      inicio: fecha,
      fin: fecha,
      trimestre: entero(1, 4),
      normas,
      combinada: booleano,
      procesosIds: lista(uuid, 200),
      liderId: oNulo(uuid),
    }),
    200,
  ),
  exclusiones: lista(
    forma({ id: uuid, tipo: enLista(['proceso', 'capitulo']), procesoId: oNulo(uuid), libreriaCodigo: oNulo(texto(80, NORMA)), capitulo: oNulo(texto(60, undefined, 1)), motivo: texto(300, undefined, 1) }),
    500,
  ),
  procesos: lista(
    forma({
      procesoId: uuid,
      codigo: texto(9, /^PR-\d{3,6}$/),
      nombre: texto(120, undefined, 1),
      importancia: enLista(IMPORTANCIAS),
      frecuencia: enLista(FRECUENCIAS),
      cambioRelevante: oNulo(enLista(CAMBIOS_RELEVANTES)),
      ultimaAuditoria: oNulo(fecha),
      hallazgosAbiertos: entero(),
      incluido: booleano,
    }),
    200,
  ),
  pendientes: forma({ procesos: lista(uuid, 200), capitulos: lista(capitulo, 500), procesosIncluidos: entero(), capitulosIncluidos: entero() }),
});
const independencia = forma({
  personaId: uuid,
  independiente: booleano,
  conflictos: lista(forma({ procesoId: uuid, relaciones: lista(enLista(RELACIONES), 4) }), 201),
  avisos: lista(forma({ procesoId: uuid, ultimaFecha: fecha }), 201),
  procesosDelAlcance: lista(uuid, 201),
});
const listaVerificacion = forma({
  auditoriaId: uuid,
  filas: lista(fila, 2000),
  avance: forma({ total: entero(), evaluadas: entero(), porResultado: cuenta(RESULTADOS) }),
});
const listaHallazgos = forma({ hallazgos: lista(hallazgo, 500), abiertos: cuenta(TIPOS_HALLAZGO) });
const panel = forma({
  programaAnio: oNulo(entero(2000, 2100)),
  prerrequisito: forma({
    cumple: booleano,
    auditoriasCerradas: entero(),
    brechas: forma({ clausulas: lista(texto(170), 2000), procesos: lista(uuid, 200), controles: lista(texto(170), 2000), sinDeclaracion: booleano }),
  }),
  cobertura12Meses: forma({
    clausulas: forma({ total: entero(), cubiertas: entero() }),
    controles: forma({ total: entero(), cubiertos: entero(), sinDeclaracion: booleano }),
    procesos: forma({ total: entero(), cubiertos: entero() }),
  }),
  auditorias: forma({ total: entero(), cerradas: entero(), porEstado: cuenta(ESTADOS_AUDITORIA) }),
});

export const validarListaProcesos = (v: unknown): ListaProcesos | null => como(listaProcesos, v);
export const validarListaRelaciones = (v: unknown): ListaRelaciones | null => como(listaRelaciones, v);
export const validarListaProgramas = (v: unknown): ListaProgramas | null => como(listaProgramas, v);
export const validarDetallePrograma = (v: unknown): DetallePrograma | null => como(detallePrograma, v);
export const validarAuditoria = (v: unknown): Auditoria | null => como(auditoria, v);
export const validarIndependencia = (v: unknown): Independencia | null => como(independencia, v);
export const validarListaVerificacion = (v: unknown): ListaVerificacion | null => como(listaVerificacion, v);
export const validarListaHallazgos = (v: unknown): ListaHallazgos | null => como(listaHallazgos, v);
export const validarPanel = (v: unknown): PanelAuditoria | null => como(panel, v);

/**
 * El informe: de la copia congelada la pantalla usa la conclusión, las limitaciones y los conteos; el resto (equipo, filas, hallazgos)
 * viaja completo en el Word. Se valida la envoltura exacta y esos tres campos; el resto de `contenido` no se lee.
 */
export const validarInforme = (v: unknown): InformeAuditoria | null => {
  if (!forma({ auditoriaId: uuid, codigo: texto(12, /^AI-\d{4}-\d{2,3}$/), huella: texto(64, /^[0-9a-f]{64}$/), emitidoPor: uuid, emitidoEn: fechaHora, contenido: esObjeto })(v)) return null;
  const x = v as Record<string, unknown>;
  const c = x.contenido as Record<string, unknown>;
  if (!texto(1000, undefined, 1)(c.conclusion) || !oNulo(texto(1000, undefined, 1))(c.limitaciones) || !cuenta([...RESULTADOS, 'total', 'cubiertas'])(c.conteos)) return null;
  return {
    auditoriaId: x.auditoriaId as string,
    codigo: x.codigo as string,
    huella: x.huella as string,
    emitidoPor: x.emitidoPor as string,
    emitidoEn: x.emitidoEn as string,
    conclusion: c.conclusion as string,
    limitaciones: c.limitaciones as string | null,
    conteos: c.conteos as InformeAuditoria['conteos'],
  };
};
