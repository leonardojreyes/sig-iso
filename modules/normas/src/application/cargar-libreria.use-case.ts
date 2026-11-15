// Carga de una librería PROPIA de la empresa desde un archivo YAML subido por una persona (ADR 034, MVP M6a).
// Orden: identidad del token → permiso `normas.cargar` (403) → lista cerrada de contenido y tamaño → YAML sin alias → esquema
// completo → reglas de contenido (sin texto de norma) → reglas de la librería propia → (unidad atómica) guardar + bitácora.
// Un archivo rechazado NO es una excepción: es un resultado con códigos y rutas (nunca el contenido), y también se registra.
import { revisarContenido, validarLibreria, huellaCanonica, type Libreria as LibreriaYaml } from '@sig/normas-schema';
import { crearEmpresaId, type EmpresaId } from '@sig/tenancy';
import { exigirUuid } from '../domain/errores.js';
import type { AutorizacionPort } from './autorizacion.port.js';
import type { RegistradorBitacora } from './contexto-adopcion.js';
import type { LectorLibreriaPort, LibreriaPropiaRepositoryPort } from './libreria-propia.port.js';
import { SinPermisoError } from './adoptar-libreria.use-case.js';
import type { UnidadDeTrabajoPort } from './unidad-de-trabajo.port.js';

export const TAMANO_MAX_LIBRERIA = 1024 * 1024; // 1 MB por archivo
export const ENTRADAS_MAX_LIBRERIA = 1000;
export const PREFIJO_LIBRERIA_PROPIA = 'propia-';

export interface ContextoCarga {
  readonly propias: LibreriaPropiaRepositoryPort;
  readonly bitacora: RegistradorBitacora;
}

export type MotivoRechazoCarga =
  | 'tipo_no_permitido'
  | 'tamano_excedido'
  | 'formato_invalido'
  | 'contenido_no_permitido'
  | 'codigo_no_permitido'
  | 'hash_distinto';

/** Qué falló y dónde, sin repetir el contenido del archivo. */
export interface ErrorCarga {
  readonly entrada: string | null;
  readonly indice: number | null;
  readonly ruta: string;
  readonly codigo: string;
}

export interface CargarLibreriaEntrada {
  /** Siempre la del token verificado. */
  readonly empresaId: EmpresaId;
  readonly usuarioId: string;
  readonly contenido: Uint8Array;
  readonly traceId?: string;
}

export interface ResultadoCargaLibreria {
  readonly estado: 'cargada' | 'ya_cargada' | 'rechazada';
  readonly motivo: MotivoRechazoCarga | null;
  readonly codigo: string | null;
  readonly version: string | null;
  readonly entradas: number | null;
  /** SHA-256 del contenido canónico (si es válida) o de los bytes (si no). */
  readonly huella: string;
  readonly errores: readonly ErrorCarga[];
}

const rechazo = (motivo: MotivoRechazoCarga, huella: string, errores: readonly ErrorCarga[], l?: LibreriaYaml): Omit<ResultadoCargaLibreria, never> => ({
  estado: 'rechazada',
  motivo,
  codigo: l?.codigo ?? null,
  version: l?.version ?? null,
  entradas: null,
  huella,
  errores,
});

const errorSimple = (ruta: string, codigo: string): ErrorCarga => ({ entrada: null, indice: null, ruta, codigo });

export class CargarLibreriaUseCase {
  constructor(
    private readonly unidad: UnidadDeTrabajoPort<ContextoCarga>,
    private readonly autorizacion: AutorizacionPort,
    private readonly lector: LectorLibreriaPort,
  ) {}

  /**
   * Decide el permiso SIN mirar el archivo: la API lo llama antes de leer un solo byte (orden 401, 403, 400, 413) y `ejecutar` lo
   * vuelve a decidir (no se confía en que quien llama lo haya hecho).
   */
  async comprobarPermiso(empresa: EmpresaId, usuario: string): Promise<void> {
    const empresaId = crearEmpresaId(empresa);
    const usuarioId = exigirUuid('usuarioId', usuario);
    if (!(await this.autorizacion.puede(usuarioId, 'normas.cargar', empresaId))) throw new SinPermisoError('normas.cargar');
  }

  async ejecutar(entrada: CargarLibreriaEntrada): Promise<ResultadoCargaLibreria> {
    await this.comprobarPermiso(entrada.empresaId, entrada.usuarioId);
    const empresaId = crearEmpresaId(entrada.empresaId);
    const usuarioId = exigirUuid('usuarioId', entrada.usuarioId);

    const huellaBytes = this.lector.huellaDe(entrada.contenido);
    const evaluado = this.evaluar(entrada.contenido, huellaBytes);

    if (evaluado.resultado) return this.registrarRechazo(empresaId, usuarioId, evaluado.resultado, entrada.traceId);

    const { libreria, huella } = evaluado;
    return this.unidad.ejecutar(empresaId, async ({ propias, bitacora }) => {
      const intento = await propias.guardar(libreria, huella);
      const base = { codigo: libreria.codigo, version: libreria.version, huella, errores: [] as const };
      const evento = (resultado: 'ok' | 'rechazado', motivo: 'ya_cargada' | 'hash_distinto' | undefined, entradas: number | null) =>
        bitacora.registrar({
          empresaId,
          actor: { tipo: 'usuario', usuarioId },
          accion: 'libreria.cargada',
          resultado,
          ...(motivo ? { motivo } : {}),
          objeto: `libreria:${libreria.codigo}`,
          objetoVersion: huella,
          ...(entrada.traceId === undefined ? {} : { traceId: entrada.traceId }),
          ...(entradas === null ? {} : { despues: { entradas } }),
        });
      if (intento === 'distinto') {
        await evento('rechazado', 'hash_distinto', null);
        return { ...base, estado: 'rechazada' as const, motivo: 'hash_distinto' as const, entradas: null };
      }
      await evento('ok', intento === 'ya' ? 'ya_cargada' : undefined, libreria.entradas.length);
      return { ...base, estado: intento === 'ya' ? ('ya_cargada' as const) : ('cargada' as const), motivo: null, entradas: libreria.entradas.length };
    });
  }

  private evaluar(
    bytes: Uint8Array,
    huellaBytes: string,
  ): { resultado: ResultadoCargaLibreria; libreria?: never; huella?: never } | { resultado?: never; libreria: LibreriaYaml; huella: string } {
    if (bytes.length === 0) return { resultado: rechazo('tipo_no_permitido', huellaBytes, [errorSimple('', 'archivo_vacio')]) };
    if (bytes.length > TAMANO_MAX_LIBRERIA) return { resultado: rechazo('tamano_excedido', huellaBytes, [errorSimple('', 'demasiado_largo')]) };
    const lectura = this.lector.leer(bytes);
    if (!lectura.ok) return { resultado: rechazo(lectura.motivo, huellaBytes, [errorSimple('', lectura.codigo)]) };
    const datos = lectura.datos;

    const r = validarLibreria(datos);
    if (!r.ok) return { resultado: rechazo('formato_invalido', huellaBytes, r.errores) };
    const l = r.libreria;
    if (l.entradas.length > ENTRADAS_MAX_LIBRERIA) return { resultado: rechazo('formato_invalido', huellaBytes, [errorSimple('entradas', 'demasiado_largo')], l) };

    const hallazgos = revisarContenido(l).map((h) => ({ entrada: h.entrada, indice: h.indice, ruta: `entradas[${h.indice}].${h.campo}`, codigo: h.codigo }));
    if (hallazgos.length > 0) return { resultado: rechazo('contenido_no_permitido', huellaBytes, hallazgos, l) };

    const propias: ErrorCarga[] = [];
    if (!l.codigo.startsWith(PREFIJO_LIBRERIA_PROPIA)) propias.push(errorSimple('codigo', 'prefijo_obligatorio'));
    if (l.es_ejemplo) propias.push(errorSimple('es_ejemplo', 'ejemplo_no_permitido'));
    if (propias.length > 0) return { resultado: rechazo('codigo_no_permitido', huellaBytes, propias, l) };

    return { libreria: l, huella: huellaCanonica(l) };
  }

  private async registrarRechazo(empresaId: EmpresaId, usuarioId: string, r: ResultadoCargaLibreria, traceId?: string): Promise<ResultadoCargaLibreria> {
    await this.unidad.ejecutar(empresaId, ({ bitacora }) =>
      bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'libreria.cargada',
        resultado: 'rechazado',
        motivo: r.motivo!,
        // El nombre del archivo no es de fiar: el hecho se identifica por la huella de los bytes.
        objeto: 'libreria:archivo',
        objetoVersion: r.huella,
        ...(traceId === undefined ? {} : { traceId }),
      }),
    );
    return r;
  }
}
