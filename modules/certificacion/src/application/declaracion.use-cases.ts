import { calcularCobertura } from '../domain/cobertura.js';
import { derivarDeclaracion, type Declaracion, type FilaDeclaracion, type ResumenDeclaracion } from '../domain/declaracion.js';
import { hoyEnEcuador } from '../domain/fechas.js';
import type { AutorizacionPort } from './autorizacion.port.js';
import type { CatalogoLecturaPort, EntradaCatalogo } from './catalogo-lectura.port.js';
import { exigirPermiso, identificadorDeNorma, identificar, validarUuid } from './comunes.js';
import type { ContextoCertificacion, Reloj } from './contexto.js';
import type { NuevoId } from './controles.use-cases.js';
import { ConflictoError, EntradaNoEncontradaError } from './errores.js';
import { TIPO_DOCUMENTO_WORD, type DocumentoDeclaracion, type GeneradorDocumentoPort } from './generador-documento.port.js';
import type { VersionDeclaracion } from './repositorios.port.js';
import type { UnidadDeTrabajoPort } from './unidad-de-trabajo.port.js';

type Unidad = UnidadDeTrabajoPort<ContextoCertificacion>;

/** La declaración de este MVP es la de ISO/IEC 27001: una fila por control del Anexo A de las librerías adoptadas. */
export const NORMA_DECLARACION = 'ISO/IEC 27001';
/** Tope de filas por respuesta (el contrato lo declara con `maxItems`). */
export const TOPE_DECLARACION = 500;
/** Versiones que devuelve el listado: las más recientes (el contrato declara el tope). */
export const TOPE_VERSIONES_DECLARACION = 100;

export interface VersionDeclaracionDto {
  readonly id: string;
  readonly numero: number;
  readonly total: number;
  readonly aplican: number;
  readonly noAplican: number;
  readonly sinControl: number;
  readonly aprobadaPor: string;
  readonly aprobadaEn: string;
}

export interface DeclaracionDto {
  readonly norma: string;
  /** La fecha de hoy en Ecuador con la que se calculó la cobertura. */
  readonly hoy: string;
  readonly resumen: ResumenSaliente;
  readonly filas: readonly FilaDeclaracion[];
  /** El alcance de la norma tal como está hoy (aprobado o no) y si está aprobado. */
  readonly alcance: { readonly texto: string; readonly aprobado: boolean } | null;
  /** La última versión aprobada, si hay. */
  readonly ultimaVersion: VersionDeclaracionDto | null;
}

export interface VersionConFilasDto extends VersionDeclaracionDto {
  readonly alcance: string | null;
  readonly filas: readonly FilaDeclaracion[];
}

export interface ExportacionDeclaracion {
  readonly nombre: string;
  readonly tipo: typeof TIPO_DOCUMENTO_WORD;
  readonly bytes: Uint8Array;
  readonly sha256: string;
}

const aDtoVersion = (v: VersionDeclaracion): VersionDeclaracionDto => ({ id: v.id, numero: v.numero, total: v.total, aplican: v.aplican, noAplican: v.noAplican, sinControl: v.sinControl, aprobadaPor: v.aprobadaPor, aprobadaEn: v.aprobadaEn.toISOString() });

/** Edición del Anexo A que cubre la declaración. Si se adoptara una librería de la edición 2013, sus controles NO entran (no se mezclan ediciones). */
export const EDICION_DECLARACION = '2022';

export const esDeLaDeclaracion = (e: EntradaCatalogo): boolean => e.tipo === 'control' && e.aplicaA.some((a) => a.norma === NORMA_DECLARACION && a.edicion === EDICION_DECLARACION);

/** Lo que se lee de la base para derivar la declaración. */
interface DatosLeidos {
  readonly evaluaciones: Awaited<ReturnType<ContextoCertificacion['evaluaciones']['listar']>>;
  readonly controles: Awaited<ReturnType<ContextoCertificacion['controles']['listar']>>;
  readonly mapeos: Awaited<ReturnType<ContextoCertificacion['mapeos']['listar']>>;
  readonly evidencias: Awaited<ReturnType<ContextoCertificacion['evidencias']['listarActivas']>>;
}

/**
 * Hacia afuera (contrato de la API y Word) sigue saliendo la forma de antes: la justificación (motivos y riesgos) la expondrán las
 * tareas 10 y 14 del spec «declaración justificada». Hasta entonces no se filtra nada de ella.
 */
/** Resumen que sale hoy hacia afuera: los cinco campos de antes. */
export type ResumenSaliente = Pick<ResumenDeclaracion, 'total' | 'aplican' | 'noAplican' | 'porDecidir' | 'sinControl' | 'aprobable'>;
const resumenAnterior = (r: ResumenDeclaracion): ResumenSaliente => ({ total: r.total, aplican: r.aplican, noAplican: r.noAplican, porDecidir: r.porDecidir, sinControl: r.sinControl, aprobable: r.aprobable });
const filaAnterior = (f: FilaDeclaracion): FilaDeclaracion => ({ libreriaCodigo: f.libreriaCodigo, idEstable: f.idEstable, orden: f.orden, titulo: f.titulo, grupo: f.grupo, aplicabilidad: f.aplicabilidad, implementacion: f.implementacion, justificacion: f.justificacion, controles: f.controles, cobertura: f.cobertura });

/** Une lo leído con el catálogo y deriva la declaración (cobertura de M4 incluida). Pura. */
const armar = (catalogo: readonly EntradaCatalogo[], d: DatosLeidos, hoy: string): Declaracion => {
  const noAplica = new Set(d.evaluaciones.filter((e) => e.estado === 'no_aplica').map((e) => e.clave));
  const cobertura = calcularCobertura({
    hoy,
    entradas: catalogo.map((e) => ({ libreriaCodigo: e.libreriaCodigo, idEstable: e.idEstable, normas: [NORMA_DECLARACION], noAplica: noAplica.has(`${e.libreriaCodigo}|${e.idEstable}`) })),
    controles: d.controles.map((c) => ({ id: c.id, vigente: c.vigente })),
    mapeos: d.mapeos.map((m) => ({ controlId: m.controlId, libreriaCodigo: m.libreriaCodigo, idEstable: m.idEstable })),
    evidencias: d.evidencias.map((e) => ({ controlId: e.controlId, activa: e.activa, vigenteHasta: e.vigenteHasta })),
  });
  return derivarDeclaracion({
    entradas: catalogo.map((e) => ({ libreriaCodigo: e.libreriaCodigo, idEstable: e.idEstable, orden: e.orden, titulo: e.titulo, grupo: e.grupo })),
    evaluaciones: d.evaluaciones.map((e) => ({ libreriaCodigo: e.libreriaCodigo, idEstable: e.idEstable, estado: e.estado, comentario: e.comentario })),
    controles: d.controles.map((c) => ({ id: c.id, codigo: c.codigo, vigente: c.vigente })),
    mapeos: d.mapeos.map((m) => ({ controlId: m.controlId, libreriaCodigo: m.libreriaCodigo, idEstable: m.idEstable })),
    cobertura: cobertura.entradas.map((x) => ({ libreriaCodigo: x.libreriaCodigo, idEstable: x.idEstable, estado: x.estado })),
  });
};

interface Borrador {
  readonly hoy: string;
  readonly declaracion: Declaracion;
  readonly alcance: { readonly texto: string; readonly aprobado: boolean } | null;
  readonly ultima: VersionDeclaracion | null;
}

/** Deriva la declaración con lo que hay hoy. Lee TODO dentro de una sola unidad de trabajo, para que sea coherente. */
const derivarBorrador = async (unidad: Unidad, catalogoPuerto: CatalogoLecturaPort, reloj: Reloj, empresaId: ReturnType<typeof identificar>['empresaId']): Promise<Borrador> => {
  const hoy = hoyEnEcuador(reloj());
  const catalogo = (await catalogoPuerto.listarEntradasVigentes(empresaId)).filter(esDeLaDeclaracion);
  if (catalogo.length > TOPE_DECLARACION) throw new Error(`El resultado supera el tope de ${TOPE_DECLARACION} filas del contrato`);
  const datos = await unidad.ejecutar(empresaId, async (c) => ({
    evaluaciones: await c.evaluaciones.listar(),
    controles: await c.controles.listar(),
    mapeos: await c.mapeos.listar(),
    evidencias: await c.evidencias.listarActivas(),
    alcance: await c.alcances.obtener(NORMA_DECLARACION),
    ultima: (await c.declaraciones.listarVersiones())[0] ?? null,
  }));
  const declaracion = armar(catalogo, datos, hoy);
  return { hoy, declaracion, alcance: datos.alcance ? { texto: datos.alcance.texto, aprobado: datos.alcance.aprobadoEn !== null } : null, ultima: datos.ultima };
};

/** El borrador: la declaración derivada con lo que hay hoy, más la última versión aprobada. Nada se guarda. */
export class ObtenerDeclaracionUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort, private readonly catalogo: CatalogoLecturaPort, private readonly reloj: Reloj) {}

  async ejecutar(entrada: { empresaId: string; usuarioId: string }): Promise<DeclaracionDto> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'declaracion.ver', empresaId);
    const b = await derivarBorrador(this.unidad, this.catalogo, this.reloj, empresaId);
    return { norma: NORMA_DECLARACION, hoy: b.hoy, resumen: resumenAnterior(b.declaracion.resumen), filas: b.declaracion.filas.map(filaAnterior), alcance: b.alcance, ultimaVersion: b.ultima ? aDtoVersion(b.ultima) : null };
  }
}

/** Aprueba: congela una versión nueva con lo derivado. Se rechaza (409 `incompleta`) si no hay filas o alguna sigue por decidir. */
export class AprobarDeclaracionUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort, private readonly catalogo: CatalogoLecturaPort, private readonly reloj: Reloj, private readonly nuevoId: NuevoId) {}

  async ejecutar(entrada: { empresaId: string; usuarioId: string }): Promise<VersionDeclaracionDto> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'declaracion.aprobar', empresaId);
    const catalogo = (await this.catalogo.listarEntradasVigentes(empresaId)).filter(esDeLaDeclaracion);
    if (catalogo.length === 0) throw new ConflictoError('incompleta');

    // Todo lo que se congela se lee y se guarda en LA MISMA unidad de trabajo: lo aprobado es lo que se leyó.
    return this.unidad.ejecutar(empresaId, async (c) => {
      const hoy = hoyEnEcuador(this.reloj());
      const evaluaciones = await c.evaluaciones.listar();
      const controles = await c.controles.listar();
      const mapeos = await c.mapeos.listar();
      const evidencias = await c.evidencias.listarActivas();
      const alcance = await c.alcances.obtener(NORMA_DECLARACION);
      const { filas, resumen } = armar(catalogo, { evaluaciones, controles, mapeos, evidencias }, hoy);
      if (!resumen.aprobable) throw new ConflictoError('incompleta');

      const version: VersionDeclaracion = {
        id: this.nuevoId(),
        numero: (await c.declaraciones.ultimoNumero()) + 1,
        alcanceTexto: alcance?.texto ?? null,
        total: resumen.total,
        aplican: resumen.aplican,
        noAplican: resumen.noAplican,
        sinControl: resumen.sinControl,
        aprobadaPor: usuarioId,
        aprobadaEn: this.reloj(),
      };
      if (!(await c.declaraciones.crear(version, filas))) throw new ConflictoError('version_distinta');
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'declaracion.aprobada',
        resultado: 'ok',
        objeto: `declaracion:v${version.numero}`,
        despues: { total: resumen.total, aplican: resumen.aplican, no_aplican: resumen.noAplican, sin_control: resumen.sinControl },
      });
      return aDtoVersion(version);
    });
  }
}

export class ListarVersionesDeclaracionUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort) {}

  async ejecutar(entrada: { empresaId: string; usuarioId: string }): Promise<readonly VersionDeclaracionDto[]> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'declaracion.ver', empresaId);
    return (await this.unidad.ejecutar(empresaId, (c) => c.declaraciones.listarVersiones())).slice(0, TOPE_VERSIONES_DECLARACION).map(aDtoVersion);
  }
}

export class ObtenerVersionDeclaracionUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort) {}

  async ejecutar(entrada: { empresaId: string; usuarioId: string; id: string }): Promise<VersionConFilasDto> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'declaracion.ver', empresaId);
    const id = validarUuid(entrada.id, 'id');
    const x = await this.unidad.ejecutar(empresaId, (c) => c.declaraciones.obtener(id));
    if (!x) throw new EntradaNoEncontradaError();
    return { ...aDtoVersion(x.version), alcance: x.version.alcanceTexto, filas: x.filas.map(filaAnterior) };
  }
}

/**
 * Exporta a Word el borrador (con el rótulo de preliminar) o una versión aprobada (siempre desde su copia congelada). La
 * exportación queda en la bitácora con la huella del documento ANTES de entregarlo: si no se puede registrar, no se entrega.
 */
export class ExportarDeclaracionUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort, private readonly catalogo: CatalogoLecturaPort, private readonly generador: GeneradorDocumentoPort, private readonly reloj: Reloj) {}

  async ejecutar(entrada: { empresaId: string; usuarioId: string; versionId?: string }): Promise<ExportacionDeclaracion> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'declaracion.exportar', empresaId);
    const versionId = entrada.versionId === undefined ? null : validarUuid(entrada.versionId, 'id');
    const hoy = hoyEnEcuador(this.reloj());

    let documento: DocumentoDeclaracion;
    let objeto: string;
    let nombre: string;
    const norma = identificadorDeNorma(NORMA_DECLARACION);
    if (versionId === null) {
      const b = await derivarBorrador(this.unidad, this.catalogo, this.reloj, empresaId);
      documento = { norma: NORMA_DECLARACION, preliminar: true, version: null, aprobadaEl: null, generadaEl: b.hoy, alcance: b.alcance?.texto ?? null, resumen: resumenAnterior(b.declaracion.resumen), filas: b.declaracion.filas.map(filaAnterior) };
      objeto = 'declaracion:borrador';
      nombre = `declaracion-${norma}-borrador.docx`;
    } else {
      const x = await this.unidad.ejecutar(empresaId, (c) => c.declaraciones.obtener(versionId));
      if (!x) throw new EntradaNoEncontradaError();
      const { version } = x;
      documento = {
        norma: NORMA_DECLARACION,
        preliminar: false,
        version: version.numero,
        aprobadaEl: hoyEnEcuador(version.aprobadaEn),
        generadaEl: hoy,
        alcance: version.alcanceTexto,
        resumen: { total: version.total, aplican: version.aplican, noAplican: version.noAplican, porDecidir: 0, sinControl: version.sinControl },
        filas: x.filas,
      };
      objeto = `declaracion:v${version.numero}`;
      nombre = `declaracion-${norma}-v${version.numero}.docx`;
    }

    const generado = await this.generador.generarDeclaracion(documento);
    await this.unidad.ejecutar(empresaId, (c) => c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'declaracion.exportada', resultado: 'ok', objeto, objetoVersion: generado.sha256 }));
    return { nombre, tipo: TIPO_DOCUMENTO_WORD, bytes: generado.bytes, sha256: generado.sha256 };
  }
}
