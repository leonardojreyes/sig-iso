import {
  ANIOS_RETENCION_MAX,
  DESTINATARIOS_POR_DOCUMENTO_MAX,
  TIPOS_DOCUMENTO,
  VINCULOS_POR_DOCUMENTO_MAX,
  elegibleParaDisposicion,
  estadoDeRevision,
  esTipoDocumento,
  resumenDeLecturas,
  unAnioDespues,
  validarAniosRetencion,
  validarDatosDocumento,
  validarFechaRevision,
  validarMotivoRetencion,
  validarMotivoRevision,
  type Clasificacion,
  type EstadoRevision,
  type EstadoVersion,
  type MotivoDevolucion,
  type TipoDocumento,
} from '../domain/documento.js';
import { ErrorCertificacion } from '../domain/errores.js';
import { hoyEnEcuador } from '../domain/fechas.js';
import type { AutorizacionPort } from './autorizacion.port.js';
import type { CatalogoLecturaPort, EntradaCatalogo } from './catalogo-lectura.port.js';
import { exigirPermiso, identificar, validarNorma, validarUuid } from './comunes.js';
import type { ContextoCertificacion, Reloj } from './contexto.js';
import type { NuevoId } from './controles.use-cases.js';
import type { FilaDocumento, FilaRetencion, FilaVersion, LecturaDeVersion, PersonaDirectorio } from './documentos.port.js';
import { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError, SinPermisoError } from './errores.js';
import type { UnidadDeTrabajoPort } from './unidad-de-trabajo.port.js';

type Unidad = UnidadDeTrabajoPort<ContextoCertificacion>;

/** Tope de documentos por empresa: acota las listas (el contrato lo declara con `maxItems`). */
export const TOPE_DOCUMENTOS = 1000;
/** Tope de entradas por respuesta de cobertura documental. */
export const TOPE_COBERTURA_DOCUMENTAL = 500;
const INTENTOS_NUMERO = 5;

/** Las reglas del dominio son 400 (dato mal formado) o 409 (el estado no lo permite). Nunca repite el valor recibido. */
export const traducirDominio = <T>(f: () => T): T => {
  try {
    return f();
  } catch (e) {
    if (e instanceof ErrorCertificacion) {
      const motivo = e.motivos.find((m) => ['es_el_autor', 'no_es_el_aprobador', 'no_permitido_en_este_estado'].includes(m));
      if (motivo) throw new ConflictoError(motivo);
      throw new ParametroInvalidoError(e.campo);
    }
    throw e;
  }
};

/** La persona debe ser de la empresa de la sesión y estar activa (con rol y sin baja). */
export const exigirPersonaActiva = async (
  c: ContextoCertificacion,
  personaId: string,
  campo: string,
): Promise<readonly PersonaDirectorio[]> => {
  const personas = await c.personas.listar();
  if (!personas.some((p) => p.id === personaId && p.activa)) throw new ParametroInvalidoError(campo);
  return personas;
};

export const administradoresActivos = (personas: readonly PersonaDirectorio[]): number =>
  personas.filter((p) => p.activa && p.rol === 'administrador_sig').length;

export const exigirDocumento = async (c: ContextoCertificacion, id: string): Promise<FilaDocumento> => {
  const d = await c.documentos.obtener(id);
  if (!d) throw new EntradaNoEncontradaError();
  return d;
};

export const exigirDocumentoActivo = async (c: ContextoCertificacion, id: string): Promise<FilaDocumento> => {
  const d = await exigirDocumento(c, id);
  if (d.estado !== 'activo') throw new ConflictoError('retirado');
  return d;
};

// ---- DTO -------------------------------------------------------------------------------------------------------------------------

export interface LecturasDto {
  readonly confirmadas: number;
  readonly total: number;
}

export interface VersionDto {
  readonly id: string;
  readonly documentoId: string;
  readonly numero: number;
  readonly estado: EstadoVersion;
  readonly vigente: boolean;
  readonly nota: string;
  readonly archivo: { readonly nombre: string; readonly tipo: string; readonly bytes: number; readonly sha256: string };
  readonly autorId: string;
  readonly aprobadorId: string | null;
  readonly aprobadaPor: string | null;
  readonly aprobadaEn: string | null;
  readonly porSuAutor: boolean;
  readonly motivoExcepcion: string | null;
  readonly requiereLectura: boolean;
  readonly devueltaMotivo: MotivoDevolucion | null;
  readonly devueltaNota: string | null;
  readonly obsoletaEn: string | null;
  readonly elegibleParaDisposicion: boolean;
  readonly lecturas: LecturasDto | null;
  readonly creadaEn: string;
}

export interface DocumentoDto {
  readonly id: string;
  readonly codigo: string;
  readonly tipo: TipoDocumento;
  readonly titulo: string;
  readonly area: string | null;
  readonly clasificacion: Clasificacion;
  readonly responsableId: string;
  readonly emisor: string | null;
  readonly edicionFuente: string | null;
  readonly estado: 'activo' | 'retirado';
  readonly proximaRevision: string | null;
  readonly revision: EstadoRevision | null;
  readonly ultimaRevisionEn: string | null;
  readonly vigente: { readonly versionId: string; readonly numero: number; readonly aprobadaEn: string } | null;
  readonly sinVigente: boolean;
  readonly lecturas: LecturasDto | null;
  /** La persona que consulta tiene una lectura pendiente de la versión vigente. */
  readonly lecturaPendiente: boolean;
  readonly version: number;
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export const aDtoVersion = (
  v: FilaVersion,
  p: { hoy: string; aniosRetencion: number | null; lecturas: LecturasDto | null },
): VersionDto => ({
  id: v.id,
  documentoId: v.documentoId,
  numero: v.numero,
  estado: v.estado,
  vigente: v.estado === 'aprobada',
  nota: v.nota,
  archivo: { nombre: v.archivo.nombre, tipo: v.archivo.tipo, bytes: v.archivo.bytes, sha256: v.archivo.sha256 },
  autorId: v.autorId,
  aprobadorId: v.aprobadorId,
  aprobadaPor: v.aprobadaPor,
  aprobadaEn: iso(v.aprobadaEn),
  porSuAutor: v.porSuAutor,
  motivoExcepcion: v.motivoExcepcion,
  requiereLectura: v.requiereLectura,
  devueltaMotivo: v.devueltaMotivo,
  devueltaNota: v.devueltaNota,
  obsoletaEn: iso(v.obsoletaEn),
  elegibleParaDisposicion: elegibleParaDisposicion({ estado: v.estado, obsoletaEn: v.obsoletaEn }, p.aniosRetencion, p.hoy),
  lecturas: p.lecturas,
  creadaEn: v.creadaEn.toISOString(),
});

const resumen = (lecturas: readonly LecturaDeVersion[], activos: ReadonlySet<string>): LecturasDto =>
  resumenDeLecturas(
    lecturas.map((l) => ({ usuarioId: l.usuarioId, confirmada: l.confirmadaEn !== null })),
    activos,
  );

export const aDtoDocumento = (
  d: FilaDocumento,
  vigente: FilaVersion | null,
  lecturas: readonly LecturaDeVersion[],
  activos: ReadonlySet<string>,
  yo: string,
  hoy: string,
): DocumentoDto => ({
  id: d.id,
  codigo: d.codigo,
  tipo: d.tipo,
  titulo: d.titulo,
  area: d.area,
  clasificacion: d.clasificacion,
  responsableId: d.responsableId,
  emisor: d.emisor,
  edicionFuente: d.edicionFuente,
  estado: d.estado,
  proximaRevision: vigente ? d.proximaRevision : null,
  revision: vigente ? estadoDeRevision(d.proximaRevision, hoy) : null,
  ultimaRevisionEn: iso(d.ultimaRevisionEn),
  vigente: vigente ? { versionId: vigente.id, numero: vigente.numero, aprobadaEn: (vigente.aprobadaEn as Date).toISOString() } : null,
  sinVigente: d.estado === 'activo' && vigente === null,
  lecturas: vigente && lecturas.length > 0 ? resumen(lecturas, activos) : null,
  lecturaPendiente: lecturas.some((l) => l.usuarioId === yo && l.confirmadaEn === null),
  version: d.version,
});

const conjuntoActivos = (personas: readonly PersonaDirectorio[]): ReadonlySet<string> =>
  new Set(personas.filter((p) => p.activa).map((p) => p.id));

// ---- Crear, cambiar y retirar ----------------------------------------------------------------------------------------------------

export interface CrearDocumentoEntrada {
  readonly empresaId: string;
  readonly usuarioId: string;
  readonly tipo?: unknown;
  readonly titulo?: unknown;
  readonly area?: unknown;
  readonly clasificacion?: unknown;
  readonly responsableId?: unknown;
  readonly emisor?: unknown;
  readonly edicionFuente?: unknown;
}

/** Crea un documento con su código correlativo por tipo. No tiene versión vigente hasta que se apruebe la primera. */
export class CrearDocumentoUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly reloj: Reloj,
    private readonly nuevoId: NuevoId,
  ) {}

  async ejecutar(e: CrearDocumentoEntrada): Promise<DocumentoDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'documentos.redactar', empresaId);
    const datos = traducirDominio(() => validarDatosDocumento(e));
    const responsableId = validarUuid(e.responsableId, 'responsableId');
    const ahora = this.reloj();
    return this.unidad.ejecutar(empresaId, async (c) => {
      const personas = await exigirPersonaActiva(c, responsableId, 'responsableId');
      if ((await c.documentos.listar()).length >= TOPE_DOCUMENTOS) throw new ConflictoError('tope_de_documentos');
      for (let i = 0; i < INTENTOS_NUMERO; i += 1) {
        const numero = await c.documentos.siguienteNumero(datos.tipo);
        const id = this.nuevoId();
        if (!(await c.documentos.crear({ id, ...datos, numero, responsableId }, usuarioId, ahora))) continue;
        const d = (await c.documentos.obtener(id)) as FilaDocumento;
        await c.bitacora.registrar({
          empresaId,
          actor: { tipo: 'usuario', usuarioId },
          accion: 'documento.creado',
          resultado: 'ok',
          objeto: `documento:${d.codigo}`,
        });
        return aDtoDocumento(d, null, [], conjuntoActivos(personas), usuarioId, hoyEnEcuador(ahora));
      }
      throw new ConflictoError('numero_en_uso');
    });
  }
}

export interface CambiarDocumentoEntrada extends Omit<CrearDocumentoEntrada, 'tipo'> {
  readonly id: string;
  readonly versionEsperada: unknown;
}

const entero = (v: unknown, campo: string): number => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) throw new ParametroInvalidoError(campo);
  return v;
};

/** Cambia los datos de un documento (no el tipo ni el código). Lo hace quien lo gestiona o su responsable. */
export class CambiarDocumentoUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(e: CambiarDocumentoEntrada): Promise<DocumentoDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'documentos.redactar', empresaId);
    const id = validarUuid(e.id, 'id');
    const esperada = entero(e.versionEsperada, 'versionEsperada');
    const responsableNuevo = e.responsableId === undefined ? undefined : validarUuid(e.responsableId, 'responsableId');
    const ahora = this.reloj();
    const gestiona = await this.autorizacion.puede(usuarioId, 'documentos.gestionar', empresaId);
    return this.unidad.ejecutar(empresaId, async (c) => {
      const d = await exigirDocumentoActivo(c, id);
      if (!gestiona && d.responsableId !== usuarioId) throw new SinPermisoError('documentos.gestionar');
      const personas = responsableNuevo ? await exigirPersonaActiva(c, responsableNuevo, 'responsableId') : await c.personas.listar();
      const datos = traducirDominio(() =>
        validarDatosDocumento({
          tipo: d.tipo,
          titulo: e.titulo ?? d.titulo,
          area: e.area === undefined ? d.area : e.area,
          clasificacion: e.clasificacion ?? d.clasificacion,
          emisor: e.emisor === undefined ? d.emisor : e.emisor,
          edicionFuente: e.edicionFuente === undefined ? d.edicionFuente : e.edicionFuente,
        }),
      );
      if (
        !(await c.documentos.actualizar(
          id,
          {
            titulo: datos.titulo,
            area: datos.area,
            clasificacion: datos.clasificacion,
            emisor: datos.emisor,
            edicionFuente: datos.edicionFuente,
            responsableId: responsableNuevo ?? d.responsableId,
          },
          esperada,
          usuarioId,
          ahora,
        ))
      )
        throw new ConflictoDeVersionError();
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'documento.cambiado',
        resultado: 'ok',
        objeto: `documento:${d.codigo}`,
      });
      return armarDto(c, await exigirDocumento(c, id), usuarioId, hoyEnEcuador(ahora), personas);
    });
  }
}

const armarDto = async (
  c: ContextoCertificacion,
  d: FilaDocumento,
  yo: string,
  hoy: string,
  personas: readonly PersonaDirectorio[],
): Promise<DocumentoDto> => {
  const versiones = await c.versionesDocumento.listarDeDocumento(d.id);
  const vigente = versiones.find((v) => v.estado === 'aprobada') ?? null;
  const lecturas = vigente ? await c.lecturas.listarDeVersion(vigente.id) : [];
  return aDtoDocumento(d, vigente, lecturas, conjuntoActivos(personas), yo, hoy);
};

/** Retira un documento: queda sin versión vigente (la aprobada pasa a obsoleta) y conserva su historia y su código. */
export class RetirarDocumentoUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string; id: string }): Promise<void> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'documentos.gestionar', empresaId);
    const id = validarUuid(e.id, 'id');
    const ahora = this.reloj();
    await this.unidad.ejecutar(empresaId, async (c) => {
      const d = await exigirDocumentoActivo(c, id);
      await c.versionesDocumento.obsoletizarVigente(id, ahora, usuarioId);
      if (!(await c.documentos.actualizar(id, { estado: 'retirado', proximaRevision: null }, d.version, usuarioId, ahora)))
        throw new ConflictoDeVersionError();
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'documento.retirado',
        resultado: 'ok',
        objeto: `documento:${d.codigo}`,
      });
    });
  }
}

/** «Revisado sin cambios»: lo registra el responsable o quien gestiona; reinicia la fecha sin crear versión. */
export class RevisarDocumentoUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(e: {
    empresaId: string;
    usuarioId: string;
    id: string;
    motivo?: unknown;
    proximaRevision?: unknown;
  }): Promise<DocumentoDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'documentos.redactar', empresaId);
    const id = validarUuid(e.id, 'id');
    const motivo = traducirDominio(() => validarMotivoRevision(e.motivo));
    const ahora = this.reloj();
    const hoy = hoyEnEcuador(ahora);
    const proxima =
      e.proximaRevision === undefined ? unAnioDespues(hoy) : traducirDominio(() => validarFechaRevision(e.proximaRevision, hoy));
    const gestiona = await this.autorizacion.puede(usuarioId, 'documentos.gestionar', empresaId);
    return this.unidad.ejecutar(empresaId, async (c) => {
      const d = await exigirDocumentoActivo(c, id);
      if (!gestiona && d.responsableId !== usuarioId) throw new SinPermisoError('documentos.gestionar');
      const versiones = await c.versionesDocumento.listarDeDocumento(id);
      if (!versiones.some((v) => v.estado === 'aprobada')) throw new ConflictoError('sin_vigente');
      if (
        !(await c.documentos.actualizar(
          id,
          { proximaRevision: proxima, ultimaRevisionEn: ahora, ultimaRevisionPor: usuarioId },
          d.version,
          usuarioId,
          ahora,
        ))
      )
        throw new ConflictoDeVersionError();
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'documento.revisado',
        resultado: 'ok',
        objeto: `documento:${d.codigo}`,
        ...(motivo ? { despues: { motivo } } : {}),
      });
      return armarDto(c, await exigirDocumento(c, id), usuarioId, hoy, await c.personas.listar());
    });
  }
}

// ---- Listar y ver ----------------------------------------------------------------------------------------------------------------

export interface ListarDocumentosEntrada {
  readonly empresaId: string;
  readonly usuarioId: string;
  readonly tipo?: unknown;
  readonly estado?: unknown;
  readonly responsableId?: unknown;
  readonly area?: unknown;
  readonly norma?: unknown;
  readonly sinVigente?: unknown;
  readonly revisionVencida?: unknown;
}

export interface ListaDocumentosDto {
  readonly hoy: string;
  readonly documentos: readonly DocumentoDto[];
}

const opcionalBooleano = (v: unknown, campo: string): boolean | undefined => {
  if (v === undefined) return undefined;
  if (typeof v !== 'boolean') throw new ParametroInvalidoError(campo);
  return v;
};

/** La lista de documentos con filtros; marca los que no tienen versión vigente, con revisión vencida o con lecturas pendientes. */
export class ListarDocumentosUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly catalogo: CatalogoLecturaPort,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(e: ListarDocumentosEntrada): Promise<ListaDocumentosDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'documentos.ver', empresaId);
    if (e.tipo !== undefined && !esTipoDocumento(e.tipo)) throw new ParametroInvalidoError('tipo');
    if (e.estado !== undefined && e.estado !== 'activo' && e.estado !== 'retirado') throw new ParametroInvalidoError('estado');
    const responsableId = e.responsableId === undefined ? undefined : validarUuid(e.responsableId, 'responsableId');
    if (e.area !== undefined && (typeof e.area !== 'string' || e.area.trim().length < 1 || e.area.length > 60))
      throw new ParametroInvalidoError('area');
    const norma = e.norma === undefined ? undefined : validarNorma(e.norma);
    const sinVigente = opcionalBooleano(e.sinVigente, 'sinVigente');
    const revisionVencida = opcionalBooleano(e.revisionVencida, 'revisionVencida');
    const hoy = hoyEnEcuador(this.reloj());

    const catalogo = norma === undefined ? [] : await this.catalogo.listarEntradasVigentes(empresaId);
    const datos = await this.unidad.ejecutar(empresaId, async (c) => {
      const documentos = await c.documentos.listar();
      const vigentes = await c.versionesDocumento.listarVigentes();
      const lecturas = await c.lecturas.listarDeVersiones(vigentes.map((v) => v.id));
      return {
        documentos,
        vigentes,
        lecturas,
        personas: await c.personas.listar(),
        entradasDoc: norma === undefined ? [] : await c.vinculosDocumento.listarTodasEntradas(),
      };
    });
    const activos = conjuntoActivos(datos.personas);
    const deLaNorma = new Set(
      catalogo.filter((x) => x.aplicaA.some((a) => a.norma === norma)).map((x) => `${x.libreriaCodigo}|${x.idEstable}`),
    );
    const conNorma = new Set(
      datos.entradasDoc.filter((x) => deLaNorma.has(`${x.libreriaCodigo}|${x.idEstable}`)).map((x) => x.documentoId),
    );

    const filas = datos.documentos
      .filter(
        (d) =>
          (e.tipo === undefined || d.tipo === e.tipo) &&
          (e.estado === undefined || d.estado === e.estado) &&
          (responsableId === undefined || d.responsableId === responsableId),
      )
      .filter((d) => e.area === undefined || (d.area ?? '').toLowerCase().includes((e.area as string).trim().toLowerCase()))
      .filter((d) => norma === undefined || conNorma.has(d.id))
      .map((d) => {
        const vigente = datos.vigentes.find((v) => v.documentoId === d.id) ?? null;
        const lecturas = vigente ? datos.lecturas.filter((l) => l.versionId === vigente.id) : [];
        return aDtoDocumento(d, vigente, lecturas, activos, usuarioId, hoy);
      })
      .filter(
        (d) =>
          (sinVigente === undefined || d.sinVigente === sinVigente) &&
          (revisionVencida === undefined || (d.revision === 'vencida') === revisionVencida),
      );
    return { hoy, documentos: filas.sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true })) };
  }
}

export interface DocumentoDetalleDto extends DocumentoDto {
  readonly versiones: readonly VersionDto[];
  readonly destinatarios: readonly string[];
  readonly controles: readonly string[];
  readonly entradas: readonly { readonly libreriaCodigo: string; readonly idEstable: string }[];
  readonly retencion: { readonly anios: number; readonly motivo: string } | null;
  /** La empresa tiene un solo administrador activo: puede aprobar su propia versión con motivo (ADR 039). */
  readonly unicoAdministrador: boolean;
}

export class ObtenerDocumentoUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string; id: string }): Promise<DocumentoDetalleDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'documentos.ver', empresaId);
    const id = validarUuid(e.id, 'id');
    const hoy = hoyEnEcuador(this.reloj());
    return this.unidad.ejecutar(empresaId, async (c) => {
      const d = await exigirDocumento(c, id);
      const versiones = await c.versionesDocumento.listarDeDocumento(id);
      const lecturas = await c.lecturas.listarDeVersiones(versiones.map((v) => v.id));
      const personas = await c.personas.listar();
      const activos = conjuntoActivos(personas);
      const retencion = (await c.retenciones.listar()).find((r) => r.tipo === d.tipo) ?? null;
      const vigente = versiones.find((v) => v.estado === 'aprobada') ?? null;
      const base = aDtoDocumento(d, vigente, vigente ? lecturas.filter((l) => l.versionId === vigente.id) : [], activos, usuarioId, hoy);
      return {
        ...base,
        versiones: [...versiones]
          .sort((a, b) => b.numero - a.numero)
          .map((v) => {
            const delaVersion = lecturas.filter((l) => l.versionId === v.id);
            return aDtoVersion(v, {
              hoy,
              aniosRetencion: retencion?.anios ?? null,
              lecturas: delaVersion.length > 0 ? resumen(delaVersion, activos) : null,
            });
          }),
        destinatarios: await c.destinatarios.listar(id),
        controles: await c.vinculosDocumento.listarControles(id),
        entradas: await c.vinculosDocumento.listarEntradas(id),
        retencion: retencion ? { anios: retencion.anios, motivo: retencion.motivo } : null,
        unicoAdministrador: administradoresActivos(personas) <= 1,
      };
    });
  }
}

// ---- Distribución ----------------------------------------------------------------------------------------------------------------

/**
 * Define los destinatarios del documento: personas y/o «todas las personas de un rol» (se resuelve en este momento, sin guardar el
 * rol). Solo cuentan personas activas de la empresa.
 */
export class CambiarDistribucionUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
  ) {}

  async ejecutar(e: {
    empresaId: string;
    usuarioId: string;
    id: string;
    usuarioIds?: unknown;
    roles?: unknown;
  }): Promise<readonly string[]> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'documentos.gestionar', empresaId);
    const id = validarUuid(e.id, 'id');
    const personasPedidas = lista(e.usuarioIds, 'usuarioIds', DESTINATARIOS_POR_DOCUMENTO_MAX).map((x) => validarUuid(x, 'usuarioIds'));
    const roles = lista(e.roles, 'roles', 10).map((r) => {
      if (typeof r !== 'string' || !/^[a-z_]{3,30}$/.test(r)) throw new ParametroInvalidoError('roles');
      return r;
    });
    return this.unidad.ejecutar(empresaId, async (c) => {
      const d = await exigirDocumentoActivo(c, id);
      const personas = await c.personas.listar();
      const activas = new Map(personas.filter((p) => p.activa).map((p) => [p.id, p]));
      for (const p of personasPedidas) if (!activas.has(p)) throw new ParametroInvalidoError('usuarioIds');
      const porRol = personas.filter((p) => p.activa && p.rol !== null && roles.includes(p.rol)).map((p) => p.id);
      const finales = [...new Set([...personasPedidas, ...porRol])];
      if (finales.length > DESTINATARIOS_POR_DOCUMENTO_MAX) throw new ConflictoError('tope_de_destinatarios');
      await c.destinatarios.reemplazar(id, finales, usuarioId);
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'documento.distribucion_cambiada',
        resultado: 'ok',
        objeto: `documento:${d.codigo}`,
        despues: { destinatarios: finales.length },
      });
      return finales;
    });
  }
}

const lista = (v: unknown, campo: string, max: number): unknown[] => {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > max) throw new ParametroInvalidoError(campo);
  return v;
};

// ---- Vínculos y cobertura documental ---------------------------------------------------------------------------------------------

export interface VinculoEntrada {
  readonly empresaId: string;
  readonly usuarioId: string;
  readonly id: string;
  readonly controlId?: unknown;
  readonly libreriaCodigo?: unknown;
  readonly idEstable?: unknown;
}

const PATRON_LIBRERIA = /^[a-z0-9][a-z0-9-]{0,63}$/;
const PATRON_ID_ESTABLE = /^[a-z0-9][a-z0-9.-]{0,40}$/;

const leerVinculo = (e: VinculoEntrada): { controlId: string } | { libreriaCodigo: string; idEstable: string } => {
  if (e.controlId !== undefined) {
    if (e.libreriaCodigo !== undefined || e.idEstable !== undefined) throw new ParametroInvalidoError('controlId');
    return { controlId: validarUuid(e.controlId, 'controlId') };
  }
  if (typeof e.libreriaCodigo !== 'string' || !PATRON_LIBRERIA.test(e.libreriaCodigo)) throw new ParametroInvalidoError('libreriaCodigo');
  if (typeof e.idEstable !== 'string' || !PATRON_ID_ESTABLE.test(e.idEstable)) throw new ParametroInvalidoError('idEstable');
  return { libreriaCodigo: e.libreriaCodigo, idEstable: e.idEstable };
};

/** Liga un documento a un control de la empresa o a una entrada de una librería ADOPTADA (si no, responde como inexistente). */
export class VincularDocumentoUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly catalogo: CatalogoLecturaPort,
  ) {}

  async ejecutar(e: VinculoEntrada): Promise<{ creado: boolean }> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'documentos.gestionar', empresaId);
    const id = validarUuid(e.id, 'id');
    const v = leerVinculo(e);
    const catalogo = 'controlId' in v ? [] : await this.catalogo.listarEntradasVigentes(empresaId);
    return this.unidad.ejecutar(empresaId, async (c) => {
      const d = await exigirDocumentoActivo(c, id);
      if ('controlId' in v) {
        const control = await c.controles.obtener(v.controlId);
        if (!control) throw new EntradaNoEncontradaError();
        if (!control.vigente) throw new ConflictoError('control_retirado');
      } else if (!catalogo.some((x) => x.libreriaCodigo === v.libreriaCodigo && x.idEstable === v.idEstable))
        throw new EntradaNoEncontradaError();
      const total = (await c.vinculosDocumento.listarControles(id)).length + (await c.vinculosDocumento.listarEntradas(id)).length;
      if (total >= VINCULOS_POR_DOCUMENTO_MAX) throw new ConflictoError('tope_de_vinculos');
      const creado =
        'controlId' in v
          ? await c.vinculosDocumento.agregarControl(id, v.controlId, usuarioId)
          : await c.vinculosDocumento.agregarEntrada(id, v.libreriaCodigo, v.idEstable, usuarioId);
      if (creado)
        await c.bitacora.registrar({
          empresaId,
          actor: { tipo: 'usuario', usuarioId },
          accion: 'documento.vinculado',
          resultado: 'ok',
          objeto: `documento:${d.codigo}`,
        });
      return { creado };
    });
  }
}

export class DesvincularDocumentoUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
  ) {}

  async ejecutar(e: VinculoEntrada): Promise<void> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'documentos.gestionar', empresaId);
    const id = validarUuid(e.id, 'id');
    const v = leerVinculo(e);
    await this.unidad.ejecutar(empresaId, async (c) => {
      const d = await exigirDocumento(c, id);
      const quitado =
        'controlId' in v
          ? await c.vinculosDocumento.quitarControl(id, v.controlId)
          : await c.vinculosDocumento.quitarEntrada(id, v.libreriaCodigo, v.idEstable);
      if (!quitado) throw new EntradaNoEncontradaError();
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'documento.desvinculado',
        resultado: 'ok',
        objeto: `documento:${d.codigo}`,
      });
    });
  }
}

export interface CoberturaDocumentalEntradaDto {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  readonly tipo: 'clausula' | 'control';
  readonly titulo: string;
  readonly normas: readonly string[];
  readonly documentos: readonly { readonly id: string; readonly codigo: string }[];
  readonly cubierta: boolean;
}

export interface CoberturaDocumentalDto {
  readonly normas: readonly string[];
  readonly total: number;
  readonly cubiertas: number;
  readonly entradas: readonly CoberturaDocumentalEntradaDto[];
}

/** Entradas de las normas adoptadas con y sin un documento vigente ligado. Informativa: no bloquea nada. */
export class ListarCoberturaDocumentalUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly catalogo: CatalogoLecturaPort,
  ) {}

  async ejecutar(e: {
    empresaId: string;
    usuarioId: string;
    norma?: unknown;
    soloSinDocumento?: unknown;
  }): Promise<CoberturaDocumentalDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'documentos.ver', empresaId);
    const norma = e.norma === undefined ? null : validarNorma(e.norma);
    const solo = opcionalBooleano(e.soloSinDocumento, 'soloSinDocumento') === true;
    const catalogo = await this.catalogo.listarEntradasVigentes(empresaId);
    const { documentos, vigentes, ligas } = await this.unidad.ejecutar(empresaId, async (c) => ({
      documentos: await c.documentos.listar(),
      vigentes: await c.versionesDocumento.listarVigentes(),
      ligas: await c.vinculosDocumento.listarTodasEntradas(),
    }));
    const conVigente = new Map(
      documentos.filter((d) => d.estado === 'activo' && vigentes.some((v) => v.documentoId === d.id)).map((d) => [d.id, d.codigo]),
    );
    const normas = [...new Set(catalogo.flatMap((x) => x.aplicaA.map((a) => a.norma)))].sort((a, b) => a.localeCompare(b, 'es'));
    const delCatalogo: readonly EntradaCatalogo[] =
      norma === null ? catalogo : catalogo.filter((x) => x.aplicaA.some((a) => a.norma === norma));
    const todas = delCatalogo.map((x): CoberturaDocumentalEntradaDto => {
      const docs = ligas
        .filter((l) => l.libreriaCodigo === x.libreriaCodigo && l.idEstable === x.idEstable && conVigente.has(l.documentoId))
        .map((l) => ({ id: l.documentoId, codigo: conVigente.get(l.documentoId) as string }));
      return {
        libreriaCodigo: x.libreriaCodigo,
        idEstable: x.idEstable,
        tipo: x.tipo,
        titulo: x.titulo,
        normas: x.aplicaA.map((a) => a.norma),
        documentos: docs,
        cubierta: docs.length > 0,
      };
    });
    const entradas = solo ? todas.filter((x) => !x.cubierta) : todas;
    if (entradas.length > TOPE_COBERTURA_DOCUMENTAL)
      throw new Error(`El resultado supera el tope de ${TOPE_COBERTURA_DOCUMENTAL} entradas del contrato`);
    return { normas, total: todas.length, cubiertas: todas.filter((x) => x.cubierta).length, entradas };
  }
}

// ---- Retención por tipo ----------------------------------------------------------------------------------------------------------

export interface RetencionDto {
  readonly tipo: TipoDocumento;
  readonly anios: number;
  readonly motivo: string;
  readonly version: number;
}

export class ListarRetencionUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string }): Promise<readonly RetencionDto[]> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'documentos.ver', empresaId);
    const filas: readonly FilaRetencion[] = await this.unidad.ejecutar(empresaId, (c) => c.retenciones.listar());
    return TIPOS_DOCUMENTO.flatMap((t) => filas.filter((f) => f.tipo === t));
  }
}

/** Fija los años y el motivo de conservación de un tipo. Sin valor por omisión: mientras no se fije se muestra «retención no definida». */
export class GuardarRetencionUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(e: {
    empresaId: string;
    usuarioId: string;
    tipo?: unknown;
    anios?: unknown;
    motivo?: unknown;
    versionEsperada?: unknown;
  }): Promise<RetencionDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'documentos.gestionar', empresaId);
    if (!esTipoDocumento(e.tipo)) throw new ParametroInvalidoError('tipo');
    const tipo = e.tipo;
    const anios = traducirDominio(() => validarAniosRetencion(e.anios));
    const motivo = traducirDominio(() => validarMotivoRetencion(e.motivo));
    const esperada = e.versionEsperada === undefined ? null : entero(e.versionEsperada, 'versionEsperada');
    const ahora = this.reloj();
    return this.unidad.ejecutar(empresaId, async (c) => {
      const actual = (await c.retenciones.listar()).find((r) => r.tipo === tipo) ?? null;
      if (actual === null) {
        if (esperada !== null) throw new ConflictoDeVersionError();
        if (!(await c.retenciones.crear({ tipo, anios, motivo }, usuarioId, ahora))) throw new ConflictoDeVersionError();
      } else if (esperada === null || !(await c.retenciones.actualizar(tipo, anios, motivo, esperada, usuarioId, ahora)))
        throw new ConflictoDeVersionError();
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'retencion.cambiada',
        resultado: 'ok',
        objeto: `retencion:${tipo}`,
        despues: { anios },
      });
      const nueva = (await c.retenciones.listar()).find((r) => r.tipo === tipo) as FilaRetencion;
      return { tipo, anios: nueva.anios, motivo: nueva.motivo, version: nueva.version };
    });
  }
}

export { ANIOS_RETENCION_MAX };

// ---- Directorio de personas ------------------------------------------------------------------------------------------------------

export interface PersonaDirectorioDto {
  readonly id: string;
  readonly nombre: string;
  readonly activa: boolean;
}

/** Quién es quién en la empresa (solo identificador, nombre y si sigue activa), para mostrar responsables sin pedir más datos. */
export class ListarDirectorioUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly permiso: 'documentos.ver' | 'riesgos.ver' = 'documentos.ver',
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string }): Promise<readonly PersonaDirectorioDto[]> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, this.permiso, empresaId);
    const personas = await this.unidad.ejecutar(empresaId, (c) => c.personas.listar());
    return personas.map((p) => ({ id: p.id, nombre: p.nombre, activa: p.activa })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }
}
