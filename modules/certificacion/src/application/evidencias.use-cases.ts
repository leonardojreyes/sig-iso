import type { Control } from '../domain/control.js';
import { calcularCobertura, type CoberturaEntrada, type ResumenCobertura } from '../domain/cobertura.js';
import { detectarTipoArchivo } from '../domain/deteccion-archivo.js';
import { ErrorCertificacion } from '../domain/errores.js';
import { EVIDENCIAS_ACTIVAS_POR_CONTROL_MAX, Evidencia, type EstadoEvidencia, type TipoEvidencia } from '../domain/evidencia.js';
import { hoyEnEcuador } from '../domain/fechas.js';
import { nombreDeDescarga, normalizarNombreArchivo, TAMANO_MAX_BYTES, type TipoArchivo } from '../domain/tipo-archivo.js';
import type { AlmacenArchivosPort, ArchivoTemporal } from './almacen-archivos.port.js';
import type { AutorizacionPort } from './autorizacion.port.js';
import type { CatalogoLecturaPort, EntradaCatalogo } from './catalogo-lectura.port.js';
import { exigirPermiso, identificar, validarNorma, validarUuid } from './comunes.js';
import type { ContextoCertificacion, Reloj } from './contexto.js';
import type { NuevoId } from './controles.use-cases.js';
import { ArchivoRechazadoError, ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError } from './errores.js';
import type { UnidadDeTrabajoPort } from './unidad-de-trabajo.port.js';

type Unidad = UnidadDeTrabajoPort<ContextoCertificacion>;

/**
 * Una subida a medias: el archivo ya se recibió, su tipo se decidió por el contenido y su huella está calculada, pero NO se tocó la
 * base de datos ni se confirmó el archivo. Quien la recibe debe llamar a `confirmar` (una transacción: fila, bitácora y renombrado)
 * o a `descartar` (borra el temporal). Existe para que una petición que resulta inválida después de recibir el archivo (por
 * ejemplo, con un segundo archivo) no deje efectos.
 */
export interface SubidaPendiente {
  confirmar(): Promise<EvidenciaDto>;
  descartar(): Promise<void>;
}

/** Tope de entradas por respuesta de cobertura (el contrato lo declara con `maxItems`). */
export const TOPE_COBERTURA = 500;

export interface EvidenciaDto {
  readonly id: string;
  readonly controlId: string;
  readonly tipo: TipoEvidencia;
  readonly titulo: string;
  readonly fechaHecho: string;
  readonly vigenteHasta: string | null;
  readonly estado: EstadoEvidencia;
  /** La evidencia a la que reemplazó, si es un reemplazo. */
  readonly reemplazaId: string | null;
  /** Activa y con la vigencia al día (según la fecha de Ecuador). */
  readonly vigente: boolean;
  /** Activa pero con la vigencia ya pasada. */
  readonly vencida: boolean;
  readonly creadaEn: string;
  readonly archivo: { readonly nombre: string; readonly tipo: TipoArchivo; readonly bytes: number; readonly sha256: string };
}

const aDto = (e: Evidencia, creadaEn: Date, hoy: string): EvidenciaDto => ({
  id: e.id,
  controlId: e.controlId,
  tipo: e.tipo,
  titulo: e.titulo,
  fechaHecho: e.fechaHecho,
  vigenteHasta: e.vigenteHasta,
  estado: e.estado,
  reemplazaId: e.reemplazaId,
  vigente: e.vigenteEn(hoy),
  vencida: e.vencidaEn(hoy),
  creadaEn: creadaEn.toISOString(),
  archivo: { nombre: e.archivo.nombre, tipo: e.archivo.tipo, bytes: e.archivo.bytes, sha256: e.archivo.sha256 },
});

/** Lo que el dominio llama «campo» y «motivo» se traduce a lo que entiende la API: el estado de la evidencia es un conflicto. */
const traducir = (e: unknown): never => {
  if (e instanceof ErrorCertificacion) {
    if (e.motivos.includes('no_activa')) throw new ConflictoError('no_activa');
    throw new ParametroInvalidoError(e.campo);
  }
  throw e;
};

// Archivo provisional que solo sirve para validar los datos de la evidencia ANTES de recibir un solo byte del archivo.
const PROVISIONAL = { id: '00000000-0000-4000-8000-000000000001', nombre: 'archivo', tipo: 'application/pdf', bytes: 1, sha256: '0'.repeat(64) } as const;

interface DatosEvidenciaEntrada {
  readonly tipo?: unknown;
  readonly titulo?: unknown;
  readonly fechaHecho?: unknown;
  readonly vigenteHasta?: unknown;
}

/** Valida tipo, título y fechas con las reglas del dominio y que el hecho no sea de una fecha futura. */
const validarDatos = (empresaId: Parameters<typeof Evidencia.crear>[0]['empresaId'], controlId: string, d: DatosEvidenciaEntrada, hoy: string): void => {
  try {
    const e = Evidencia.crear({ id: '00000000-0000-4000-8000-000000000002', empresaId, controlId, tipo: d.tipo as TipoEvidencia, titulo: d.titulo as string, fechaHecho: d.fechaHecho as string, vigenteHasta: d.vigenteHasta as string | null | undefined, archivo: PROVISIONAL });
    if (e.fechaHecho > hoy) throw new ErrorCertificacion('fechaHecho', ['en_el_futuro']);
  } catch (err) {
    traducir(err);
  }
};

/** El control debe existir y estar vigente. Devuelve el control; un control ajeno o inexistente es 404. */
const exigirControlVigente = async (c: ContextoCertificacion, controlId: string): Promise<Control> => {
  const control = await c.controles.obtener(controlId);
  if (!control) throw new EntradaNoEncontradaError();
  if (!control.vigente) throw new ConflictoError('retirado');
  return control;
};

export type Rechazo = 'tipo_no_permitido' | 'tamano_excedido' | 'firma_invalida';

/**
 * Recibe el flujo, calcula su huella y decide su tipo por el CONTENIDO. Si no se acepta deja el rechazo en la bitácora, borra lo
 * recibido y lanza `ArchivoRechazadoError`. Si todo va bien devuelve el temporal y el tipo detectado.
 */
export const recibirArchivo = async (
  almacen: AlmacenArchivosPort,
  unidad: Unidad,
  p: {
    empresaId: Parameters<AlmacenArchivosPort['guardarTemporal']>[0];
    usuarioId: string;
    controlCodigo: string;
    flujo: AsyncIterable<Uint8Array>;
    /** Qué hecho de bitácora deja un rechazo y sobre qué objeto (por omisión, una evidencia rechazada sobre su control). */
    rechazo?: { accion: 'evidencia.subida_rechazada' | 'version.subida_rechazada'; objeto: string };
  },
): Promise<{ temporal: ArchivoTemporal; tipo: TipoArchivo }> => {
  const registrarRechazo = (motivo: Rechazo, sha256?: string): Promise<void> =>
    unidad.ejecutar(p.empresaId, (c) =>
      c.bitacora.registrar({
        empresaId: p.empresaId,
        actor: { tipo: 'usuario', usuarioId: p.usuarioId },
        accion: p.rechazo?.accion ?? 'evidencia.subida_rechazada',
        resultado: 'rechazado',
        motivo,
        objeto: p.rechazo?.objeto ?? `control:${p.controlCodigo}`,
        ...(sha256 ? { objetoVersion: sha256 } : {}),
      }),
    );

  const guardado = await almacen.guardarTemporal(p.empresaId, p.flujo, TAMANO_MAX_BYTES);
  if (!guardado.ok) {
    await registrarRechazo('tamano_excedido');
    throw new ArchivoRechazadoError('tamano_excedido');
  }
  const { temporal } = guardado;
  try {
    const deteccion = await detectarTipoArchivo(await almacen.abrirLector(p.empresaId, temporal.id));
    if (!deteccion.ok) {
      await registrarRechazo(deteccion.motivo, temporal.sha256);
      throw new ArchivoRechazadoError(deteccion.motivo);
    }
    return { temporal, tipo: deteccion.tipo };
  } catch (e) {
    await almacen.descartar(p.empresaId, temporal.id).catch(() => undefined);
    throw e;
  }
};

export interface SubirEvidenciaEntrada extends DatosEvidenciaEntrada {
  readonly empresaId: string;
  readonly usuarioId: string;
  readonly controlId: string;
  /** El nombre que mandó el cliente: solo se conserva como etiqueta, ya normalizada. */
  readonly nombreOriginal?: unknown;
  readonly flujo: AsyncIterable<Uint8Array>;
}

/**
 * Sube una evidencia a un control vigente. Orden: permiso → datos → control → (solo entonces) recibir el archivo → tipo por el
 * contenido → UNA transacción con la fila, el hecho de bitácora y el renombrado del archivo. Si algo falla se descarta el temporal.
 */
export class SubirEvidenciaUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly almacen: AlmacenArchivosPort,
    private readonly reloj: Reloj,
    private readonly nuevoId: NuevoId,
  ) {}

  /** Atajo: recibe el archivo y confirma de una vez. */
  async ejecutar(entrada: SubirEvidenciaEntrada): Promise<EvidenciaDto> {
    return (await this.iniciar(entrada)).confirmar();
  }

  /** Decide permiso, datos y control, recibe el archivo, decide su tipo y lo deja pendiente. No toca la base de datos. */
  async iniciar(entrada: SubirEvidenciaEntrada): Promise<SubidaPendiente> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'evidencias.registrar', empresaId);
    const controlId = validarUuid(entrada.controlId, 'controlId');
    const hoy = hoyEnEcuador(this.reloj());
    validarDatos(empresaId, controlId, entrada, hoy);
    const control = await this.unidad.ejecutar(empresaId, (c) => exigirControlVigente(c, controlId));

    const { temporal, tipo } = await recibirArchivo(this.almacen, this.unidad, { empresaId, usuarioId, controlCodigo: control.codigo, flujo: entrada.flujo });
    let usada = false;
    const descartar = (): Promise<void> => this.almacen.descartar(empresaId, temporal.id).catch(() => undefined);
    return {
      confirmar: async () => {
        if (usada) throw new Error('La subida ya se confirmó o se descartó');
        usada = true;
        try {
          return await this.unidad.ejecutar(empresaId, async (c) => {
            await exigirControlVigente(c, controlId);
            if ((await c.evidencias.contarActivas(controlId)) >= EVIDENCIAS_ACTIVAS_POR_CONTROL_MAX) throw new ConflictoError('tope_de_evidencias');
            const ahora = this.reloj();
            let evidencia: Evidencia;
            try {
              evidencia = Evidencia.crear({
                id: this.nuevoId(),
                empresaId,
                controlId,
                tipo: entrada.tipo as TipoEvidencia,
                titulo: entrada.titulo as string,
                fechaHecho: entrada.fechaHecho as string,
                vigenteHasta: entrada.vigenteHasta as string | null | undefined,
                archivo: { id: this.nuevoId(), nombre: normalizarNombreArchivo(entrada.nombreOriginal), tipo, bytes: temporal.bytes, sha256: temporal.sha256 },
              });
            } catch (e) {
              return traducir(e);
            }
            if (!(await c.evidencias.crear(evidencia, usuarioId, ahora))) throw new ConflictoError('archivo_repetido');
            await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'evidencia.creada', resultado: 'ok', objeto: `evidencia:${evidencia.id}`, objetoVersion: temporal.sha256 });
            // Último paso antes de confirmar: si el renombrado falla, la fila se deshace (ADR 032).
            await this.almacen.confirmar(empresaId, temporal.id, evidencia.archivo.id);
            return aDto(evidencia, ahora, hoy);
          });
        } catch (e) {
          await descartar();
          throw e;
        }
      },
      descartar: async () => {
        if (usada) return;
        usada = true;
        await descartar();
      },
    };
  }
}

export interface ReemplazarEvidenciaEntrada extends DatosEvidenciaEntrada {
  readonly empresaId: string;
  readonly usuarioId: string;
  readonly id: string;
  readonly nombreOriginal?: unknown;
  readonly flujo: AsyncIterable<Uint8Array>;
}

/**
 * Reemplaza una evidencia ACTIVA por otra con un archivo nuevo: la anterior queda «reemplazada» (con su archivo intacto) y la nueva
 * apunta a ella. El título y el tipo se heredan si no se indican; la fecha del hecho es obligatoria.
 */
export class ReemplazarEvidenciaUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly almacen: AlmacenArchivosPort,
    private readonly reloj: Reloj,
    private readonly nuevoId: NuevoId,
  ) {}

  /** Atajo: recibe el archivo y confirma de una vez. */
  async ejecutar(entrada: ReemplazarEvidenciaEntrada): Promise<EvidenciaDto> {
    return (await this.iniciar(entrada)).confirmar();
  }

  /** Decide permiso, datos y evidencia, recibe el archivo, decide su tipo y lo deja pendiente. No toca la base de datos. */
  async iniciar(entrada: ReemplazarEvidenciaEntrada): Promise<SubidaPendiente> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'evidencias.registrar', empresaId);
    const id = validarUuid(entrada.id, 'id');
    const hoy = hoyEnEcuador(this.reloj());

    const previa = await this.unidad.ejecutar(empresaId, async (c) => {
      const fila = await c.evidencias.obtener(id);
      if (!fila) throw new EntradaNoEncontradaError();
      if (!fila.evidencia.activa) throw new ConflictoError('no_activa');
      return { evidencia: fila.evidencia, control: await exigirControlVigente(c, fila.evidencia.controlId) };
    });
    const datos = { tipo: entrada.tipo ?? previa.evidencia.tipo, titulo: entrada.titulo ?? previa.evidencia.titulo, fechaHecho: entrada.fechaHecho, vigenteHasta: entrada.vigenteHasta };
    validarDatos(empresaId, previa.evidencia.controlId, datos, hoy);

    const { temporal, tipo } = await recibirArchivo(this.almacen, this.unidad, { empresaId, usuarioId, controlCodigo: previa.control.codigo, flujo: entrada.flujo });
    let usada = false;
    const descartar = (): Promise<void> => this.almacen.descartar(empresaId, temporal.id).catch(() => undefined);
    return {
      confirmar: async () => {
        if (usada) throw new Error('La subida ya se confirmó o se descartó');
        usada = true;
        try {
          return await this.unidad.ejecutar(empresaId, async (c) => {
            const fila = await c.evidencias.obtener(id);
            if (!fila) throw new EntradaNoEncontradaError();
            await exigirControlVigente(c, fila.evidencia.controlId);
            const ahora = this.reloj();
            let reemplazada: Evidencia;
            let nueva: Evidencia;
            try {
              reemplazada = fila.evidencia.marcarReemplazada();
              nueva = Evidencia.crear({
                id: this.nuevoId(),
                empresaId,
                controlId: fila.evidencia.controlId,
                tipo: datos.tipo as TipoEvidencia,
                titulo: datos.titulo as string,
                fechaHecho: datos.fechaHecho as string,
                vigenteHasta: datos.vigenteHasta as string | null | undefined,
                reemplazaId: fila.evidencia.id,
                archivo: { id: this.nuevoId(), nombre: normalizarNombreArchivo(entrada.nombreOriginal), tipo, bytes: temporal.bytes, sha256: temporal.sha256 },
              });
            } catch (e) {
              return traducir(e);
            }
            if (!(await c.evidencias.cambiarEstado(reemplazada, usuarioId, ahora))) throw new ConflictoError('no_activa');
            if (!(await c.evidencias.crear(nueva, usuarioId, ahora))) throw new ConflictoError('archivo_repetido');
            await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'evidencia.reemplazada', resultado: 'ok', objeto: `evidencia:${nueva.id}`, objetoVersion: temporal.sha256 });
            await this.almacen.confirmar(empresaId, temporal.id, nueva.archivo.id);
            return aDto(nueva, ahora, hoy);
          });
        } catch (e) {
          await descartar();
          throw e;
        }
      },
      descartar: async () => {
        if (usada) return;
        usada = true;
        await descartar();
      },
    };
  }
}

/** Elimina una evidencia ACTIVA (solo administradores): cambia su estado y queda el rastro. El archivo no se borra. */
export class EliminarEvidenciaUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort, private readonly reloj: Reloj) {}

  async ejecutar(entrada: { empresaId: string; usuarioId: string; id: string }): Promise<void> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'evidencias.eliminar', empresaId);
    const id = validarUuid(entrada.id, 'id');
    await this.unidad.ejecutar(empresaId, async (c) => {
      const fila = await c.evidencias.obtener(id);
      if (!fila) throw new EntradaNoEncontradaError();
      let eliminada: Evidencia;
      try {
        eliminada = fila.evidencia.marcarEliminada();
      } catch (e) {
        return traducir(e);
      }
      if (!(await c.evidencias.cambiarEstado(eliminada, usuarioId, this.reloj()))) throw new ConflictoError('no_activa');
      await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'evidencia.eliminada', resultado: 'ok', objeto: `evidencia:${id}`, objetoVersion: fila.evidencia.archivo.sha256 });
    });
  }
}

export interface ListarEvidenciasEntrada {
  readonly empresaId: string;
  readonly usuarioId: string;
  readonly controlId: string;
  /** Por omisión solo las activas; con `true` también las reemplazadas y eliminadas. */
  readonly incluirHistoricas?: boolean;
}

/** Las evidencias de un control de la empresa, de la más nueva a la más antigua. */
export class ListarEvidenciasUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort, private readonly reloj: Reloj) {}

  async ejecutar(entrada: ListarEvidenciasEntrada): Promise<EvidenciaDto[]> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'evidencias.ver', empresaId);
    const controlId = validarUuid(entrada.controlId, 'controlId');
    if (entrada.incluirHistoricas !== undefined && typeof entrada.incluirHistoricas !== 'boolean') throw new ParametroInvalidoError('incluirHistoricas');
    const hoy = hoyEnEcuador(this.reloj());
    const filas = await this.unidad.ejecutar(empresaId, async (c) => {
      if (!(await c.controles.obtener(controlId))) throw new EntradaNoEncontradaError();
      return c.evidencias.listarDeControl(controlId, entrada.incluirHistoricas === true);
    });
    return filas.map((f) => aDto(f.evidencia, f.creadaEn, hoy));
  }
}

export interface DescargaEvidencia {
  /** Nombre con la extensión del tipo detectado. */
  readonly nombre: string;
  readonly tipo: TipoArchivo;
  readonly bytes: number;
  readonly sha256: string;
  readonly flujo: AsyncIterable<Uint8Array>;
}

/**
 * Entrega el archivo de una evidencia. La descarga se registra ANTES de abrir el archivo y, si no se puede registrar, no se
 * entrega nada (falla cerrada). Una evidencia eliminada no se descarga; una reemplazada sí (es el historial).
 */
export class DescargarEvidenciaUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort, private readonly almacen: AlmacenArchivosPort) {}

  async ejecutar(entrada: { empresaId: string; usuarioId: string; id: string }): Promise<DescargaEvidencia> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'evidencias.ver', empresaId);
    const id = validarUuid(entrada.id, 'id');
    const evidencia = await this.unidad.ejecutar(empresaId, async (c) => {
      const fila = await c.evidencias.obtener(id);
      if (!fila || fila.evidencia.estado === 'eliminada') throw new EntradaNoEncontradaError();
      await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'evidencia.descargada', resultado: 'ok', objeto: `evidencia:${id}`, objetoVersion: fila.evidencia.archivo.sha256 });
      return fila.evidencia;
    });
    const { archivo } = evidencia;
    return { nombre: nombreDeDescarga(archivo.nombre, archivo.tipo), tipo: archivo.tipo, bytes: archivo.bytes, sha256: archivo.sha256, flujo: await this.almacen.abrir(empresaId, archivo.id) };
  }
}

export interface CoberturaEntradaDto extends CoberturaEntrada {
  readonly tipo: 'clausula' | 'control';
  readonly capitulo: number | null;
  readonly grupo: string | null;
  readonly titulo: string;
  readonly normas: readonly string[];
}

export interface CoberturaDto {
  /** La fecha de hoy en Ecuador con la que se calculó el vencimiento. */
  readonly hoy: string;
  readonly entradas: readonly CoberturaEntradaDto[];
  readonly porNorma: readonly (ResumenCobertura & { readonly norma: string })[];
  readonly total: ResumenCobertura;
  /** Normas de las librerías adoptadas, para el selector. */
  readonly normas: readonly string[];
}

/** Cobertura documental de las entradas de las normas adoptadas: qué respaldan los controles con evidencia vigente. */
export class ListarCoberturaUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort, private readonly catalogo: CatalogoLecturaPort, private readonly reloj: Reloj) {}

  async ejecutar(entrada: { empresaId: string; usuarioId: string; norma?: string }): Promise<CoberturaDto> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'evidencias.ver', empresaId);
    const norma = entrada.norma === undefined ? null : validarNorma(entrada.norma);
    const hoy = hoyEnEcuador(this.reloj());

    const catalogo = await this.catalogo.listarEntradasVigentes(empresaId);
    const { evaluaciones, controles, mapeos, evidencias } = await this.unidad.ejecutar(empresaId, async (c) => ({
      evaluaciones: await c.evaluaciones.listar(),
      controles: await c.controles.listar(),
      mapeos: await c.mapeos.listar(),
      evidencias: await c.evidencias.listarActivas(),
    }));
    const noAplica = new Set(evaluaciones.filter((e) => e.estado === 'no_aplica').map((e) => e.clave));
    const normas = [...new Set(catalogo.flatMap((e) => e.aplicaA.map((a) => a.norma)))].sort((a, b) => a.localeCompare(b, 'es'));
    const delCatalogo: readonly EntradaCatalogo[] = norma === null ? catalogo : catalogo.filter((e) => e.aplicaA.some((a) => a.norma === norma));
    if (delCatalogo.length > TOPE_COBERTURA) throw new Error(`El resultado supera el tope de ${TOPE_COBERTURA} entradas del contrato`);

    const cobertura = calcularCobertura({
      hoy,
      entradas: delCatalogo.map((e) => ({ libreriaCodigo: e.libreriaCodigo, idEstable: e.idEstable, normas: e.aplicaA.map((a) => a.norma), noAplica: noAplica.has(`${e.libreriaCodigo}|${e.idEstable}`) })),
      controles: controles.map((c) => ({ id: c.id, vigente: c.vigente })),
      mapeos: mapeos.map((m) => ({ controlId: m.controlId, libreriaCodigo: m.libreriaCodigo, idEstable: m.idEstable })),
      evidencias: evidencias.map((e) => ({ controlId: e.controlId, activa: e.activa, vigenteHasta: e.vigenteHasta })),
    });
    const entradas = cobertura.entradas.map((r, i): CoberturaEntradaDto => {
      const e = delCatalogo[i] as EntradaCatalogo;
      return { ...r, tipo: e.tipo, capitulo: e.capitulo, grupo: e.grupo, titulo: e.titulo, normas: e.aplicaA.map((a) => a.norma) };
    });
    return { hoy, entradas, porNorma: Object.entries(cobertura.porNorma).map(([n, r]) => ({ norma: n, ...r })), total: cobertura.total, normas };
  }
}
