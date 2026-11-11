import { Control, type EstadoControl } from '../domain/control.js';
import { ErrorCertificacion } from '../domain/errores.js';
import { MapeoControl } from '../domain/mapeo-control.js';
import type { AutorizacionPort } from './autorizacion.port.js';
import type { CatalogoLecturaPort, EntradaCatalogo } from './catalogo-lectura.port.js';
import { exigirPermiso, identificar, validarNorma, validarUuid } from './comunes.js';
import type { ContextoCertificacion, Reloj } from './contexto.js';
import { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError } from './errores.js';
import type { UnidadDeTrabajoPort } from './unidad-de-trabajo.port.js';

type Unidad = UnidadDeTrabajoPort<ContextoCertificacion>;
/** Genera el identificador de un control nuevo (UUID). Se inyecta para poder probarlo. */
export type NuevoId = () => string;

/** Tope de controles por respuesta (el contrato lo declara con `maxItems`). */
export const TOPE_CONTROLES = 500;

export interface ControlDto {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly responsableId: string | null;
  readonly estado: EstadoControl;
  readonly version: number;
}

/** Una entrada de una norma a la que responde un control. Si la entrada ya no está en las librerías adoptadas, solo queda su identificación. */
export interface MapeoDto {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  /** Nulo si la entrada ya no está entre las librerías adoptadas por la empresa. */
  readonly entrada: { readonly tipo: 'clausula' | 'control'; readonly titulo: string; readonly aplicaA: EntradaCatalogo['aplicaA'] } | null;
}

/** Un control con las entradas que cubre y las normas que alcanza: una fila del marco de controles unificado. */
export interface ControlMarcoDto extends ControlDto {
  readonly mapeos: readonly MapeoDto[];
  /** Normas alcanzadas por sus mapeos (las que siguen en las librerías adoptadas). */
  readonly normas: readonly string[];
}

export interface MarcoControles {
  readonly controles: readonly ControlMarcoDto[];
  /** Normas de las librerías adoptadas, para el selector. */
  readonly normas: readonly string[];
}

const aDto = (c: Control): ControlDto => ({ id: c.id, codigo: c.codigo, nombre: c.nombre, descripcion: c.descripcion, responsableId: c.responsableId, estado: c.estado, version: c.version });

const versionEsperada = (v: unknown): number => {
  const n = v ?? 0;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) throw new ParametroInvalidoError('versionEsperada');
  return n;
};

/** Traduce una violación de regla del dominio a lo que la API entiende: el estado del control es un conflicto, lo demás un parámetro. */
const traducir = (e: unknown): never => {
  if (e instanceof ErrorCertificacion) {
    if (e.motivos.some((m) => m === 'retirado' || m === 'ya_retirado' || m === 'tope_de_mapeos')) throw new ConflictoError(e.motivos[0] as string);
    throw new ParametroInvalidoError(e.campo);
  }
  throw e;
};

const normasDe = (entradas: readonly EntradaCatalogo[]): string[] => [...new Set(entradas.flatMap((e) => e.aplicaA.map((a) => a.norma)))].sort((a, b) => a.localeCompare(b, 'es'));

/** Crea un control de la empresa (solo administradores). El código no se repite en la empresa, ni siquiera con uno retirado. */
export class CrearControlUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort, private readonly reloj: Reloj, private readonly nuevoId: NuevoId) {}

  async ejecutar(entrada: { empresaId: string; usuarioId: string; codigo: string; nombre: string; descripcion?: string | null; responsableId?: string | null }): Promise<ControlDto> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'controles.gestionar', empresaId);
    let control: Control;
    try {
      control = Control.crear({ id: this.nuevoId(), empresaId, codigo: entrada.codigo, nombre: entrada.nombre, descripcion: entrada.descripcion, responsableId: entrada.responsableId });
    } catch (e) {
      return traducir(e);
    }
    return this.unidad.ejecutar(empresaId, async (c) => {
      if (!(await c.controles.crear(control, usuarioId, this.reloj()))) throw new ConflictoError('codigo_repetido');
      await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'control.creado', resultado: 'ok', objeto: `control:${control.codigo}` });
      return aDto(control);
    });
  }
}

/** Cambia nombre, descripción o responsable de un control vigente (solo administradores). Concurrencia optimista por versión. */
export class CambiarControlUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort, private readonly reloj: Reloj) {}

  async ejecutar(entrada: { empresaId: string; usuarioId: string; id: string; versionEsperada?: number; nombre?: string; descripcion?: string | null; responsableId?: string | null }): Promise<ControlDto> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'controles.gestionar', empresaId);
    const id = validarUuid(entrada.id, 'id');
    const esperada = versionEsperada(entrada.versionEsperada);
    return this.unidad.ejecutar(empresaId, async (c) => {
      const previo = await c.controles.obtener(id);
      if (!previo) throw new EntradaNoEncontradaError();
      if (previo.version !== esperada) throw new ConflictoDeVersionError();
      let nuevo: Control;
      try {
        nuevo = previo.conCambios({
          ...(entrada.nombre !== undefined ? { nombre: entrada.nombre } : {}),
          ...(entrada.descripcion !== undefined ? { descripcion: entrada.descripcion } : {}),
          ...(entrada.responsableId !== undefined ? { responsableId: entrada.responsableId } : {}),
        });
      } catch (e) {
        return traducir(e);
      }
      // Sin cambios no hay escritura, versión nueva ni hecho de bitácora.
      if (nuevo === previo) return aDto(previo);
      if (!(await c.controles.actualizar(nuevo, usuarioId, this.reloj(), previo.version))) throw new ConflictoDeVersionError();
      await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'control.cambiado', resultado: 'ok', objeto: `control:${nuevo.codigo}` });
      return aDto(nuevo);
    });
  }
}

/** Retira un control (solo administradores): deja de cambiarse y de recibir mapeos, pero queda su rastro. */
export class RetirarControlUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort, private readonly reloj: Reloj) {}

  async ejecutar(entrada: { empresaId: string; usuarioId: string; id: string; versionEsperada?: number }): Promise<ControlDto> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'controles.gestionar', empresaId);
    const id = validarUuid(entrada.id, 'id');
    const esperada = versionEsperada(entrada.versionEsperada);
    return this.unidad.ejecutar(empresaId, async (c) => {
      const previo = await c.controles.obtener(id);
      if (!previo) throw new EntradaNoEncontradaError();
      if (previo.version !== esperada) throw new ConflictoDeVersionError();
      let retirado: Control;
      try {
        retirado = previo.retirar();
      } catch (e) {
        return traducir(e);
      }
      if (!(await c.controles.actualizar(retirado, usuarioId, this.reloj(), previo.version))) throw new ConflictoDeVersionError();
      await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'control.retirado', resultado: 'ok', objeto: `control:${retirado.codigo}` });
      return aDto(retirado);
    });
  }
}

interface EntradaMapeo {
  readonly empresaId: string;
  readonly usuarioId: string;
  readonly controlId: string;
  readonly libreriaCodigo: string;
  readonly idEstable: string;
}

/** Relaciona un control vigente con una entrada de las librerías adoptadas (solo administradores). Repetir un mapeo no es un error. */
export class AgregarMapeoUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort, private readonly catalogo: CatalogoLecturaPort, private readonly reloj: Reloj) {}

  /** Devuelve `true` si creó el mapeo y `false` si ya existía. */
  async ejecutar(entrada: EntradaMapeo): Promise<{ creado: boolean }> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'controles.gestionar', empresaId);
    let mapeo: MapeoControl;
    try {
      mapeo = MapeoControl.crear({ empresaId, controlId: validarUuid(entrada.controlId, 'controlId'), libreriaCodigo: entrada.libreriaCodigo, idEstable: entrada.idEstable });
    } catch (e) {
      return traducir(e);
    }
    const entradas = await this.catalogo.listarEntradasVigentes(empresaId);
    return this.unidad.ejecutar(empresaId, async (c) => {
      const control = await c.controles.obtener(mapeo.controlId);
      if (!control || !entradas.some((e) => e.libreriaCodigo === mapeo.libreriaCodigo && e.idEstable === mapeo.idEstable)) throw new EntradaNoEncontradaError();
      try {
        control.validarNuevoMapeo(await c.mapeos.contar(control.id));
      } catch (e) {
        return traducir(e);
      }
      if (!(await c.mapeos.agregar(mapeo, usuarioId, this.reloj()))) return { creado: false };
      await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'mapeo.creado', resultado: 'ok', objeto: `mapeo:${control.codigo}.${mapeo.idEstable}` });
      return { creado: true };
    });
  }
}

/** Quita la relación entre un control vigente y una entrada (solo administradores). No exige que la entrada siga adoptada. */
export class QuitarMapeoUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort) {}

  async ejecutar(entrada: EntradaMapeo): Promise<void> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'controles.gestionar', empresaId);
    let mapeo: MapeoControl;
    try {
      mapeo = MapeoControl.crear({ empresaId, controlId: validarUuid(entrada.controlId, 'controlId'), libreriaCodigo: entrada.libreriaCodigo, idEstable: entrada.idEstable });
    } catch (e) {
      return traducir(e);
    }
    await this.unidad.ejecutar(empresaId, async (c) => {
      const control = await c.controles.obtener(mapeo.controlId);
      if (!control) throw new EntradaNoEncontradaError();
      if (!control.vigente) throw new ConflictoError('retirado');
      if (!(await c.mapeos.quitar(mapeo))) throw new EntradaNoEncontradaError();
      await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'mapeo.eliminado', resultado: 'ok', objeto: `mapeo:${control.codigo}.${mapeo.idEstable}` });
    });
  }
}

export interface ListarControlesEntrada {
  readonly empresaId: string;
  readonly usuarioId: string;
  /** Por omisión solo los vigentes. */
  readonly incluirRetirados?: boolean;
  /** Solo los controles que alcanzan esta norma. */
  readonly norma?: string;
}

/** Marco de controles unificado: cada control con las entradas que cubre y las normas que alcanza (H: una medida, varias normas). */
export class ListarControlesUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort, private readonly catalogo: CatalogoLecturaPort) {}

  async ejecutar(entrada: ListarControlesEntrada): Promise<MarcoControles> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'controles.ver', empresaId);
    if (entrada.incluirRetirados !== undefined && typeof entrada.incluirRetirados !== 'boolean') throw new ParametroInvalidoError('incluirRetirados');
    const norma = entrada.norma === undefined ? null : validarNorma(entrada.norma);

    const entradas = await this.catalogo.listarEntradasVigentes(empresaId);
    const porClave = new Map(entradas.map((e) => [`${e.libreriaCodigo}|${e.idEstable}`, e]));
    const { controles, mapeos } = await this.unidad.ejecutar(empresaId, async (c) => ({ controles: await c.controles.listar(), mapeos: await c.mapeos.listar() }));
    const mapeosDe = new Map<string, MapeoDto[]>();
    for (const m of mapeos) {
      const e = porClave.get(m.claveEntrada);
      const dto: MapeoDto = { libreriaCodigo: m.libreriaCodigo, idEstable: m.idEstable, entrada: e ? { tipo: e.tipo, titulo: e.titulo, aplicaA: e.aplicaA } : null };
      mapeosDe.set(m.controlId, [...(mapeosDe.get(m.controlId) ?? []), dto]);
    }

    const filas = controles
      .filter((c) => entrada.incluirRetirados === true || c.vigente)
      .map((c): ControlMarcoDto => {
        const mapeosControl = mapeosDe.get(c.id) ?? [];
        const normas = [...new Set(mapeosControl.flatMap((m) => m.entrada?.aplicaA.map((x) => x.norma) ?? []))].sort((x, y) => x.localeCompare(y, 'es'));
        return { ...aDto(c), mapeos: mapeosControl, normas };
      })
      .filter((f) => norma === null || f.normas.includes(norma));
    if (filas.length > TOPE_CONTROLES) throw new Error(`El resultado supera el tope de ${TOPE_CONTROLES} controles del contrato`);
    return { controles: filas, normas: normasDe(entradas) };
  }
}
