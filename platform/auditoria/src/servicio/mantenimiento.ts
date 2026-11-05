import type { MotivoBitacora } from '../dominio/catalogo';
import type { AlertasPort, IntegridadBitacoraPort, ProblemaIntegridad, TipoProblema } from '../puertos/integridad.port';
import type { Bitacora } from './bitacora';

export interface ResultadoMantenimiento {
  readonly ok: boolean;
  readonly problemas: readonly ProblemaIntegridad[];
  readonly anclasNuevas: number;
}

const MOTIVO: Record<TipoProblema, MotivoBitacora> = {
  hueco_en_la_secuencia: 'secuencia_con_huecos',
  enlace_roto: 'enlace_roto',
  huella_invalida: 'huella_invalida',
  ancla_perdida: 'ancla_perdida',
};

/**
 * Mantenimiento de la bitácora (H6.6, H6.13): verifica las cadenas; si están sanas, las ancla; y deja constancia en la bitácora
 * de plataforma. Si encuentra problemas NO ancla (no se da por buena una cadena rota), registra el error y alerta.
 * Pensado para ejecutarse de forma periódica y bajo demanda, con el rol dueño de la base de datos.
 */
export class MantenimientoBitacora {
  constructor(
    private readonly integridad: IntegridadBitacoraPort,
    private readonly bitacora: Pick<Bitacora, 'registrar'>,
    private readonly alertas: AlertasPort,
  ) {}

  async ejecutar(): Promise<ResultadoMantenimiento> {
    const problemas = await this.integridad.verificar();
    if (problemas.length === 0) {
      const anclasNuevas = await this.integridad.anclar();
      await this.bitacora.registrar({ empresaId: null, actor: { tipo: 'sistema' }, accion: 'bitacora.verificacion', resultado: 'ok', despues: { problemas: 0 } });
      return { ok: true, problemas, anclasNuevas };
    }

    const tipos = new Set(problemas.map((p) => p.problema));
    const motivo: MotivoBitacora = tipos.size === 1 ? MOTIVO[[...tipos][0] as TipoProblema] : 'cadena_rota';
    let falloRegistro: unknown;
    try {
      await this.bitacora.registrar({ empresaId: null, actor: { tipo: 'sistema' }, accion: 'bitacora.verificacion', resultado: 'error', motivo, despues: { problemas: problemas.length } });
    } catch (e) {
      falloRegistro = e;
    }
    // La alerta se intenta SIEMPRE, aunque no se haya podido registrar: es lo más importante.
    await this.alertas.notificar({ severidad: 'critica', asunto: 'La verificación de integridad de la bitácora encontró problemas', problemas });
    if (falloRegistro !== undefined) throw falloRegistro;
    return { ok: false, problemas, anclasNuevas: 0 };
  }
}
