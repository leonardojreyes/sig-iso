import { CRITERIOS_POR_OMISION, calcularMatriz, mismosCriterios, validarCriterios, type CeldaMatriz, type DescripcionesEscala, type NivelAceptacion } from '../domain/criterios.js';
import { ErrorCertificacion } from '../domain/errores.js';
import type { AutorizacionPort } from './autorizacion.port.js';
import { exigirPermiso, identificar } from './comunes.js';
import type { ContextoCertificacion, Reloj } from './contexto.js';
import type { FilaCriterios } from './criterios.port.js';
import { ConflictoDeVersionError, ParametroInvalidoError } from './errores.js';
import type { UnidadDeTrabajoPort } from './unidad-de-trabajo.port.js';

type Unidad = UnidadDeTrabajoPort<ContextoCertificacion>;

export interface CriteriosDto {
  /** `omision` = escala de la herramienta (no son los criterios de la empresa). */
  readonly origen: 'omision' | 'empresa';
  /** 0 = por omisión. */
  readonly version: number;
  readonly probabilidad: DescripcionesEscala;
  readonly impacto: DescripcionesEscala;
  readonly nivelAceptacion: NivelAceptacion | null;
  readonly creadoEn: string | null;
  /** Cuántos riesgos vigentes hay en total (la suma de la matriz). */
  readonly riesgosVigentes: number;
  readonly matriz: readonly CeldaMatriz[];
}

const aDto = (f: FilaCriterios | null, riesgos: readonly { probabilidad: number; impacto: number }[]): CriteriosDto => ({
  origen: f ? 'empresa' : 'omision',
  version: f?.version ?? CRITERIOS_POR_OMISION.version,
  probabilidad: f?.probabilidad ?? CRITERIOS_POR_OMISION.probabilidad,
  impacto: f?.impacto ?? CRITERIOS_POR_OMISION.impacto,
  nivelAceptacion: f?.nivelAceptacion ?? CRITERIOS_POR_OMISION.nivelAceptacion,
  creadoEn: f ? f.creadoEn.toISOString() : null,
  riesgosVigentes: riesgos.length,
  matriz: calcularMatriz(riesgos),
});

const vigentes = async (c: ContextoCertificacion): Promise<{ probabilidad: number; impacto: number }[]> =>
  (await c.riesgos.listar()).filter((r) => r.vigente).map((r) => ({ probabilidad: r.probabilidad, impacto: r.impacto }));

/** Los criterios vigentes de la empresa (o la escala por omisión, rotulada) con la matriz 5 × 5 y cuántos riesgos vigentes hay en cada celda. */
export class ObtenerCriteriosUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort) {}

  async ejecutar(entrada: { empresaId: string; usuarioId: string }): Promise<CriteriosDto> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'criterios.ver', empresaId);
    return this.unidad.ejecutar(empresaId, async (c) => aDto(await c.criterios.vigente(), await vigentes(c)));
  }
}

export interface GuardarCriteriosEntrada {
  readonly empresaId: string;
  readonly usuarioId: string;
  readonly probabilidad?: unknown;
  readonly impacto?: unknown;
  readonly nivelAceptacion?: unknown;
  /** La versión que la persona vio (0 = la escala por omisión). Si otra persona guardó antes, 409. */
  readonly versionEsperada?: unknown;
}

/**
 * Guarda los criterios de la empresa como una VERSIÓN NUEVA (las anteriores no se tocan: respaldan evaluaciones y versiones aprobadas).
 * Guardar exactamente lo mismo no crea nada. Solo el administrador. Orden: permiso → datos → conflicto.
 */
export class GuardarCriteriosUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort, private readonly reloj: Reloj) {}

  async ejecutar(entrada: GuardarCriteriosEntrada): Promise<CriteriosDto> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'criterios.gestionar', empresaId);
    const esperada = entrada.versionEsperada;
    if (typeof esperada !== 'number' || !Number.isInteger(esperada) || esperada < 0) throw new ParametroInvalidoError('versionEsperada');
    let datos: ReturnType<typeof validarCriterios>;
    try {
      datos = validarCriterios(entrada);
    } catch (e) {
      if (e instanceof ErrorCertificacion) throw new ParametroInvalidoError(e.campo);
      throw e;
    }
    const ahora = this.reloj();
    return this.unidad.ejecutar(empresaId, async (c) => {
      const actual = await c.criterios.vigente();
      if ((actual?.version ?? 0) !== esperada) throw new ConflictoDeVersionError();
      if (actual && mismosCriterios(actual, datos)) return aDto(actual, await vigentes(c));
      const version = (actual?.version ?? 0) + 1;
      if (!(await c.criterios.crear(version, datos, usuarioId, ahora))) throw new ConflictoDeVersionError();
      await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'criterios.cambiados', resultado: 'ok', objeto: `criterios:v${version}` });
      return aDto(await c.criterios.vigente(), await vigentes(c));
    });
  }
}
