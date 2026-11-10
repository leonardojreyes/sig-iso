import { Evaluacion } from '../domain/evaluacion.js';
import { ErrorCertificacion } from '../domain/errores.js';
import type { EstadoEvaluacion } from '../domain/estado-evaluacion.js';
import type { AutorizacionPort } from './autorizacion.port.js';
import type { CatalogoLecturaPort } from './catalogo-lectura.port.js';
import { exigirPermiso, identificar } from './comunes.js';
import type { ContextoCertificacion, Reloj } from './contexto.js';
import { ConflictoDeVersionError, EntradaNoEncontradaError, ParametroInvalidoError } from './errores.js';
import type { UnidadDeTrabajoPort } from './unidad-de-trabajo.port.js';

export interface EvaluarEntradaEntrada {
  readonly empresaId: string;
  readonly usuarioId: string;
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  readonly estado: EstadoEvaluacion;
  readonly comentario?: string | null;
  readonly responsableId?: string | null;
  readonly fechaObjetivo?: string | null;
  /** Versión que la persona vio. Obligatoria si la entrada ya estaba evaluada; ausente (o 0) si es la primera vez. */
  readonly versionEsperada?: number;
}

export interface EvaluacionDto {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  readonly estado: EstadoEvaluacion;
  readonly comentario: string | null;
  readonly responsableId: string | null;
  readonly fechaObjetivo: string | null;
  readonly version: number;
}

const aDto = (e: Evaluacion): EvaluacionDto => ({
  libreriaCodigo: e.libreriaCodigo,
  idEstable: e.idEstable,
  estado: e.estado,
  comentario: e.comentario,
  responsableId: e.responsableId,
  fechaObjetivo: e.fechaObjetivo,
  version: e.version,
});

/**
 * Evalúa (o vuelve a evaluar) una cláusula o un control de las librerías adoptadas (H4.2, H4.3, H4.5, H4.6). Orden: permiso →
 * forma → la entrada existe para ESTA empresa → versión → escritura y bitácora en la misma transacción. Si no cambia nada, no
 * escribe ni registra. Si otra persona la cambió antes, falla con conflicto y no pisa su trabajo.
 */
export class EvaluarEntradaUseCase {
  constructor(
    private readonly unidad: UnidadDeTrabajoPort<ContextoCertificacion>,
    private readonly autorizacion: AutorizacionPort,
    private readonly catalogo: CatalogoLecturaPort,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(entrada: EvaluarEntradaEntrada): Promise<EvaluacionDto> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'diagnostico.evaluar', empresaId);

    const versionEsperada = entrada.versionEsperada ?? 0;
    if (!Number.isInteger(versionEsperada) || versionEsperada < 0) throw new ParametroInvalidoError('versionEsperada');

    const entradas = await this.catalogo.listarEntradasVigentes(empresaId);
    const objetivo = entradas.find((e) => e.libreriaCodigo === entrada.libreriaCodigo && e.idEstable === entrada.idEstable);
    if (!objetivo) throw new EntradaNoEncontradaError();

    return this.unidad.ejecutar(empresaId, async (c) => {
      const previa = await c.evaluaciones.obtener(objetivo.libreriaCodigo, objetivo.idEstable);
      if ((previa?.version ?? 0) !== versionEsperada) throw new ConflictoDeVersionError();

      let nueva: Evaluacion;
      try {
        nueva = Evaluacion.crear({
          empresaId,
          libreriaCodigo: objetivo.libreriaCodigo,
          idEstable: objetivo.idEstable,
          libreriaId: objetivo.libreriaId,
          estado: entrada.estado,
          comentario: entrada.comentario,
          responsableId: entrada.responsableId,
          fechaObjetivo: entrada.fechaObjetivo,
          version: (previa?.version ?? 0) + 1,
        });
      } catch (e) {
        if (e instanceof ErrorCertificacion) throw new ParametroInvalidoError(e.campo);
        throw e;
      }

      // Sin cambios no hay escritura, versión nueva ni hecho de bitácora.
      if (previa && previa.estado === nueva.estado && previa.comentario === nueva.comentario && previa.responsableId === nueva.responsableId && previa.fechaObjetivo === nueva.fechaObjetivo && previa.libreriaId === nueva.libreriaId) {
        return aDto(previa);
      }

      const ahora = this.reloj();
      const escrito = previa ? await c.evaluaciones.actualizar(nueva, usuarioId, ahora, previa.version) : await c.evaluaciones.crear(nueva, usuarioId, ahora);
      if (!escrito) throw new ConflictoDeVersionError();

      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'evaluacion.cambiada',
        resultado: 'ok',
        objeto: `evaluacion:${objetivo.libreriaCodigo}.${objetivo.idEstable}`,
        antes: { estado: previa?.estado ?? 'sin_evaluar' },
        despues: { estado: nueva.estado },
      });
      return aDto(nueva);
    });
  }
}
