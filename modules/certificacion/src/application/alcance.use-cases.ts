import { Alcance } from '../domain/alcance.js';
import { ErrorCertificacion } from '../domain/errores.js';
import type { AutorizacionPort } from './autorizacion.port.js';
import type { CatalogoLecturaPort } from './catalogo-lectura.port.js';
import { exigirPermiso, identificadorDeNorma, identificar, validarNorma } from './comunes.js';
import type { ContextoCertificacion, Reloj } from './contexto.js';
import { ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError } from './errores.js';
import type { UnidadDeTrabajoPort } from './unidad-de-trabajo.port.js';

export interface AlcanceDto {
  readonly norma: string;
  /** Nulo = todavía sin definir. */
  readonly texto: string | null;
  readonly aprobado: boolean;
  readonly aprobadoEn: string | null;
  readonly actualizadoEn: string | null;
}

const aDto = (a: Alcance): AlcanceDto => ({ norma: a.norma, texto: a.texto, aprobado: a.aprobado, aprobadoEn: a.aprobadoEn?.toISOString() ?? null, actualizadoEn: a.actualizadoEn.toISOString() });

/** Normas de las librerías adoptadas por la empresa (solo sobre ellas se define un alcance). */
const normasAdoptadas = async (catalogo: CatalogoLecturaPort, empresaId: Parameters<CatalogoLecturaPort['listarEntradasVigentes']>[0]): Promise<string[]> => {
  const entradas = await catalogo.listarEntradasVigentes(empresaId);
  return [...new Set(entradas.flatMap((e) => e.aplicaA.map((a) => a.norma)))].sort((a, b) => a.localeCompare(b, 'es'));
};

/** Alcance de cada norma adoptada: definido o «sin definir». */
export class ListarAlcancesUseCase {
  constructor(private readonly unidad: UnidadDeTrabajoPort<ContextoCertificacion>, private readonly autorizacion: AutorizacionPort, private readonly catalogo: CatalogoLecturaPort) {}

  async ejecutar(entrada: { empresaId: string; usuarioId: string }): Promise<AlcanceDto[]> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'alcance.ver', empresaId);
    const normas = await normasAdoptadas(this.catalogo, empresaId);
    const alcances = await this.unidad.ejecutar(empresaId, (c) => c.alcances.listar());
    const porNorma = new Map(alcances.map((a) => [a.norma, a]));
    return normas.map((n) => {
      const a = porNorma.get(n);
      return a ? aDto(a) : { norma: n, texto: null, aprobado: false, aprobadoEn: null, actualizadoEn: null };
    });
  }
}

/** Define o cambia el texto del alcance de una norma (solo administradores). Cambiar un alcance aprobado lo devuelve a «sin aprobar». */
export class GuardarAlcanceUseCase {
  constructor(
    private readonly unidad: UnidadDeTrabajoPort<ContextoCertificacion>,
    private readonly autorizacion: AutorizacionPort,
    private readonly catalogo: CatalogoLecturaPort,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(entrada: { empresaId: string; usuarioId: string; norma: string; texto: string }): Promise<AlcanceDto> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'alcance.gestionar', empresaId);
    validarNorma(entrada.norma);
    if (!(await normasAdoptadas(this.catalogo, empresaId)).includes(entrada.norma)) throw new EntradaNoEncontradaError();

    return this.unidad.ejecutar(empresaId, async (c) => {
      const ahora = this.reloj();
      const previo = await c.alcances.obtener(entrada.norma);
      let nuevo: Alcance;
      try {
        nuevo = previo ? previo.conTexto(entrada.texto, usuarioId, ahora) : Alcance.crear({ empresaId, norma: entrada.norma, texto: entrada.texto, actualizadoPor: usuarioId, actualizadoEn: ahora });
      } catch (e) {
        if (e instanceof ErrorCertificacion) throw new ParametroInvalidoError(e.campo);
        throw e;
      }
      if (previo && nuevo === previo) return aDto(previo);
      await c.alcances.guardar(nuevo);
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'alcance.cambiado',
        resultado: 'ok',
        objeto: `alcance:${identificadorDeNorma(entrada.norma)}`,
        antes: { aprobado: previo?.aprobado ?? false },
        despues: { aprobado: false },
      });
      return aDto(nuevo);
    });
  }
}

/** Aprueba el texto vigente del alcance (solo administradores). Queda quién y cuándo. */
export class AprobarAlcanceUseCase {
  constructor(
    private readonly unidad: UnidadDeTrabajoPort<ContextoCertificacion>,
    private readonly autorizacion: AutorizacionPort,
    private readonly catalogo: CatalogoLecturaPort,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(entrada: { empresaId: string; usuarioId: string; norma: string }): Promise<AlcanceDto> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'alcance.aprobar', empresaId);
    validarNorma(entrada.norma);
    if (!(await normasAdoptadas(this.catalogo, empresaId)).includes(entrada.norma)) throw new EntradaNoEncontradaError();

    return this.unidad.ejecutar(empresaId, async (c) => {
      const previo = await c.alcances.obtener(entrada.norma);
      if (!previo) throw new EntradaNoEncontradaError();
      let aprobado: Alcance;
      try {
        aprobado = previo.aprobar(usuarioId, this.reloj());
      } catch (e) {
        if (e instanceof ErrorCertificacion && e.motivos.includes('ya_aprobado')) throw new ConflictoError('ya_aprobado');
        throw e;
      }
      await c.alcances.guardar(aprobado);
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'alcance.aprobado',
        resultado: 'ok',
        objeto: `alcance:${identificadorDeNorma(entrada.norma)}`,
      });
      return aDto(aprobado);
    });
  }
}
