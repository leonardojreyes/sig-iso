// La empresa edita su marca: color y logo (ADR 035, MVP M6b-2). Orden: permiso `marca.editar` (403) → validación (400) → unidad atómica:
// leer la marca vigente → cambiar solo lo que cambió → bitácora (solo QUÉ cambió, nunca el color ni la dirección del logo).
// El color elegido se guarda tal cual; si no cumple el contraste AA, la marca que se APLICA se ajusta (`ajustadoPorContraste`).
import { crearEmpresaId, type EmpresaId } from '@sig/tenancy';
import { crearMarca, ErrorMarca, validarCambioMarca, type MarcaEmpresa } from '../domain/marca-empresa.js';
import type { PermisoMarcaPort, UnidadDeTrabajoMarcaPort } from './marca-repository.port.js';
import { EmpresaNoEncontradaError } from './obtener-marca.use-case.js';

/** Quien intenta editar la marca no tiene permiso. El registro del rechazo lo hace el filtro de la API. */
export class SinPermisoMarcaError extends Error {
  readonly permiso = 'marca.editar';
  constructor() {
    super('Sin permiso para editar la marca');
    this.name = 'SinPermisoMarcaError';
  }
}

/** Lo enviado no es una marca válida. No repite el valor. La API lo responde como 400. */
export class MarcaNoValidaError extends Error {
  constructor() {
    super('La marca enviada no es válida');
    this.name = 'MarcaNoValidaError';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export class ActualizarMarcaUseCase {
  constructor(
    private readonly unidad: UnidadDeTrabajoMarcaPort,
    private readonly permisos: PermisoMarcaPort,
  ) {}

  async ejecutar(e: { readonly empresaId: EmpresaId; readonly usuarioId: string; readonly colorPrimario: unknown; readonly logoUrl: unknown; readonly traceId?: string }): Promise<MarcaEmpresa> {
    const empresaId = crearEmpresaId(e.empresaId);
    const usuarioId = typeof e.usuarioId === 'string' ? e.usuarioId.toLowerCase() : '';
    if (!UUID.test(usuarioId)) throw new Error('El identificador de la persona no es un UUID válido');
    if (!(await this.permisos.puede(usuarioId, 'marca.editar', empresaId))) throw new SinPermisoMarcaError();

    let cambio;
    try {
      cambio = validarCambioMarca({ colorPrimario: e.colorPrimario, logoUrl: e.logoUrl });
    } catch (error) {
      if (error instanceof ErrorMarca) throw new MarcaNoValidaError();
      throw error;
    }

    return this.unidad.ejecutar(empresaId, async ({ marcas, bitacora }) => {
      const actual = await marcas.obtener();
      // Defensa en profundidad: nunca se cambia (ni se arma) la marca de otra empresa.
      if (actual === null || actual.id !== empresaId) throw new EmpresaNoEncontradaError();
      const colorCambiado = actual.colorPrimario.toLowerCase() !== cambio.colorPrimario;
      const logoCambiado = (actual.logoUrl ?? null) !== cambio.logoUrl;
      if (colorCambiado || logoCambiado) {
        await marcas.actualizar(cambio);
        await bitacora.registrar({
          empresaId,
          actor: { tipo: 'usuario', usuarioId },
          accion: 'marca.cambiada',
          resultado: 'ok',
          objeto: `empresa:${actual.slug}`,
          ...(e.traceId === undefined ? {} : { traceId: e.traceId }),
          despues: { color_cambiado: colorCambiado, logo_cambiado: logoCambiado },
        });
      }
      return crearMarca({ nombre: actual.nombre, colorPrimario: cambio.colorPrimario, logoUrl: cambio.logoUrl });
    });
  }
}
