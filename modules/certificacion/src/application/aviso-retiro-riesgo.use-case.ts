import { efectoDeRetirarRiesgo, type ControlSinMotivo } from '../domain/declaracion.js';
import type { AutorizacionPort } from './autorizacion.port.js';
import type { CatalogoLecturaPort } from './catalogo-lectura.port.js';
import { exigirPermiso, identificar, validarUuid } from './comunes.js';
import type { ContextoCertificacion } from './contexto.js';
import { esDeLaDeclaracion } from './declaracion.use-cases.js';
import { EntradaNoEncontradaError } from './errores.js';
import type { UnidadDeTrabajoPort } from './unidad-de-trabajo.port.js';

export interface AvisoRetiroRiesgoDto {
  readonly riesgoId: string;
  readonly codigo: string;
  /** Controles del Anexo A que aplican y quedarían sin motivo al retirar el riesgo. Vacío = el retiro no deja nada sin motivo. */
  readonly controlesSinMotivo: readonly ControlSinMotivo[];
}

/**
 * Aviso previo al retiro (H1.4): qué controles del Anexo A quedarían SIN motivo si se retira este riesgo. No cambia nada: la pantalla
 * lo muestra antes de que la persona confirme. Solo para quien puede retirar (administrador). Un riesgo ajeno es 404.
 */
export class AvisoRetiroRiesgoUseCase {
  constructor(private readonly unidad: UnidadDeTrabajoPort<ContextoCertificacion>, private readonly autorizacion: AutorizacionPort, private readonly catalogo: CatalogoLecturaPort) {}

  async ejecutar(entrada: { empresaId: string; usuarioId: string; id: string }): Promise<AvisoRetiroRiesgoDto> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'riesgos.gestionar', empresaId);
    const id = validarUuid(entrada.id, 'id');
    const catalogo = (await this.catalogo.listarEntradasVigentes(empresaId)).filter(esDeLaDeclaracion);
    const d = await this.unidad.ejecutar(empresaId, async (c) => ({
      riesgo: await c.riesgos.obtener(id),
      riesgos: await c.riesgos.listar(),
      evaluaciones: await c.evaluaciones.listar(),
      controles: await c.controles.listar(),
      mapeos: await c.mapeos.listar(),
      vinculosControl: await c.vinculosRiesgo.listarControles(),
      vinculosEntrada: await c.vinculosRiesgo.listarEntradas(),
      motivos: await c.motivos.listar(),
    }));
    if (!d.riesgo) throw new EntradaNoEncontradaError();
    // Un riesgo ya retirado no sostiene ningún motivo: no hay nada que avisar.
    const controlesSinMotivo = efectoDeRetirarRiesgo(
      {
        entradas: catalogo.map((e) => ({ libreriaCodigo: e.libreriaCodigo, idEstable: e.idEstable, orden: e.orden, titulo: e.titulo, grupo: e.grupo })),
        evaluaciones: d.evaluaciones.map((e) => ({ libreriaCodigo: e.libreriaCodigo, idEstable: e.idEstable, estado: e.estado, comentario: e.comentario })),
        controles: d.controles.map((x) => ({ id: x.id, codigo: x.codigo, vigente: x.vigente })),
        mapeos: d.mapeos.map((m) => ({ controlId: m.controlId, libreriaCodigo: m.libreriaCodigo, idEstable: m.idEstable })),
        cobertura: [],
        justificacion: {
          riesgos: d.riesgos.map((r) => ({ id: r.id, codigo: r.codigo, titulo: r.titulo, nivel: r.nivel, decision: r.decision, vigente: r.vigente })),
          vinculosControl: d.vinculosControl,
          vinculosEntrada: d.vinculosEntrada,
          motivos: d.motivos.map((m) => ({ libreriaCodigo: m.libreriaCodigo, idEstable: m.idEstable, tipo: m.tipo, nota: m.nota })),
        },
      },
      id,
    );
    return { riesgoId: d.riesgo.id, codigo: d.riesgo.codigo, controlesSinMotivo };
  }
}

