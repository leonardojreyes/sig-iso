import type { EmpresaId } from '@sig/tenancy';
import type { EventoBitacora } from '@sig/auditoria';
import type { CambioMarca } from '../domain/marca-empresa.js';
import type { DatosEmpresa } from './empresa-repository.port.js';

/** Escribe un hecho en la bitácora DENTRO de la misma unidad de trabajo que el cambio (si falla, el cambio se revierte). */
export interface BitacoraDeUnidad {
  registrar(evento: EventoBitacora): Promise<void>;
}

/** Marca de UNA empresa (la de la unidad de trabajo): leerla y cambiar solo su color y su logo. */
export interface MarcaRepositoryPort {
  obtener(): Promise<DatosEmpresa | null>;
  actualizar(cambio: CambioMarca): Promise<void>;
}

/** Lo que `ActualizarMarca` recibe dentro de la unidad de trabajo, todo ligado a la misma transacción y empresa. */
export interface ContextoMarca {
  readonly marcas: MarcaRepositoryPort;
  readonly bitacora: BitacoraDeUnidad;
}

/** Puerto de salida: ejecuta `fn` en una unidad atómica ligada a UNA empresa (todo se confirma junto o se revierte junto). */
export interface UnidadDeTrabajoMarcaPort {
  ejecutar<T>(empresaId: EmpresaId, fn: (contexto: ContextoMarca) => Promise<T>): Promise<T>;
}

/** ¿Puede esta persona hacer esto en esta empresa? Si no se puede decidir, debe fallar (nunca responder «sí»). */
export interface PermisoMarcaPort {
  puede(usuarioId: string, permiso: 'marca.editar', empresaId: EmpresaId): Promise<boolean>;
}
