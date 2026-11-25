import type { RelacionProceso } from '../domain/independencia.js';
import {
  codigoDeProceso,
  NOMBRE_GESTION_SIG,
  RELACIONES_POR_PROCESO_MAX,
  validarCambioRelevante,
  validarDescripcionProceso,
  validarFrecuencia,
  validarImportancia,
  validarNombreProceso,
  validarRelacion,
  type CambioRelevante,
  type FrecuenciaProceso,
  type ImportanciaProceso,
} from '../domain/proceso.js';
import type { FilaProceso, FilaRelacion } from './auditoria.port.js';
import type { AutorizacionPort } from './autorizacion.port.js';
import { exigirPermiso, identificar, validarUuid } from './comunes.js';
import type { ContextoCertificacion, Reloj } from './contexto.js';
import { exigirPersonaActiva, traducirDominio } from './documentos.use-cases.js';
import { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError } from './errores.js';
import type { UnidadDeTrabajoPort } from './unidad-de-trabajo.port.js';

// Auditoría interna (ADR 040): procesos y personas relacionadas con ellos. Permiso: `auditoria.ver` para consultar y
// `auditoria.gestionar` (solo administrador SIG) para escribir. Orden de evaluación: 401 → 403 → 400 → 404 → 409.

type Unidad = UnidadDeTrabajoPort<ContextoCertificacion>;

/** Tope de procesos por empresa: acota las listas (el contrato lo declara con `maxItems`). */
export const TOPE_PROCESOS = 200;
const INTENTOS_NUMERO = 5;

export type AvisoProceso = 'sin_relaciones' | 'duena_inactiva';
export interface ProcesoDto {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly duenaId: string;
  readonly importancia: ImportanciaProceso;
  readonly frecuencia: FrecuenciaProceso;
  readonly transversal: boolean;
  readonly cambioRelevante: CambioRelevante | null;
  readonly estado: 'vigente' | 'retirado';
  readonly version: number;
  readonly personasRelacionadas: number;
  readonly avisos: readonly AvisoProceso[];
}
export interface ListaProcesos {
  readonly procesos: readonly ProcesoDto[];
  /** Ya existe el proceso transversal «Gestión del SIG» vigente (la pantalla ofrece crearlo si no). */
  readonly gestionSigVigente: boolean;
}
export interface RelacionDto {
  readonly procesoId: string;
  readonly personaId: string;
  readonly relacion: RelacionProceso;
}

const aDto = (p: FilaProceso, relaciones: readonly FilaRelacion[], activas: ReadonlySet<string>): ProcesoDto => {
  const suyas = relaciones.filter((r) => r.procesoId === p.id);
  const avisos: AvisoProceso[] = [];
  if (p.estado === 'vigente') {
    if (new Set(suyas.map((r) => r.usuarioId)).size === 0) avisos.push('sin_relaciones');
    if (!activas.has(p.duenaId)) avisos.push('duena_inactiva');
  }
  return {
    id: p.id,
    codigo: p.codigo,
    nombre: p.nombre,
    descripcion: p.descripcion,
    duenaId: p.duenaId,
    importancia: p.importancia,
    frecuencia: p.frecuencia,
    transversal: p.transversal,
    cambioRelevante: p.cambioRelevante,
    estado: p.estado,
    version: p.version,
    personasRelacionadas: new Set(suyas.map((r) => r.usuarioId)).size,
    avisos,
  };
};

const exigirProceso = async (c: ContextoCertificacion, id: string): Promise<FilaProceso> => {
  const p = await c.procesos.obtener(id);
  if (!p) throw new EntradaNoEncontradaError();
  return p;
};
const exigirProcesoVigente = async (c: ContextoCertificacion, id: string): Promise<FilaProceso> => {
  const p = await exigirProceso(c, id);
  if (p.estado !== 'vigente') throw new ConflictoError('proceso_retirado');
  return p;
};

export class ListarProcesosUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string }): Promise<ListaProcesos> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.ver', empresaId);
    return this.unidad.ejecutar(empresaId, async (c) => {
      const [procesos, relaciones, personas] = await Promise.all([c.procesos.listar(), c.relaciones.listar(), c.personas.listar()]);
      const activas = new Set(personas.filter((p) => p.activa).map((p) => p.id));
      const lista = procesos.slice(0, TOPE_PROCESOS).map((p) => aDto(p, relaciones, activas));
      return { procesos: lista, gestionSigVigente: procesos.some((p) => p.transversal && p.estado === 'vigente') };
    });
  }
}

interface DatosNuevoProceso {
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly duenaId: string;
  readonly importancia: ImportanciaProceso;
  readonly frecuencia: FrecuenciaProceso;
  readonly transversal: boolean;
}

/** Crea el proceso con su correlativo, deja a la dueña como relación «dueña» y registra ambos hechos en la bitácora. */
const crearProceso = async (
  c: ContextoCertificacion,
  d: DatosNuevoProceso,
  ctx: { empresaId: ReturnType<typeof identificar>['empresaId']; usuarioId: string; ahora: Date; nuevoId: () => string },
): Promise<FilaProceso> => {
  if ((await c.procesos.listar()).length >= TOPE_PROCESOS) throw new ConflictoError('tope_de_procesos');
  const id = ctx.nuevoId();
  for (let intento = 0; intento < INTENTOS_NUMERO; intento += 1) {
    const numero = await c.procesos.siguienteNumero();
    if (await c.procesos.crear({ id, numero, ...d }, ctx.usuarioId, ctx.ahora)) {
      const codigo = codigoDeProceso(numero);
      await c.relaciones.agregar({ procesoId: id, usuarioId: d.duenaId, relacion: 'duena' }, ctx.usuarioId, ctx.ahora);
      const actor = { tipo: 'usuario', usuarioId: ctx.usuarioId } as const;
      await c.bitacora.registrar({
        empresaId: ctx.empresaId,
        actor,
        accion: 'proceso.creado',
        resultado: 'ok',
        objeto: `proceso:${codigo}`,
      });
      await c.bitacora.registrar({
        empresaId: ctx.empresaId,
        actor,
        accion: 'relacion.creada',
        resultado: 'ok',
        objeto: `relacion:${codigo}`,
        despues: { persona_id: d.duenaId, relacion: 'duena' },
      });
      return (await c.procesos.obtener(id)) as FilaProceso;
    }
  }
  throw new ConflictoError('codigo_repetido');
};

export class CrearProcesoUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly reloj: Reloj,
    private readonly nuevoId: () => string,
  ) {}

  async ejecutar(e: {
    empresaId: string;
    usuarioId: string;
    nombre?: unknown;
    descripcion?: unknown;
    duenaId?: unknown;
    importancia?: unknown;
    frecuencia?: unknown;
  }): Promise<ProcesoDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.gestionar', empresaId);
    const datos = traducirDominio(() => ({
      nombre: validarNombreProceso(e.nombre),
      descripcion: validarDescripcionProceso(e.descripcion),
      importancia: e.importancia === undefined ? ('media' as const) : validarImportancia(e.importancia),
      frecuencia: e.frecuencia === undefined ? ('anual' as const) : validarFrecuencia(e.frecuencia),
    }));
    const duenaId = validarUuid(e.duenaId, 'duenaId');
    const ahora = this.reloj();
    return this.unidad.ejecutar(empresaId, async (c) => {
      await exigirPersonaActiva(c, duenaId, 'duenaId');
      const p = await crearProceso(c, { ...datos, duenaId, transversal: false }, { empresaId, usuarioId, ahora, nuevoId: this.nuevoId });
      return aDto(p, [{ procesoId: p.id, usuarioId: duenaId, relacion: 'duena' }], new Set([duenaId]));
    });
  }
}

/** Crea el proceso transversal «Gestión del SIG» con quien llama como dueña. Solo puede haber uno vigente. */
export class CrearGestionSigUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly reloj: Reloj,
    private readonly nuevoId: () => string,
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string }): Promise<ProcesoDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.gestionar', empresaId);
    const ahora = this.reloj();
    return this.unidad.ejecutar(empresaId, async (c) => {
      if (await c.procesos.transversalVigente()) throw new ConflictoError('ya_existe');
      await exigirPersonaActiva(c, usuarioId, 'usuarioId');
      const p = await crearProceso(
        c,
        { nombre: NOMBRE_GESTION_SIG, descripcion: null, duenaId: usuarioId, importancia: 'alta', frecuencia: 'anual', transversal: true },
        { empresaId, usuarioId, ahora, nuevoId: this.nuevoId },
      );
      return aDto(p, [{ procesoId: p.id, usuarioId, relacion: 'duena' }], new Set([usuarioId]));
    });
  }
}

export class ActualizarProcesoUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(e: {
    empresaId: string;
    usuarioId: string;
    id: string;
    versionEsperada?: unknown;
    nombre?: unknown;
    descripcion?: unknown;
    duenaId?: unknown;
    importancia?: unknown;
    frecuencia?: unknown;
    cambioRelevante?: unknown;
  }): Promise<ProcesoDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.gestionar', empresaId);
    const id = validarUuid(e.id, 'id');
    const version = e.versionEsperada;
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) throw new ParametroInvalidoError('versionEsperada');
    const cambios = traducirDominio(() => ({
      ...(e.nombre !== undefined ? { nombre: validarNombreProceso(e.nombre) } : {}),
      ...(e.descripcion !== undefined ? { descripcion: validarDescripcionProceso(e.descripcion) } : {}),
      ...(e.importancia !== undefined ? { importancia: validarImportancia(e.importancia) } : {}),
      ...(e.frecuencia !== undefined ? { frecuencia: validarFrecuencia(e.frecuencia) } : {}),
      ...(e.cambioRelevante !== undefined ? { cambioRelevante: validarCambioRelevante(e.cambioRelevante) } : {}),
    }));
    const duenaId = e.duenaId === undefined ? undefined : validarUuid(e.duenaId, 'duenaId');
    if (Object.keys(cambios).length === 0 && duenaId === undefined) throw new ParametroInvalidoError('cambios');
    const ahora = this.reloj();
    return this.unidad.ejecutar(empresaId, async (c) => {
      const actual = await exigirProcesoVigente(c, id);
      if (duenaId !== undefined && duenaId !== actual.duenaId) await exigirPersonaActiva(c, duenaId, 'duenaId');
      if (!(await c.procesos.actualizar(id, { ...cambios, ...(duenaId !== undefined ? { duenaId } : {}) }, version, usuarioId, ahora)))
        throw new ConflictoDeVersionError();
      const actor = { tipo: 'usuario', usuarioId } as const;
      if (
        duenaId !== undefined &&
        duenaId !== actual.duenaId &&
        (await c.relaciones.agregar({ procesoId: id, usuarioId: duenaId, relacion: 'duena' }, usuarioId, ahora))
      )
        await c.bitacora.registrar({
          empresaId,
          actor,
          accion: 'relacion.creada',
          resultado: 'ok',
          objeto: `relacion:${actual.codigo}`,
          despues: { persona_id: duenaId, relacion: 'duena' },
        });
      await c.bitacora.registrar({ empresaId, actor, accion: 'proceso.cambiado', resultado: 'ok', objeto: `proceso:${actual.codigo}` });
      const [p, relaciones, personas] = await Promise.all([exigirProceso(c, id), c.relaciones.listar(), c.personas.listar()]);
      return aDto(p, relaciones, new Set(personas.filter((x) => x.activa).map((x) => x.id)));
    });
  }
}

/** Retira un proceso: queda fuera de las nuevas auditorías, conserva su historia y su código; nada se borra. */
export class RetirarProcesoUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string; id: string }): Promise<void> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.gestionar', empresaId);
    const id = validarUuid(e.id, 'id');
    const ahora = this.reloj();
    await this.unidad.ejecutar(empresaId, async (c) => {
      const p = await exigirProcesoVigente(c, id);
      if (!(await c.procesos.actualizar(id, { estado: 'retirado' }, p.version, usuarioId, ahora))) throw new ConflictoDeVersionError();
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'proceso.retirado',
        resultado: 'ok',
        objeto: `proceso:${p.codigo}`,
      });
    });
  }
}

export class ListarRelacionesUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string; id: string }): Promise<readonly RelacionDto[]> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.ver', empresaId);
    const id = validarUuid(e.id, 'id');
    return this.unidad.ejecutar(empresaId, async (c) => {
      await exigirProceso(c, id);
      return (await c.relaciones.listar())
        .filter((r) => r.procesoId === id)
        .map((r) => ({ procesoId: r.procesoId, personaId: r.usuarioId, relacion: r.relacion }));
    });
  }
}

export class AgregarRelacionUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly reloj: Reloj,
  ) {}

  /** `creada` es falso si la relación ya existía (la operación es idempotente). */
  async ejecutar(e: {
    empresaId: string;
    usuarioId: string;
    id: string;
    personaId?: unknown;
    relacion?: unknown;
  }): Promise<{ creada: boolean; relacion: RelacionDto }> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.gestionar', empresaId);
    const id = validarUuid(e.id, 'id');
    const personaId = validarUuid(e.personaId, 'personaId');
    const relacion = traducirDominio(() => validarRelacion(e.relacion));
    const ahora = this.reloj();
    return this.unidad.ejecutar(empresaId, async (c) => {
      const p = await exigirProcesoVigente(c, id);
      await exigirPersonaActiva(c, personaId, 'personaId');
      const existentes = (await c.relaciones.listar()).filter((r) => r.procesoId === id);
      const creada = await c.relaciones.agregar({ procesoId: id, usuarioId: personaId, relacion }, usuarioId, ahora);
      if (creada) {
        if (existentes.length >= RELACIONES_POR_PROCESO_MAX) throw new ConflictoError('tope_de_relaciones');
        await c.bitacora.registrar({
          empresaId,
          actor: { tipo: 'usuario', usuarioId },
          accion: 'relacion.creada',
          resultado: 'ok',
          objeto: `relacion:${p.codigo}`,
          despues: { persona_id: personaId, relacion },
        });
      }
      return { creada, relacion: { procesoId: id, personaId, relacion } };
    });
  }
}

export class QuitarRelacionUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string; id: string; personaId?: unknown; relacion?: unknown }): Promise<void> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.gestionar', empresaId);
    const id = validarUuid(e.id, 'id');
    const personaId = validarUuid(e.personaId, 'personaId');
    const relacion = traducirDominio(() => validarRelacion(e.relacion));
    await this.unidad.ejecutar(empresaId, async (c) => {
      const p = await exigirProceso(c, id);
      // La dueña vigente conserva su relación: para quitarla primero se cambia la dueña del proceso.
      if (relacion === 'duena' && personaId === p.duenaId && p.estado === 'vigente') throw new ConflictoError('duena_vigente');
      if (!(await c.relaciones.quitar({ procesoId: id, usuarioId: personaId, relacion }))) throw new EntradaNoEncontradaError();
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'relacion.eliminada',
        resultado: 'ok',
        objeto: `relacion:${p.codigo}`,
        despues: { persona_id: personaId, relacion },
      });
    });
  }
}
