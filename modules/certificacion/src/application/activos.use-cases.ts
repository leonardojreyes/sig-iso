import { Activo, CLASIFICACIONES_ACTIVO, TIPOS_ACTIVO, codigoDeActivo, type ClasificacionActivo, type EstadoActivo, type TipoActivo } from '../domain/activo.js';
import { ErrorCertificacion } from '../domain/errores.js';
import type { NivelRiesgo } from '../domain/riesgo.js';
import type { AutorizacionPort } from './autorizacion.port.js';
import { exigirPermiso, identificar, validarUuid } from './comunes.js';
import type { NuevoId } from './controles.use-cases.js';
import type { ContextoCertificacion, Reloj } from './contexto.js';
import { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError } from './errores.js';
import type { UnidadDeTrabajoPort } from './unidad-de-trabajo.port.js';

type Unidad = UnidadDeTrabajoPort<ContextoCertificacion>;

/** Tope de activos por respuesta (el contrato lo declarará con `maxItems`). */
export const TOPE_ACTIVOS = 500;
/** Tope de activos ligados a un mismo riesgo: acota la respuesta y evita ligas de relleno. */
export const ACTIVOS_POR_RIESGO_MAX = 50;
/** Intentos de tomar el número siguiente si otra persona crea un activo a la vez. */
const INTENTOS_NUMERO = 5;

export interface ActivoDto {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly tipo: TipoActivo;
  readonly clasificacion: ClasificacionActivo;
  readonly responsableId: string;
  readonly estado: EstadoActivo;
  readonly version: number;
}

export const aDtoActivo = (a: Activo): ActivoDto => ({
  id: a.id,
  codigo: a.codigo,
  nombre: a.nombre,
  descripcion: a.descripcion,
  tipo: a.tipo,
  clasificacion: a.clasificacion,
  responsableId: a.responsableId,
  estado: a.estado,
  version: a.version,
});

const versionEsperada = (v: unknown): number => {
  const n = v ?? 0;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) throw new ParametroInvalidoError('versionEsperada');
  return n;
};

/** Traduce una violación de regla del dominio: el estado del activo es un conflicto, lo demás un parámetro. */
const traducir = (e: unknown): never => {
  if (e instanceof ErrorCertificacion) {
    if (e.motivos.some((m) => m === 'retirado' || m === 'ya_retirado')) throw new ConflictoError(e.motivos[0] as string);
    throw new ParametroInvalidoError(e.campo);
  }
  throw e;
};

/** El responsable debe ser una persona ACTIVA de la empresa de la sesión; una de otra empresa o dada de baja se rechaza igual (400). */
const exigirResponsableActivo = async (c: ContextoCertificacion, responsableId: string): Promise<void> => {
  if (!(await c.personas.existeActiva(responsableId))) throw new ParametroInvalidoError('responsableId');
};

export interface DatosActivoEntrada {
  readonly nombre: string;
  readonly descripcion?: string | null;
  readonly tipo: TipoActivo;
  readonly clasificacion: ClasificacionActivo;
  readonly responsableId: string;
}

/** Crea un activo de la empresa (solo administradores). El código «A-001» es correlativo, lo asigna el sistema y no se reutiliza. */
export class CrearActivoUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort, private readonly reloj: Reloj, private readonly nuevoId: NuevoId) {}

  async ejecutar(entrada: DatosActivoEntrada & { empresaId: string; usuarioId: string }): Promise<ActivoDto> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'activos.gestionar', empresaId);
    const id = this.nuevoId();
    // Se valida con un código provisional para responder 400 antes de tocar la base; el definitivo sale del siguiente número.
    const armar = (codigo: string): Activo => {
      try {
        return Activo.crear({ id, empresaId, codigo, nombre: entrada.nombre, descripcion: entrada.descripcion, tipo: entrada.tipo, clasificacion: entrada.clasificacion, responsableId: entrada.responsableId });
      } catch (e) {
        return traducir(e);
      }
    };
    armar(codigoDeActivo(1));
    return this.unidad.ejecutar(empresaId, async (c) => {
      await exigirResponsableActivo(c, entrada.responsableId.toLowerCase());
      // El tope se aplica al CREAR (un activo no se borra): si no, una empresa podría pasarlo y dejar inservible la lista.
      if ((await c.activos.listar()).length >= TOPE_ACTIVOS) throw new ConflictoError('tope_de_activos');
      for (let intento = 0; intento < INTENTOS_NUMERO; intento++) {
        const activo = armar(codigoDeActivo(await c.activos.siguienteNumero()));
        if (!(await c.activos.crear(activo, usuarioId, this.reloj()))) continue;
        await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'activo.creado', resultado: 'ok', objeto: `activo:${activo.codigo}` });
        return aDtoActivo(activo);
      }
      throw new ConflictoError('codigo_repetido');
    });
  }
}

export interface CambiosActivoEntrada {
  readonly nombre?: string;
  readonly descripcion?: string | null;
  readonly tipo?: TipoActivo;
  readonly clasificacion?: ClasificacionActivo;
  readonly responsableId?: string;
}

/** Cambia un activo vigente (solo administradores). Concurrencia optimista por versión: la segunda persona recibe 409. */
export class CambiarActivoUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort, private readonly reloj: Reloj) {}

  async ejecutar(entrada: CambiosActivoEntrada & { empresaId: string; usuarioId: string; id: string; versionEsperada?: number }): Promise<ActivoDto> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'activos.gestionar', empresaId);
    const id = validarUuid(entrada.id, 'id');
    const esperada = versionEsperada(entrada.versionEsperada);
    return this.unidad.ejecutar(empresaId, async (c) => {
      const previo = await c.activos.obtener(id);
      if (!previo) throw new EntradaNoEncontradaError();
      if (previo.version !== esperada) throw new ConflictoDeVersionError();
      let nuevo: Activo;
      try {
        nuevo = previo.conCambios({
          ...(entrada.nombre !== undefined ? { nombre: entrada.nombre } : {}),
          ...(entrada.descripcion !== undefined ? { descripcion: entrada.descripcion } : {}),
          ...(entrada.tipo !== undefined ? { tipo: entrada.tipo } : {}),
          ...(entrada.clasificacion !== undefined ? { clasificacion: entrada.clasificacion } : {}),
          ...(entrada.responsableId !== undefined ? { responsableId: entrada.responsableId } : {}),
        });
      } catch (e) {
        return traducir(e);
      }
      // Sin cambios no hay escritura, versión nueva ni hecho de bitácora.
      if (nuevo === previo) return aDtoActivo(previo);
      // Solo se exige «activa» al responsable NUEVO: quien ya lo era y luego se dio de baja no impide corregir otros datos.
      if (nuevo.responsableId !== previo.responsableId) await exigirResponsableActivo(c, nuevo.responsableId);
      if (!(await c.activos.actualizar(nuevo, usuarioId, this.reloj(), previo.version))) throw new ConflictoDeVersionError();
      await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'activo.cambiado', resultado: 'ok', objeto: `activo:${nuevo.codigo}` });
      return aDtoActivo(nuevo);
    });
  }
}

export interface AvisoRetiroActivoDto {
  readonly activoId: string;
  readonly codigo: string;
  /** Riesgos vigentes cuyo ÚNICO activo vigente es este: quedarían sin ningún activo. Vacío = el retiro no deja ninguno así. */
  readonly riesgosSinActivo: readonly { readonly id: string; readonly codigo: string; readonly titulo: string }[];
}

/**
 * Aviso previo al retiro (H1.2): qué riesgos vigentes quedarían SIN ningún activo vigente si se retira este. No cambia nada: la pantalla
 * lo muestra antes de que la persona confirme. Solo para quien puede retirar. Un activo ajeno es 404.
 */
export class AvisoRetiroActivoUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort) {}

  async ejecutar(entrada: { empresaId: string; usuarioId: string; id: string }): Promise<AvisoRetiroActivoDto> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'activos.gestionar', empresaId);
    const id = validarUuid(entrada.id, 'id');
    const d = await this.unidad.ejecutar(empresaId, async (c) => ({ activo: await c.activos.obtener(id), activos: await c.activos.listar(), riesgos: await c.riesgos.listar(), ligas: await c.ligasActivo.listar() }));
    if (!d.activo) throw new EntradaNoEncontradaError();
    // Un activo ya retirado no sostiene a ningún riesgo: no hay nada que avisar.
    if (!d.activo.vigente) return { activoId: d.activo.id, codigo: d.activo.codigo, riesgosSinActivo: [] };
    const vigentes = new Set(d.activos.filter((a) => a.vigente).map((a) => a.id));
    const riesgosSinActivo = d.riesgos
      .filter((r) => r.vigente)
      .filter((r) => {
        const suyos = d.ligas.filter((l) => l.riesgoId === r.id && vigentes.has(l.activoId));
        return suyos.length === 1 && suyos[0]?.activoId === id;
      })
      .map((r) => ({ id: r.id, codigo: r.codigo, titulo: r.titulo }));
    return { activoId: d.activo.id, codigo: d.activo.codigo, riesgosSinActivo };
  }
}

/** Retira un activo (solo administradores): no se borra, conserva su historia y deja de contarse como vigente. Las ligas se conservan. */
export class RetirarActivoUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort, private readonly reloj: Reloj) {}

  async ejecutar(entrada: { empresaId: string; usuarioId: string; id: string; versionEsperada?: number }): Promise<ActivoDto> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'activos.gestionar', empresaId);
    const id = validarUuid(entrada.id, 'id');
    const esperada = versionEsperada(entrada.versionEsperada);
    return this.unidad.ejecutar(empresaId, async (c) => {
      const previo = await c.activos.obtener(id);
      if (!previo) throw new EntradaNoEncontradaError();
      if (previo.version !== esperada) throw new ConflictoDeVersionError();
      let retirado: Activo;
      try {
        retirado = previo.retirar();
      } catch (e) {
        return traducir(e);
      }
      if (!(await c.activos.actualizar(retirado, usuarioId, this.reloj(), previo.version))) throw new ConflictoDeVersionError();
      await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'activo.retirado', resultado: 'ok', objeto: `activo:${retirado.codigo}` });
      return aDtoActivo(retirado);
    });
  }
}

/** Un activo de la lista, con cuántos riesgos vigentes tiene ligados (H1.5). */
export interface ActivoListadoDto extends ActivoDto {
  /** Riesgos VIGENTES ligados. */
  readonly riesgos: number;
  /** Activo vigente sin ningún riesgo vigente ligado: es un aviso, no un error. */
  readonly sinRiesgos: boolean;
}

export interface FiltroActivos {
  readonly tipo?: TipoActivo;
  readonly clasificacion?: ClasificacionActivo;
  readonly responsableId?: string;
  readonly incluirRetirados?: boolean;
}

/** Lista los activos de la empresa con filtros (administrador y colaborador consultan). Por omisión solo los vigentes. */
export class ListarActivosUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort) {}

  async ejecutar(entrada: FiltroActivos & { empresaId: string; usuarioId: string }): Promise<readonly ActivoListadoDto[]> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'activos.ver', empresaId);
    if (entrada.incluirRetirados !== undefined && typeof entrada.incluirRetirados !== 'boolean') throw new ParametroInvalidoError('incluirRetirados');
    const responsable = entrada.responsableId === undefined ? undefined : validarUuid(entrada.responsableId, 'responsableId');
    const tipos: readonly string[] = TIPOS_ACTIVO;
    if (entrada.tipo !== undefined && !tipos.includes(entrada.tipo)) throw new ParametroInvalidoError('tipo');
    if (entrada.clasificacion !== undefined && !(CLASIFICACIONES_ACTIVO as readonly string[]).includes(entrada.clasificacion)) throw new ParametroInvalidoError('clasificacion');
    const { activos, riesgos, ligas } = await this.unidad.ejecutar(empresaId, async (c) => ({ activos: await c.activos.listar(), riesgos: await c.riesgos.listar(), ligas: await c.ligasActivo.listar() }));
    const riesgosVigentes = new Set(riesgos.filter((r) => r.vigente).map((r) => r.id));
    const filas = activos
      .filter((a) => entrada.incluirRetirados === true || a.vigente)
      .filter((a) => (entrada.tipo === undefined || a.tipo === entrada.tipo) && (entrada.clasificacion === undefined || a.clasificacion === entrada.clasificacion) && (responsable === undefined || a.responsableId === responsable))
      .map((a): ActivoListadoDto => {
        const n = ligas.filter((l) => l.activoId === a.id && riesgosVigentes.has(l.riesgoId)).length;
        return { ...aDtoActivo(a), riesgos: n, sinRiesgos: a.vigente && n === 0 };
      });
    if (filas.length > TOPE_ACTIVOS) throw new Error(`El resultado supera el tope de ${TOPE_ACTIVOS} activos del contrato`);
    return filas;
  }
}

/** Un riesgo ligado a un activo (o un activo de un riesgo). El nivel es el inicial calculado hoy. */
export interface RiesgoDeActivoDto {
  readonly id: string;
  readonly codigo: string;
  readonly titulo: string;
  readonly nivel: NivelRiesgo;
  readonly puntaje: number;
  readonly estado: 'vigente' | 'retirado';
}
export interface ActivoDetalleDto extends ActivoDto {
  readonly riesgos: readonly RiesgoDeActivoDto[];
  /** Nivel del riesgo VIGENTE más alto ligado; nulo si no hay ninguno. */
  readonly nivelMasAlto: NivelRiesgo | null;
}

/** Un activo por su identificador, con sus riesgos. Uno de otra empresa responde igual que uno que no existe (404). */
export class ObtenerActivoUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort) {}

  async ejecutar(entrada: { empresaId: string; usuarioId: string; id: string }): Promise<ActivoDetalleDto> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'activos.ver', empresaId);
    const id = validarUuid(entrada.id, 'id');
    const d = await this.unidad.ejecutar(empresaId, async (c) => {
      const activo = await c.activos.obtener(id);
      if (!activo) return null;
      const ids = new Set((await c.ligasActivo.listar()).filter((l) => l.activoId === id).map((l) => l.riesgoId));
      return { activo, riesgos: (await c.riesgos.listar()).filter((r) => ids.has(r.id)) };
    });
    if (!d) throw new EntradaNoEncontradaError();
    const vigentes = d.riesgos.filter((r) => r.vigente);
    const mayor = vigentes.reduce<(typeof vigentes)[number] | null>((m, r) => (m === null || r.puntaje > m.puntaje ? r : m), null);
    return {
      ...aDtoActivo(d.activo),
      riesgos: d.riesgos.map((r) => ({ id: r.id, codigo: r.codigo, titulo: r.titulo, nivel: r.nivel, puntaje: r.puntaje, estado: r.estado })),
      nivelMasAlto: mayor?.nivel ?? null,
    };
  }
}

/** Los activos de un riesgo (H1.3). Un riesgo de otra empresa responde igual que uno que no existe (404). */
export class ActivosDeUnRiesgoUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort) {}

  async ejecutar(entrada: { empresaId: string; usuarioId: string; riesgoId: string }): Promise<readonly ActivoDto[]> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'activos.ver', empresaId);
    const riesgoId = validarUuid(entrada.riesgoId, 'riesgoId');
    const d = await this.unidad.ejecutar(empresaId, async (c) => {
      if (!(await c.riesgos.obtener(riesgoId))) return null;
      const ids = new Set((await c.ligasActivo.listar()).filter((l) => l.riesgoId === riesgoId).map((l) => l.activoId));
      return (await c.activos.listar()).filter((a) => ids.has(a.id));
    });
    if (!d) throw new EntradaNoEncontradaError();
    return d.map(aDtoActivo);
  }
}

interface Liga {
  readonly empresaId: string;
  readonly usuarioId: string;
  readonly riesgoId: string;
  readonly activoId: string;
}

/** Liga un riesgo vigente con un activo vigente de la empresa (solo administradores). Repetir una liga no es un error. */
export class LigarActivoUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort, private readonly reloj: Reloj) {}

  /** `true` si creó la liga y `false` si ya existía. */
  async ejecutar(entrada: Liga): Promise<{ creado: boolean }> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'activos.gestionar', empresaId);
    const riesgoId = validarUuid(entrada.riesgoId, 'riesgoId');
    const activoId = validarUuid(entrada.activoId, 'activoId');
    return this.unidad.ejecutar(empresaId, async (c) => {
      const riesgo = await c.riesgos.obtener(riesgoId);
      const activo = await c.activos.obtener(activoId);
      if (!riesgo || !activo) throw new EntradaNoEncontradaError();
      if (!riesgo.vigente) throw new ConflictoError('riesgo_retirado');
      if (!activo.vigente) throw new ConflictoError('activo_retirado');
      if ((await c.ligasActivo.contarDeRiesgo(riesgoId)) >= ACTIVOS_POR_RIESGO_MAX) throw new ConflictoError('tope_de_activos');
      if (!(await c.ligasActivo.agregar(riesgoId, activoId, usuarioId, this.reloj()))) return { creado: false };
      await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'activo.ligado', resultado: 'ok', objeto: `vinculo:${riesgo.codigo}.${activo.codigo}` });
      return { creado: true };
    });
  }
}

/** Quita la liga de un riesgo vigente con un activo, también si el activo ya fue retirado (solo administradores). */
export class DesligarActivoUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort) {}

  async ejecutar(entrada: Liga): Promise<void> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'activos.gestionar', empresaId);
    const riesgoId = validarUuid(entrada.riesgoId, 'riesgoId');
    const activoId = validarUuid(entrada.activoId, 'activoId');
    await this.unidad.ejecutar(empresaId, async (c) => {
      const riesgo = await c.riesgos.obtener(riesgoId);
      const activo = await c.activos.obtener(activoId);
      if (!riesgo || !activo) throw new EntradaNoEncontradaError();
      if (!riesgo.vigente) throw new ConflictoError('riesgo_retirado');
      if (!(await c.ligasActivo.quitar(riesgoId, activoId))) throw new EntradaNoEncontradaError();
      await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'activo.desligado', resultado: 'ok', objeto: `vinculo:${riesgo.codigo}.${activo.codigo}` });
    });
  }
}
