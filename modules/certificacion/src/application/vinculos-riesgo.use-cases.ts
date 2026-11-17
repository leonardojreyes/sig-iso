import { MapeoControl } from '../domain/mapeo-control.js';
import type { AutorizacionPort } from './autorizacion.port.js';
import type { CatalogoLecturaPort } from './catalogo-lectura.port.js';
import { exigirPermiso, identificar, validarUuid } from './comunes.js';
import type { ContextoCertificacion, Reloj } from './contexto.js';
import { esDeLaDeclaracion } from './declaracion.use-cases.js';
import { ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError } from './errores.js';
import { aDtoRiesgo, type RiesgoDto } from './riesgos.use-cases.js';
import type { UnidadDeTrabajoPort } from './unidad-de-trabajo.port.js';

type Unidad = UnidadDeTrabajoPort<ContextoCertificacion>;

/** Tope de vínculos (de ambas clases) por riesgo: acota la respuesta y evita vínculos de relleno. */
export const VINCULOS_POR_RIESGO_MAX = 50;

interface Base {
  readonly empresaId: string;
  readonly usuarioId: string;
  readonly riesgoId: string;
}
interface ConControl extends Base {
  readonly controlId: string;
}
interface ConEntrada extends Base {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
}

/** La forma de la entrada (código de librería e id estable) se valida con el mismo objeto de valor que los mapeos. */
const entradaValida = (empresaId: ConEntrada['empresaId'] | never, e: ConEntrada, controlId: string): { libreriaCodigo: string; idEstable: string } => {
  try {
    const m = MapeoControl.crear({ empresaId: empresaId as never, controlId, libreriaCodigo: e.libreriaCodigo, idEstable: e.idEstable });
    return { libreriaCodigo: m.libreriaCodigo, idEstable: m.idEstable };
  } catch {
    throw new ParametroInvalidoError('entrada');
  }
};
const SIN_CONTROL = '00000000-0000-4000-8000-000000000000';

/** Vincula un riesgo vigente con un control vigente de la empresa (solo administradores). Repetir un vínculo no es un error. */
export class VincularRiesgoControlUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort, private readonly reloj: Reloj) {}

  /** `true` si creó el vínculo y `false` si ya existía. */
  async ejecutar(entrada: ConControl): Promise<{ creado: boolean }> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'riesgos.gestionar', empresaId);
    const riesgoId = validarUuid(entrada.riesgoId, 'riesgoId');
    const controlId = validarUuid(entrada.controlId, 'controlId');
    return this.unidad.ejecutar(empresaId, async (c) => {
      const riesgo = await c.riesgos.obtener(riesgoId);
      const control = await c.controles.obtener(controlId);
      if (!riesgo || !control) throw new EntradaNoEncontradaError();
      if (!riesgo.vigente) throw new ConflictoError('riesgo_retirado');
      if (!control.vigente) throw new ConflictoError('control_retirado');
      if (await c.vinculosRiesgo.contar(riesgoId) >= VINCULOS_POR_RIESGO_MAX) throw new ConflictoError('tope_de_vinculos');
      if (!(await c.vinculosRiesgo.agregarControl(riesgoId, controlId, usuarioId, this.reloj()))) return { creado: false };
      await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'vinculo.creado', resultado: 'ok', objeto: `vinculo:${riesgo.codigo}.${control.codigo}` });
      return { creado: true };
    });
  }
}

/** Quita el vínculo de un riesgo vigente con un control de la empresa, también si el control ya fue retirado (solo administradores). */
export class DesvincularRiesgoControlUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort) {}

  async ejecutar(entrada: ConControl): Promise<void> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'riesgos.gestionar', empresaId);
    const riesgoId = validarUuid(entrada.riesgoId, 'riesgoId');
    const controlId = validarUuid(entrada.controlId, 'controlId');
    await this.unidad.ejecutar(empresaId, async (c) => {
      const riesgo = await c.riesgos.obtener(riesgoId);
      const control = await c.controles.obtener(controlId);
      if (!riesgo || !control) throw new EntradaNoEncontradaError();
      if (!riesgo.vigente) throw new ConflictoError('riesgo_retirado');
      if (!(await c.vinculosRiesgo.quitarControl(riesgoId, controlId))) throw new EntradaNoEncontradaError();
      await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'vinculo.eliminado', resultado: 'ok', objeto: `vinculo:${riesgo.codigo}.${control.codigo}` });
    });
  }
}

/**
 * «Tratamiento previsto» (H2.3): vincula un riesgo vigente directo con un control del Anexo A de las librerías adoptadas, cuando la
 * empresa aún no tiene el control propio (solo administradores). Repetirlo no es un error.
 */
export class PreverTratamientoUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort, private readonly catalogo: CatalogoLecturaPort, private readonly reloj: Reloj) {}

  /** `true` si creó el vínculo y `false` si ya existía. */
  async ejecutar(entrada: ConEntrada): Promise<{ creado: boolean }> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'riesgos.gestionar', empresaId);
    const riesgoId = validarUuid(entrada.riesgoId, 'riesgoId');
    const { libreriaCodigo, idEstable } = entradaValida(empresaId, entrada, SIN_CONTROL);
    const entradas = await this.catalogo.listarEntradasVigentes(empresaId);
    // Solo controles del Anexo A de la edición de la Declaración, de las librerías que la empresa adoptó; si no, es como si no existiera.
    if (!entradas.filter(esDeLaDeclaracion).some((e) => e.libreriaCodigo === libreriaCodigo && e.idEstable === idEstable)) throw new EntradaNoEncontradaError();
    return this.unidad.ejecutar(empresaId, async (c) => {
      const riesgo = await c.riesgos.obtener(riesgoId);
      if (!riesgo) throw new EntradaNoEncontradaError();
      if (!riesgo.vigente) throw new ConflictoError('riesgo_retirado');
      if (await c.vinculosRiesgo.contar(riesgoId) >= VINCULOS_POR_RIESGO_MAX) throw new ConflictoError('tope_de_vinculos');
      if (!(await c.vinculosRiesgo.agregarEntrada(riesgoId, libreriaCodigo, idEstable, usuarioId, this.reloj()))) return { creado: false };
      await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'vinculo.creado', resultado: 'ok', objeto: `vinculo:${riesgo.codigo}.${idEstable}` });
      return { creado: true };
    });
  }
}

/** Quita un tratamiento previsto de un riesgo vigente (solo administradores). No exige que la entrada siga adoptada. */
export class QuitarTratamientoPrevistoUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort) {}

  async ejecutar(entrada: ConEntrada): Promise<void> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'riesgos.gestionar', empresaId);
    const riesgoId = validarUuid(entrada.riesgoId, 'riesgoId');
    const { libreriaCodigo, idEstable } = entradaValida(empresaId, entrada, SIN_CONTROL);
    await this.unidad.ejecutar(empresaId, async (c) => {
      const riesgo = await c.riesgos.obtener(riesgoId);
      if (!riesgo) throw new EntradaNoEncontradaError();
      if (!riesgo.vigente) throw new ConflictoError('riesgo_retirado');
      if (!(await c.vinculosRiesgo.quitarEntrada(riesgoId, libreriaCodigo, idEstable))) throw new EntradaNoEncontradaError();
      await c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'vinculo.eliminado', resultado: 'ok', objeto: `vinculo:${riesgo.codigo}.${idEstable}` });
    });
  }
}

/** H2.4, de control a riesgo: los riesgos vigentes que trata un control de la empresa. Un control ajeno o inexistente es 404. */
export class RiesgosDeUnControlUseCase {
  constructor(private readonly unidad: Unidad, private readonly autorizacion: AutorizacionPort) {}

  async ejecutar(entrada: { empresaId: string; usuarioId: string; controlId: string }): Promise<readonly RiesgoDto[]> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'riesgos.ver', empresaId);
    const controlId = validarUuid(entrada.controlId, 'controlId');
    return this.unidad.ejecutar(empresaId, async (c) => {
      if (!(await c.controles.obtener(controlId))) throw new EntradaNoEncontradaError();
      const ids = new Set((await c.vinculosRiesgo.listarControles()).filter((v) => v.controlId === controlId).map((v) => v.riesgoId));
      return (await c.riesgos.listar()).filter((r) => r.vigente && ids.has(r.id)).map(aDtoRiesgo);
    });
  }
}
