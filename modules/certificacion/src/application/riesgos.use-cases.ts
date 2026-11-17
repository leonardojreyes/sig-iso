import { ErrorCertificacion } from '../domain/errores.js';
import { codigoDeRiesgo, Riesgo, type DecisionTratamiento, type EstadoRiesgo, type NivelRiesgo } from '../domain/riesgo.js';
import type { AutorizacionPort } from './autorizacion.port.js';
import { exigirPermiso, identificar, validarUuid } from './comunes.js';
import type { CatalogoLecturaPort } from './catalogo-lectura.port.js';
import type { NuevoId } from './controles.use-cases.js';
import type { ContextoCertificacion, Reloj } from './contexto.js';
import { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError } from './errores.js';
import type { UnidadDeTrabajoPort } from './unidad-de-trabajo.port.js';

type Unidad = UnidadDeTrabajoPort<ContextoCertificacion>;

/** Tope de riesgos por respuesta (el contrato lo declarará con `maxItems`). */
export const TOPE_RIESGOS = 500;
/** Intentos de tomar el número siguiente si otra persona crea un riesgo a la vez. */
const INTENTOS_NUMERO = 5;

export interface RiesgoDto {
  readonly id: string;
  readonly codigo: string;
  readonly titulo: string;
  readonly descripcion: string | null;
  readonly probabilidad: number;
  readonly impacto: number;
  /** Probabilidad × impacto. */
  readonly puntaje: number;
  /** Nivel inicial, calculado (nunca escrito por la persona). */
  readonly nivel: NivelRiesgo;
  readonly decision: DecisionTratamiento;
  readonly responsableId: string | null;
  readonly estado: EstadoRiesgo;
  readonly version: number;
}

export const aDtoRiesgo = (r: Riesgo): RiesgoDto => ({
  id: r.id,
  codigo: r.codigo,
  titulo: r.titulo,
  descripcion: r.descripcion,
  probabilidad: r.probabilidad,
  impacto: r.impacto,
  puntaje: r.puntaje,
  nivel: r.nivel,
  decision: r.decision,
  responsableId: r.responsableId,
  estado: r.estado,
  version: r.version,
});

const versionEsperada = (v: unknown): number => {
  const n = v ?? 0;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) throw new ParametroInvalidoError('versionEsperada');
  return n;
};

/** Traduce una violación de regla del dominio: el estado del riesgo es un conflicto, lo demás un parámetro. */
const traducir = (e: unknown): never => {
  if (e instanceof ErrorCertificacion) {
    if (e.motivos.some((m) => m === 'retirado' || m === 'ya_retirado')) throw new ConflictoError(e.motivos[0] as string);
    throw new ParametroInvalidoError(e.campo);
  }
  throw e;
};

export interface DatosRiesgoEntrada {
  readonly titulo: string;
  readonly descripcion?: string | null;
  readonly probabilidad: number;
  readonly impacto: number;
  readonly decision: DecisionTratamiento;
  readonly responsableId?: string | null;
}

/** Crea un riesgo de la empresa (solo administradores). El código «R-001» es correlativo, lo asigna el sistema y no se reutiliza. */
export class CrearRiesgoUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort, private readonly reloj: Reloj, private readonly nuevoId: NuevoId) {}

  async ejecutar(entrada: DatosRiesgoEntrada & { empresaId: string; usuarioId: string }): Promise<RiesgoDto> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'riesgos.gestionar', empresaId);
    const id = this.nuevoId();
    // Se valida con un código provisional para responder 400 antes de tocar la base; el definitivo sale del siguiente número.
    const armar = (codigo: string): Riesgo => {
      try {
        return Riesgo.crear({ id, empresaId, codigo, titulo: entrada.titulo, descripcion: entrada.descripcion, probabilidad: entrada.probabilidad, impacto: entrada.impacto, decision: entrada.decision, responsableId: entrada.responsableId });
      } catch (e) {
        return traducir(e);
      }
    };
    armar(codigoDeRiesgo(1));
    return this.unidad.ejecutar(empresaId, async (c) => {
      for (let intento = 0; intento < INTENTOS_NUMERO; intento++) {
        const riesgo = armar(codigoDeRiesgo(await c.riesgos.siguienteNumero()));
        if (!(await c.riesgos.crear(riesgo, usuarioId, this.reloj()))) continue;
        await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'riesgo.creado', resultado: 'ok', objeto: `riesgo:${riesgo.codigo}` });
        return aDtoRiesgo(riesgo);
      }
      throw new ConflictoError('codigo_repetido');
    });
  }
}

export interface CambiosRiesgoEntrada {
  readonly titulo?: string;
  readonly descripcion?: string | null;
  readonly probabilidad?: number;
  readonly impacto?: number;
  readonly decision?: DecisionTratamiento;
  readonly responsableId?: string | null;
}

/** Cambia un riesgo vigente (solo administradores). Concurrencia optimista por versión: la segunda persona recibe 409. */
export class CambiarRiesgoUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort, private readonly reloj: Reloj) {}

  async ejecutar(entrada: CambiosRiesgoEntrada & { empresaId: string; usuarioId: string; id: string; versionEsperada?: number }): Promise<RiesgoDto> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'riesgos.gestionar', empresaId);
    const id = validarUuid(entrada.id, 'id');
    const esperada = versionEsperada(entrada.versionEsperada);
    return this.unidad.ejecutar(empresaId, async (c) => {
      const previo = await c.riesgos.obtener(id);
      if (!previo) throw new EntradaNoEncontradaError();
      if (previo.version !== esperada) throw new ConflictoDeVersionError();
      let nuevo: Riesgo;
      try {
        nuevo = previo.conCambios({
          ...(entrada.titulo !== undefined ? { titulo: entrada.titulo } : {}),
          ...(entrada.descripcion !== undefined ? { descripcion: entrada.descripcion } : {}),
          ...(entrada.probabilidad !== undefined ? { probabilidad: entrada.probabilidad } : {}),
          ...(entrada.impacto !== undefined ? { impacto: entrada.impacto } : {}),
          ...(entrada.decision !== undefined ? { decision: entrada.decision } : {}),
          ...(entrada.responsableId !== undefined ? { responsableId: entrada.responsableId } : {}),
        });
      } catch (e) {
        return traducir(e);
      }
      // Sin cambios no hay escritura, versión nueva ni hecho de bitácora.
      if (nuevo === previo) return aDtoRiesgo(previo);
      if (!(await c.riesgos.actualizar(nuevo, usuarioId, this.reloj(), previo.version))) throw new ConflictoDeVersionError();
      await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'riesgo.cambiado', resultado: 'ok', objeto: `riesgo:${nuevo.codigo}` });
      return aDtoRiesgo(nuevo);
    });
  }
}

/**
 * Retira un riesgo (solo administradores): no se borra, conserva su historia y deja de contarse como vigente. El aviso previo de los
 * controles que quedarían sin motivo lo calcula `efectoDeRetirarRiesgo` (dominio) y lo ofrece el caso de uso de motivos.
 */
export class RetirarRiesgoUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort, private readonly reloj: Reloj) {}

  async ejecutar(entrada: { empresaId: string; usuarioId: string; id: string; versionEsperada?: number }): Promise<RiesgoDto> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'riesgos.gestionar', empresaId);
    const id = validarUuid(entrada.id, 'id');
    const esperada = versionEsperada(entrada.versionEsperada);
    return this.unidad.ejecutar(empresaId, async (c) => {
      const previo = await c.riesgos.obtener(id);
      if (!previo) throw new EntradaNoEncontradaError();
      if (previo.version !== esperada) throw new ConflictoDeVersionError();
      let retirado: Riesgo;
      try {
        retirado = previo.retirar();
      } catch (e) {
        return traducir(e);
      }
      if (!(await c.riesgos.actualizar(retirado, usuarioId, this.reloj(), previo.version))) throw new ConflictoDeVersionError();
      await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'riesgo.retirado', resultado: 'ok', objeto: `riesgo:${retirado.codigo}` });
      return aDtoRiesgo(retirado);
    });
  }
}

/** Un riesgo de la lista, con cuánto tratamiento tiene (H2.5). */
export interface RiesgoListadoDto extends RiesgoDto {
  /** Controles VIGENTES de la empresa que lo tratan. */
  readonly controles: number;
  /** Controles del Anexo A vinculados directo (tratamiento previsto). */
  readonly tratamientosPrevistos: number;
  /** Decisión «mitigar», vigente y sin ningún control vigente ni tratamiento previsto. */
  readonly sinTratamiento: boolean;
}

/** Lista los riesgos de la empresa (administrador y colaborador consultan). Por omisión solo los vigentes. */
export class ListarRiesgosUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort) {}

  async ejecutar(entrada: { empresaId: string; usuarioId: string; incluirRetirados?: boolean }): Promise<readonly RiesgoListadoDto[]> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'riesgos.ver', empresaId);
    if (entrada.incluirRetirados !== undefined && typeof entrada.incluirRetirados !== 'boolean') throw new ParametroInvalidoError('incluirRetirados');
    const { riesgos, controles, vinculosControl, vinculosEntrada } = await this.unidad.ejecutar(empresaId, async (c) => ({
      riesgos: await c.riesgos.listar(),
      controles: await c.controles.listar(),
      vinculosControl: await c.vinculosRiesgo.listarControles(),
      vinculosEntrada: await c.vinculosRiesgo.listarEntradas(),
    }));
    const vigentes = new Set(controles.filter((x) => x.vigente).map((x) => x.id));
    const cuenta = (riesgoId: string) => ({
      controles: vinculosControl.filter((v) => v.riesgoId === riesgoId && vigentes.has(v.controlId)).length,
      tratamientosPrevistos: vinculosEntrada.filter((v) => v.riesgoId === riesgoId).length,
    });
    const filas = riesgos
      .filter((r) => entrada.incluirRetirados === true || r.vigente)
      .map((r): RiesgoListadoDto => {
        const n = cuenta(r.id);
        return { ...aDtoRiesgo(r), ...n, sinTratamiento: r.vigente && r.decision === 'mitigar' && n.controles === 0 && n.tratamientosPrevistos === 0 };
      });
    if (filas.length > TOPE_RIESGOS) throw new Error(`El resultado supera el tope de ${TOPE_RIESGOS} riesgos del contrato`);
    return filas;
  }
}

/** Un control de la empresa que trata el riesgo; si ya fue retirado se dice (el vínculo se conserva, avisado). */
export interface ControlDeRiesgoDto {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly estado: 'vigente' | 'retirado';
}
/** Un control del Anexo A vinculado directo. `titulo` es nulo si la entrada ya no está entre las librerías adoptadas. */
export interface TratamientoPrevistoDto {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  readonly titulo: string | null;
}
/** H2.4: el riesgo con los controles que lo tratan (de la empresa y del Anexo A previstos). */
export interface RiesgoDetalleDto extends RiesgoDto {
  readonly controles: readonly ControlDeRiesgoDto[];
  readonly tratamientosPrevistos: readonly TratamientoPrevistoDto[];
}

/** Un riesgo por su identificador, con sus controles. Uno de otra empresa responde igual que uno que no existe (404). */
export class ObtenerRiesgoUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort, private readonly catalogo: CatalogoLecturaPort) {}

  async ejecutar(entrada: { empresaId: string; usuarioId: string; id: string }): Promise<RiesgoDetalleDto> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'riesgos.ver', empresaId);
    const id = validarUuid(entrada.id, 'id');
    const datos = await this.unidad.ejecutar(empresaId, async (c) => {
      const riesgo = await c.riesgos.obtener(id);
      if (!riesgo) return null;
      const idsControl = new Set((await c.vinculosRiesgo.listarControles()).filter((v) => v.riesgoId === id).map((v) => v.controlId));
      return {
        riesgo,
        controles: (await c.controles.listar()).filter((x) => idsControl.has(x.id)),
        previstos: (await c.vinculosRiesgo.listarEntradas()).filter((v) => v.riesgoId === id),
      };
    });
    if (!datos) throw new EntradaNoEncontradaError();
    const entradas = await this.catalogo.listarEntradasVigentes(empresaId);
    const titulos = new Map(entradas.map((e) => [`${e.libreriaCodigo}|${e.idEstable}`, e.titulo]));
    return {
      ...aDtoRiesgo(datos.riesgo),
      controles: datos.controles.map((x) => ({ id: x.id, codigo: x.codigo, nombre: x.nombre, estado: x.estado })),
      tratamientosPrevistos: datos.previstos.map((v) => ({ libreriaCodigo: v.libreriaCodigo, idEstable: v.idEstable, titulo: titulos.get(`${v.libreriaCodigo}|${v.idEstable}`) ?? null })),
    };
  }
}
