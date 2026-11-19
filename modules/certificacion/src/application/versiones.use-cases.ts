import {
  aprobar as aprobarVersionDominio,
  descartarBorrador,
  devolverABorrador,
  enviarARevision,
  puedeNombrarseAprobador,
  unAnioDespues,
  validarFechaRevision,
  validarNotaVersion,
} from '../domain/documento.js';
import { hoyEnEcuador } from '../domain/fechas.js';
import { nombreDeDescarga, normalizarNombreArchivo, type TipoArchivo } from '../domain/tipo-archivo.js';
import type { AlmacenArchivosPort } from './almacen-archivos.port.js';
import type { AutorizacionPort } from './autorizacion.port.js';
import { exigirPermiso, identificar, validarUuid } from './comunes.js';
import type { ContextoCertificacion, Reloj } from './contexto.js';
import type { NuevoId } from './controles.use-cases.js';
import type { FilaVersion, LecturaPendiente } from './documentos.port.js';
import {
  administradoresActivos,
  aDtoVersion,
  exigirDocumentoActivo,
  exigirPersonaActiva,
  traducirDominio,
  type VersionDto,
} from './documentos.use-cases.js';
import { recibirArchivo } from './evidencias.use-cases.js';
import { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError, SinPermisoError } from './errores.js';
import type { UnidadDeTrabajoPort } from './unidad-de-trabajo.port.js';

type Unidad = UnidadDeTrabajoPort<ContextoCertificacion>;

/** Una versión «abierta» está en borrador o en revisión: solo puede haber una a la vez por documento. */
const ESTADOS_ABIERTOS: readonly string[] = ['borrador', 'en_revision'];

/**
 * Una subida a medias: el archivo ya se recibió y su tipo se decidió por el contenido, pero NO se tocó la base de datos. Quien la
 * recibe debe llamar a `confirmar` (una transacción: fila, bitácora y renombrado) o a `descartar`.
 */
export interface SubidaVersionPendiente {
  confirmar(): Promise<VersionDto>;
  descartar(): Promise<void>;
}

const etiqueta = (codigo: string, numero: number): string => `version:${codigo}.v${numero}`;

const exigirVersion = async (c: ContextoCertificacion, id: string): Promise<FilaVersion> => {
  const v = await c.versionesDocumento.obtener(id);
  if (!v) throw new EntradaNoEncontradaError();
  return v;
};

const dto = (v: FilaVersion, ahora: Date): VersionDto => aDtoVersion(v, { hoy: hoyEnEcuador(ahora), aniosRetencion: null, lecturas: null });

export interface SubirVersionEntrada {
  readonly empresaId: string;
  readonly usuarioId: string;
  readonly documentoId: string;
  readonly nota?: unknown;
  /** El nombre que mandó el cliente: solo se conserva como etiqueta, ya normalizada. */
  readonly nombreOriginal?: unknown;
  readonly flujo: AsyncIterable<Uint8Array>;
}

/**
 * Sube una versión nueva (borrador) de un documento activo. Orden: permiso → datos → documento → (solo entonces) recibir el archivo →
 * tipo por el contenido → UNA transacción con la fila, el hecho de bitácora y el renombrado. Solo hay una versión abierta a la vez.
 */
export class SubirVersionUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly almacen: AlmacenArchivosPort,
    private readonly reloj: Reloj,
    private readonly nuevoId: NuevoId,
  ) {}

  async ejecutar(e: SubirVersionEntrada): Promise<VersionDto> {
    return (await this.iniciar(e)).confirmar();
  }

  async iniciar(e: SubirVersionEntrada): Promise<SubidaVersionPendiente> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'documentos.redactar', empresaId);
    const documentoId = validarUuid(e.documentoId, 'documentoId');
    const nota = traducirDominio(() => validarNotaVersion(e.nota));
    const documento = await this.unidad.ejecutar(empresaId, async (c) => {
      const d = await exigirDocumentoActivo(c, documentoId);
      if ((await c.versionesDocumento.listarDeDocumento(documentoId)).some((v) => ESTADOS_ABIERTOS.includes(v.estado)))
        throw new ConflictoError('version_abierta');
      return d;
    });

    const { temporal, tipo } = await recibirArchivo(this.almacen, this.unidad, {
      empresaId,
      usuarioId,
      controlCodigo: documento.codigo,
      flujo: e.flujo,
      rechazo: { accion: 'version.subida_rechazada', objeto: `documento:${documento.codigo}` },
    });
    let usada = false;
    const descartar = (): Promise<void> => this.almacen.descartar(empresaId, temporal.id).catch(() => undefined);
    return {
      confirmar: async () => {
        if (usada) throw new Error('La subida ya se confirmó o se descartó');
        usada = true;
        try {
          return await this.unidad.ejecutar(empresaId, async (c) => {
            // Primero se bloquea el documento (siguienteNumero toma el bloqueo): dos subidas a la vez se turnan y la segunda ve la primera.
            const numero = await c.versionesDocumento.siguienteNumero(documentoId);
            const d = await exigirDocumentoActivo(c, documentoId);
            if ((await c.versionesDocumento.listarDeDocumento(documentoId)).some((v) => ESTADOS_ABIERTOS.includes(v.estado)))
              throw new ConflictoError('version_abierta');
            const ahora = this.reloj();
            const id = this.nuevoId();
            const archivo = {
              id: this.nuevoId(),
              nombre: normalizarNombreArchivo(e.nombreOriginal),
              tipo: tipo as TipoArchivo,
              bytes: temporal.bytes,
              sha256: temporal.sha256,
            };
            if (!(await c.versionesDocumento.crear({ id, documentoId, numero, nota, archivo }, usuarioId, ahora)))
              throw new ConflictoError('archivo_repetido');
            await c.bitacora.registrar({
              empresaId,
              actor: { tipo: 'usuario', usuarioId },
              accion: 'version.creada',
              resultado: 'ok',
              objeto: etiqueta(d.codigo, numero),
              objetoVersion: temporal.sha256,
            });
            // Último paso antes de confirmar: si el renombrado falla, la fila se deshace (ADR 032).
            await this.almacen.confirmar(empresaId, temporal.id, archivo.id);
            return dto(await exigirVersion(c, id), ahora);
          });
        } catch (err) {
          await descartar();
          throw err;
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

/** Solo el autor (o quien gestiona documentos) maneja un borrador propio. */
const exigirAutorOGestor = async (
  autorizacion: AutorizacionPort,
  v: FilaVersion,
  usuarioId: string,
  empresaId: Parameters<AutorizacionPort['puede']>[2],
): Promise<void> => {
  if (v.autorId === usuarioId) return;
  if (!(await autorizacion.puede(usuarioId, 'documentos.gestionar', empresaId))) throw new SinPermisoError('documentos.gestionar');
};

/** Envía el borrador a revisión nombrando quién lo aprueba: una persona activa con permiso de aprobar, distinta del autor. */
export class EnviarARevisionUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string; id: string; aprobadorId?: unknown }): Promise<VersionDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'documentos.redactar', empresaId);
    const id = validarUuid(e.id, 'id');
    const aprobadorId = validarUuid(e.aprobadorId, 'aprobadorId');
    const ahora = this.reloj();
    if (!(await this.autorizacion.puede(aprobadorId, 'documentos.aprobar', empresaId))) throw new ParametroInvalidoError('aprobadorId');
    return this.unidad.ejecutar(empresaId, async (c) => {
      const v = await exigirVersion(c, id);
      const d = await exigirDocumentoActivo(c, v.documentoId);
      await exigirAutorOGestor(this.autorizacion, v, usuarioId, empresaId);
      const personas = await exigirPersonaActiva(c, aprobadorId, 'aprobadorId');
      if (!puedeNombrarseAprobador(v.autorId, aprobadorId, administradoresActivos(personas)))
        throw new ParametroInvalidoError('aprobadorId');
      const cambios = traducirDominio(() => enviarARevision(v, aprobadorId));
      if (
        !(await c.versionesDocumento.actualizar(
          id,
          { estado: cambios.estado, aprobadorId, enviadaEn: ahora, devueltaMotivo: null, devueltaNota: null },
          v.version,
          usuarioId,
          ahora,
        ))
      )
        throw new ConflictoDeVersionError();
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'version.enviada',
        resultado: 'ok',
        objeto: etiqueta(d.codigo, v.numero),
      });
      return dto(await exigirVersion(c, id), ahora);
    });
  }
}

/** El aprobador devuelve la versión a borrador con un motivo de lista cerrada. */
export class DevolverVersionUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string; id: string; motivo?: unknown; nota?: unknown }): Promise<VersionDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'documentos.aprobar', empresaId);
    const id = validarUuid(e.id, 'id');
    const ahora = this.reloj();
    return this.unidad.ejecutar(empresaId, async (c) => {
      const v = await exigirVersion(c, id);
      const d = await exigirDocumentoActivo(c, v.documentoId);
      if (v.aprobadorId !== usuarioId) throw new SinPermisoError('documentos.aprobar');
      const r = traducirDominio(() => devolverABorrador(v, e.motivo, e.nota));
      if (
        !(await c.versionesDocumento.actualizar(
          id,
          { estado: r.estado, aprobadorId: null, enviadaEn: null, devueltaMotivo: r.motivo, devueltaNota: r.nota },
          v.version,
          usuarioId,
          ahora,
        ))
      )
        throw new ConflictoDeVersionError();
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'version.devuelta',
        resultado: 'ok',
        objeto: etiqueta(d.codigo, v.numero),
        despues: { motivo: r.motivo },
      });
      return dto(await exigirVersion(c, id), ahora);
    });
  }
}

export interface AprobarVersionEntrada {
  readonly empresaId: string;
  readonly usuarioId: string;
  readonly id: string;
  /** AAAA-MM-DD; por omisión, un año después de hoy. */
  readonly proximaRevision?: unknown;
  readonly requiereLectura?: unknown;
  /** Solo para la excepción del único administrador. */
  readonly motivoExcepcion?: unknown;
}

/**
 * Aprueba una versión en revisión. La anterior (si la hay) pasa a obsoleta en la MISMA transacción: siempre una sola vigente. Crea
 * las lecturas pendientes de los destinatarios activos (siempre en la primera versión aprobada; en las siguientes, solo si se marca
 * «requiere nueva lectura»). La aprobación rige desde este momento (no hay vigencia futura, ADR 039).
 */
export class AprobarVersionUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(e: AprobarVersionEntrada): Promise<VersionDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'documentos.aprobar', empresaId);
    const id = validarUuid(e.id, 'id');
    const ahora = this.reloj();
    const hoy = hoyEnEcuador(ahora);
    const proxima =
      e.proximaRevision === undefined ? unAnioDespues(hoy) : traducirDominio(() => validarFechaRevision(e.proximaRevision, hoy));
    return this.unidad.ejecutar(empresaId, async (c) => {
      const v = await exigirVersion(c, id);
      const d = await exigirDocumentoActivo(c, v.documentoId);
      const personas = await c.personas.listar();
      const a = traducirDominio(() =>
        aprobarVersionDominio(v, {
          aprobadorId: usuarioId,
          ahora,
          administradoresActivos: administradoresActivos(personas),
          motivoExcepcion: e.motivoExcepcion,
          requiereLectura: e.requiereLectura,
        }),
      );
      const hayAnterior = (await c.versionesDocumento.listarDeDocumento(d.id)).some(
        (x) => x.id !== v.id && (x.estado === 'aprobada' || x.estado === 'obsoleta'),
      );
      await c.versionesDocumento.obsoletizarVigente(d.id, ahora, usuarioId);
      if (
        !(await c.versionesDocumento.actualizar(
          id,
          {
            estado: 'aprobada',
            aprobadaPor: a.aprobadaPor,
            aprobadaEn: a.aprobadaEn,
            porSuAutor: a.porSuAutor,
            motivoExcepcion: a.motivoExcepcion,
            requiereLectura: a.requiereLectura,
          },
          v.version,
          usuarioId,
          ahora,
        ))
      )
        throw new ConflictoDeVersionError();
      if (!(await c.documentos.actualizar(d.id, { proximaRevision: proxima }, d.version, usuarioId, ahora)))
        throw new ConflictoDeVersionError();
      const activos = new Set(personas.filter((p) => p.activa).map((p) => p.id));
      const pendientes = hayAnterior && !a.requiereLectura ? [] : (await c.destinatarios.listar(d.id)).filter((u) => activos.has(u));
      if (pendientes.length > 0) await c.lecturas.crearPendientes(id, pendientes);
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'version.aprobada',
        resultado: 'ok',
        objeto: etiqueta(d.codigo, v.numero),
        objetoVersion: v.archivo.sha256,
        despues: { por_su_autor: a.porSuAutor, requiere_lectura: a.requiereLectura, destinatarios: pendientes.length },
      });
      return dto(await exigirVersion(c, id), ahora);
    });
  }
}

/** Descarta un borrador (queda registrado, no se borra). */
export class DescartarVersionUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string; id: string }): Promise<void> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'documentos.redactar', empresaId);
    const id = validarUuid(e.id, 'id');
    const ahora = this.reloj();
    await this.unidad.ejecutar(empresaId, async (c) => {
      const v = await exigirVersion(c, id);
      const d = await c.documentos.obtener(v.documentoId);
      if (!d) throw new EntradaNoEncontradaError();
      await exigirAutorOGestor(this.autorizacion, v, usuarioId, empresaId);
      const r = traducirDominio(() => descartarBorrador(v));
      if (!(await c.versionesDocumento.actualizar(id, { estado: r.estado }, v.version, usuarioId, ahora)))
        throw new ConflictoDeVersionError();
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'version.descartada',
        resultado: 'ok',
        objeto: etiqueta(d.codigo, v.numero),
      });
    });
  }
}

export interface DescargaVersion {
  /** Nombre con la extensión del tipo detectado. */
  readonly nombre: string;
  readonly tipo: TipoArchivo;
  readonly bytes: number;
  readonly sha256: string;
  /** La pantalla rotula «no vigente» cuando no es la versión aprobada; el archivo no se altera. */
  readonly vigente: boolean;
  readonly flujo: AsyncIterable<Uint8Array>;
}

/**
 * Entrega el archivo de una versión. La descarga se registra ANTES de abrir el archivo y, si no se puede registrar, no se entrega
 * nada (falla cerrada). Una versión descartada no se descarga.
 */
export class DescargarVersionUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly almacen: AlmacenArchivosPort,
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string; id: string }): Promise<DescargaVersion> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'documentos.ver', empresaId);
    const id = validarUuid(e.id, 'id');
    const v = await this.unidad.ejecutar(empresaId, async (c) => {
      const fila = await exigirVersion(c, id);
      if (fila.estado === 'descartada') throw new EntradaNoEncontradaError();
      const d = await c.documentos.obtener(fila.documentoId);
      if (!d) throw new EntradaNoEncontradaError();
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'version.descargada',
        resultado: 'ok',
        objeto: etiqueta(d.codigo, fila.numero),
        objetoVersion: fila.archivo.sha256,
      });
      return fila;
    });
    const { archivo } = v;
    return {
      nombre: nombreDeDescarga(archivo.nombre, archivo.tipo),
      tipo: archivo.tipo,
      bytes: archivo.bytes,
      sha256: archivo.sha256,
      vigente: v.estado === 'aprobada',
      flujo: await this.almacen.abrir(empresaId, archivo.id),
    };
  }
}

/** La propia persona confirma que leyó la versión vigente. Nadie confirma por otra, ni el administrador. */
export class ConfirmarLecturaUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string; id: string }): Promise<void> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'documentos.leer', empresaId);
    const id = validarUuid(e.id, 'id');
    const ahora = this.reloj();
    await this.unidad.ejecutar(empresaId, async (c) => {
      const v = await exigirVersion(c, id);
      const d = await c.documentos.obtener(v.documentoId);
      if (!d) throw new EntradaNoEncontradaError();
      if (v.estado !== 'aprobada') throw new ConflictoError('no_vigente');
      if (!(await c.lecturas.confirmar(id, usuarioId, ahora))) throw new ConflictoError('sin_lectura_pendiente');
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'lectura.confirmada',
        resultado: 'ok',
        objeto: etiqueta(d.codigo, v.numero),
      });
    });
  }
}

/** «Mis lecturas pendientes»: versiones vigentes que la persona aún no confirmó. */
export class MisLecturasPendientesUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string }): Promise<readonly LecturaPendiente[]> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'documentos.leer', empresaId);
    return this.unidad.ejecutar(empresaId, (c) => c.lecturas.pendientesDe(usuarioId));
  }
}
