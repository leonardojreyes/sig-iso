import { type TipoMotivo } from '../domain/declaracion.js';
import { ErrorCertificacion } from '../domain/errores.js';
import { MotivoInclusion } from '../domain/motivo-inclusion.js';
import { ReferenciaTratamiento, TIPOS_REFERENCIA, type TipoReferencia } from '../domain/referencia-tratamiento.js';
import type { AutorizacionPort } from './autorizacion.port.js';
import type { CatalogoLecturaPort } from './catalogo-lectura.port.js';
import { exigirPermiso, identificadorDeNorma, identificar } from './comunes.js';
import type { ContextoCertificacion, Reloj } from './contexto.js';
import { esDeLaDeclaracion, NORMA_DECLARACION } from './declaracion.use-cases.js';
import { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError } from './errores.js';
import type { UnidadDeTrabajoPort } from './unidad-de-trabajo.port.js';

type Unidad = UnidadDeTrabajoPort<ContextoCertificacion>;

/** Tope de motivos por respuesta: 93 controles × 4 tipos registrables, con holgura. */
export const TOPE_MOTIVOS = 500;

export interface MotivoDto {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  readonly tipo: TipoMotivo;
  readonly nota: string;
  readonly version: number;
}
const aDtoMotivo = (m: MotivoInclusion): MotivoDto => ({ libreriaCodigo: m.libreriaCodigo, idEstable: m.idEstable, tipo: m.tipo, nota: m.nota, version: m.version });

export interface ReferenciaDto {
  readonly tipo: TipoReferencia;
  readonly titulo: string;
  readonly versionDoc: string;
  readonly fecha: string;
  readonly ubicacion: string;
  readonly version: number;
}
const aDtoReferencia = (r: ReferenciaTratamiento): ReferenciaDto => ({ tipo: r.tipo, titulo: r.titulo, versionDoc: r.versionDoc, fecha: r.fecha, ubicacion: r.ubicacion, version: r.version });

/** La versión esperada es opcional: ausente = «aún no existe» (se crea); presente = la que la persona vio (se cambia o se quita). */
const versionOpcional = (v: unknown): number | null => {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) throw new ParametroInvalidoError('versionEsperada');
  return v;
};
const versionObligatoria = (v: unknown): number => {
  const n = versionOpcional(v);
  if (n === null) throw new ParametroInvalidoError('versionEsperada');
  return n;
};

/** Una violación de regla del dominio es un parámetro inválido; nunca repite el valor recibido. */
const traducir = (e: unknown): never => {
  if (e instanceof ErrorCertificacion) throw new ParametroInvalidoError(e.campo);
  throw e;
};

interface Persona {
  readonly empresaId: string;
  readonly usuarioId: string;
}

/**
 * Registra o cambia un motivo de inclusión de un control del Anexo A (solo administradores). La nota es obligatoria. Concurrencia
 * optimista: sin `versionEsperada` se CREA; con ella se CAMBIA. Si otra persona lo cambió, quitó o creó antes, hay conflicto.
 */
export class RegistrarMotivoUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort, private readonly catalogo: CatalogoLecturaPort, private readonly reloj: Reloj) {}

  async ejecutar(entrada: Persona & { libreriaCodigo: string; idEstable: string; tipo: TipoMotivo; nota: string; versionEsperada?: number }): Promise<MotivoDto> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'declaracion.justificar', empresaId);
    const esperada = versionOpcional(entrada.versionEsperada);
    let motivo: MotivoInclusion;
    try {
      motivo = MotivoInclusion.crear({ empresaId, libreriaCodigo: entrada.libreriaCodigo, idEstable: entrada.idEstable, tipo: entrada.tipo, nota: entrada.nota });
    } catch (e) {
      return traducir(e);
    }
    const entradas = await this.catalogo.listarEntradasVigentes(empresaId);
    // Solo controles del Anexo A de la Declaración, de las librerías adoptadas; si no, es como si no existiera.
    if (!entradas.filter(esDeLaDeclaracion).some((e) => e.libreriaCodigo === motivo.libreriaCodigo && e.idEstable === motivo.idEstable)) throw new EntradaNoEncontradaError();
    return this.unidad.ejecutar(empresaId, async (c) => {
      const objeto = `motivo:${motivo.idEstable}.${motivo.tipo}`;
      const previo = await c.motivos.obtener(motivo.libreriaCodigo, motivo.idEstable, motivo.tipo);
      if (esperada === null) {
        // El tope se aplica al CREAR: el listado y la copia congelada leen todos los motivos.
        if (!previo && (await c.motivos.listar()).length >= TOPE_MOTIVOS) throw new ConflictoError('tope_de_motivos');
        if (previo || !(await c.motivos.crear(motivo, usuarioId, this.reloj()))) throw new ConflictoDeVersionError();
        await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'motivo.creado', resultado: 'ok', objeto });
        return aDtoMotivo(motivo);
      }
      if (!previo || previo.version !== esperada) throw new ConflictoDeVersionError();
      const nuevo = previo.conNota(motivo.nota);
      // Sin cambios no hay escritura, versión nueva ni hecho de bitácora.
      if (nuevo === previo) return aDtoMotivo(previo);
      if (!(await c.motivos.actualizar(nuevo, usuarioId, this.reloj(), previo.version))) throw new ConflictoDeVersionError();
      await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'motivo.cambiado', resultado: 'ok', objeto });
      return aDtoMotivo(nuevo);
    });
  }
}

/** Quita un motivo registrado (solo administradores), con la versión que la persona vio. */
export class QuitarMotivoUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort) {}

  async ejecutar(entrada: Persona & { libreriaCodigo: string; idEstable: string; tipo: TipoMotivo; versionEsperada?: number }): Promise<void> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'declaracion.justificar', empresaId);
    const esperada = versionObligatoria(entrada.versionEsperada);
    let clave: MotivoInclusion;
    try {
      clave = MotivoInclusion.crear({ empresaId, libreriaCodigo: entrada.libreriaCodigo, idEstable: entrada.idEstable, tipo: entrada.tipo, nota: 'x' });
    } catch (e) {
      return traducir(e);
    }
    await this.unidad.ejecutar(empresaId, async (c) => {
      const previo = await c.motivos.obtener(clave.libreriaCodigo, clave.idEstable, clave.tipo);
      if (!previo) throw new EntradaNoEncontradaError();
      if (previo.version !== esperada || !(await c.motivos.eliminar(clave.libreriaCodigo, clave.idEstable, clave.tipo, esperada))) throw new ConflictoDeVersionError();
      await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'motivo.eliminado', resultado: 'ok', objeto: `motivo:${clave.idEstable}.${clave.tipo}` });
    });
  }
}

/** Los motivos registrados de la empresa (quien consulta la Declaración). El motivo «riesgo» no está aquí: se deriva. */
export class ListarMotivosUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort) {}

  async ejecutar(entrada: Persona): Promise<readonly MotivoDto[]> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'declaracion.ver', empresaId);
    const todos = await this.unidad.ejecutar(empresaId, (c) => c.motivos.listar());
    if (todos.length > TOPE_MOTIVOS) throw new Error(`El resultado supera el tope de ${TOPE_MOTIVOS} motivos`);
    return todos.map(aDtoMotivo);
  }
}

const tipoReferencia = (v: unknown): TipoReferencia => {
  if (!(TIPOS_REFERENCIA as readonly unknown[]).includes(v)) throw new ParametroInvalidoError('tipo');
  return v as TipoReferencia;
};
const objetoReferencia = (tipo: TipoReferencia): string => `referencia:${identificadorDeNorma(NORMA_DECLARACION)}.${tipo}`;

/**
 * Registra o cambia la referencia al análisis o al plan de tratamiento de riesgos de la Declaración (solo administradores). Solo se
 * NOMBRA el documento. Misma regla de versión que los motivos: sin `versionEsperada` se crea; con ella se cambia.
 */
export class GuardarReferenciaUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort, private readonly reloj: Reloj) {}

  async ejecutar(entrada: Persona & { tipo: TipoReferencia; titulo: string; versionDoc: string; fecha: string; ubicacion: string; versionEsperada?: number }): Promise<ReferenciaDto> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'declaracion.justificar', empresaId);
    const esperada = versionOpcional(entrada.versionEsperada);
    let referencia: ReferenciaTratamiento;
    try {
      referencia = ReferenciaTratamiento.crear({ empresaId, norma: NORMA_DECLARACION, tipo: tipoReferencia(entrada.tipo), titulo: entrada.titulo, versionDoc: entrada.versionDoc, fecha: entrada.fecha, ubicacion: entrada.ubicacion });
    } catch (e) {
      return traducir(e);
    }
    return this.unidad.ejecutar(empresaId, async (c) => {
      const objeto = objetoReferencia(referencia.tipo);
      const previa = await c.referencias.obtener(referencia.norma, referencia.tipo);
      if (esperada === null) {
        if (previa || !(await c.referencias.crear(referencia, usuarioId, this.reloj()))) throw new ConflictoDeVersionError();
        await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'referencia.creada', resultado: 'ok', objeto });
        return aDtoReferencia(referencia);
      }
      if (!previa || previa.version !== esperada) throw new ConflictoDeVersionError();
      const nueva = (() => {
        try {
          return previa.conDatos({ titulo: entrada.titulo, versionDoc: entrada.versionDoc, fecha: entrada.fecha, ubicacion: entrada.ubicacion });
        } catch (e) {
          return traducir(e);
        }
      })();
      if (nueva === previa) return aDtoReferencia(previa);
      if (!(await c.referencias.actualizar(nueva, usuarioId, this.reloj(), previa.version))) throw new ConflictoDeVersionError();
      await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'referencia.cambiada', resultado: 'ok', objeto });
      return aDtoReferencia(nueva);
    });
  }
}

/** Quita una referencia (solo administradores), con la versión que la persona vio. */
export class QuitarReferenciaUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort) {}

  async ejecutar(entrada: Persona & { tipo: TipoReferencia; versionEsperada?: number }): Promise<void> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'declaracion.justificar', empresaId);
    const tipo = tipoReferencia(entrada.tipo);
    const esperada = versionObligatoria(entrada.versionEsperada);
    await this.unidad.ejecutar(empresaId, async (c) => {
      const previa = await c.referencias.obtener(NORMA_DECLARACION, tipo);
      if (!previa) throw new EntradaNoEncontradaError();
      if (previa.version !== esperada || !(await c.referencias.eliminar(NORMA_DECLARACION, tipo, esperada))) throw new ConflictoDeVersionError();
      await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'referencia.eliminada', resultado: 'ok', objeto: objetoReferencia(tipo) });
    });
  }
}

/** Las referencias de la Declaración (quien la consulta): a lo sumo el análisis y el plan. */
export class ListarReferenciasUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort) {}

  async ejecutar(entrada: Persona): Promise<readonly ReferenciaDto[]> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'declaracion.ver', empresaId);
    return (await this.unidad.ejecutar(empresaId, (c) => c.referencias.listar(NORMA_DECLARACION))).map(aDtoReferencia);
  }
}

