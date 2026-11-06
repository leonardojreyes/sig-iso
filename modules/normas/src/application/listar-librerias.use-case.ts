import { crearEmpresaId, type EmpresaId } from '@sig/tenancy';
import type { ContextoConsulta } from './contexto-adopcion.js';
import type { UnidadDeTrabajoPort } from './unidad-de-trabajo.port.js';

/** Forma del contrato `LibreriaResumen`. */
export interface LibreriaResumenDto {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly version: string;
  readonly esEjemplo: boolean;
  readonly fuente: string;
  readonly adoptada: boolean;
}

/** Tope del contrato (`maxItems`). Si el catálogo lo superara hay que revisar el contrato, no truncar sin avisar. */
export const TOPE_LIBRERIAS = 200;

const versionComoNumeros = (v: string): number[] => v.split('.').map(Number);
const compararVersion = (a: string, b: string): number => {
  const [x, y] = [versionComoNumeros(a), versionComoNumeros(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
};

/** Librerías del catálogo global, con `adoptada` según LA empresa del contexto (H4.8). */
export class ListarLibreriasUseCase {
  constructor(private readonly unidad: UnidadDeTrabajoPort<ContextoConsulta>) {}

  async ejecutar(empresa: EmpresaId): Promise<LibreriaResumenDto[]> {
    const empresaId = crearEmpresaId(empresa);
    return this.unidad.ejecutar(empresaId, async ({ catalogo, adopciones }) => {
      const [librerias, adoptadas] = await Promise.all([catalogo.listarLibrerias(), adopciones.listarLibreriaIds()]);
      if (librerias.length > TOPE_LIBRERIAS) throw new Error(`El catálogo supera el tope de ${TOPE_LIBRERIAS} librerías del contrato`);
      const propias = new Set(adoptadas);
      return [...librerias]
        .sort((a, b) => a.codigo.localeCompare(b.codigo) || compararVersion(a.version, b.version))
        .map((l) => ({ id: l.id, codigo: l.codigo, nombre: l.nombre, version: l.version, esEjemplo: l.esEjemplo, fuente: l.fuente, adoptada: propias.has(l.id) }));
    });
  }
}
