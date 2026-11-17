import type { EmpresaId } from '@sig/tenancy';
import type { Rol } from '@sig/autorizacion';
import type { BitacoraDeUnidad } from './marca-repository.port.js';

// Puertos de las personas de una empresa y de sus solicitudes de acceso (ADR 036, MVP M7). Todo va ligado a UNA empresa: la de la
// unidad de trabajo. Nada recibe una empresa del cliente.

/** Una persona de la empresa. `rol` nulo = sin acceso (baja, o aún sin aprobar). El correo y el nombre son datos personales. */
export interface PersonaDto {
  readonly id: string;
  readonly nombre: string;
  readonly correo: string;
  readonly rol: Rol | null;
  readonly bajaEn: Date | null;
  readonly version: number;
}

/** Una solicitud vigente de acceso: el código es lo que la persona le entrega al administrador. No lleva nombre ni correo. */
export interface SolicitudDto {
  readonly id: string;
  readonly usuarioId: string;
  readonly codigo: string;
  readonly creadaEn: Date;
  readonly venceEn: Date;
}

export interface PersonasRepositoryPort {
  obtener(id: string): Promise<PersonaDto | null>;
  listar(): Promise<readonly PersonaDto[]>;
  /** Cuántas personas tienen hoy el rol de administrador SIG (para no dejar a la empresa sin ninguna). */
  contarAdministradores(): Promise<number>;
  /** Alta de una persona nueva. `correo_repetido` si ya hay otra con ese correo en la empresa. */
  insertar(p: { id: string; nombre: string; correo: string; rol: Rol }): Promise<'ok' | 'correo_repetido'>;
  /** Vuelve a dar acceso a una persona dada de baja: rol, nombre y correo nuevos y sin fecha de baja. */
  reactivar(p: {
    id: string;
    nombre: string;
    correo: string;
    rol: Rol;
    versionEsperada: number;
  }): Promise<'ok' | 'correo_repetido' | 'version_vieja'>;
  /** `false` si la versión ya no es la esperada (alguien cambió a la persona a la vez) o la persona no tiene rol. */
  cambiarRol(id: string, rol: Rol, versionEsperada: number): Promise<boolean>;
  /** Deja el rol en nulo y anota la baja. `false` si la versión ya no es la esperada o la persona ya estaba de baja. */
  darDeBaja(id: string, versionEsperada: number, ahora: Date): Promise<boolean>;
}

export interface SolicitudesRepositoryPort {
  /** Marca como vencidas las pendientes cuyo plazo ya pasó (así la persona y el código quedan libres). */
  vencerVencidas(ahora: Date): Promise<void>;
  vigenteDe(usuarioId: string, ahora: Date): Promise<SolicitudDto | null>;
  obtenerVigente(id: string, ahora: Date): Promise<SolicitudDto | null>;
  listarVigentes(ahora: Date): Promise<readonly SolicitudDto[]>;
  contarVigentes(ahora: Date): Promise<number>;
  /** `conflicto` si ya hay una vigente de esa persona o si el código ya lo usa otra vigente de la empresa (no deja la transacción rota). */
  crear(s: { id: string; usuarioId: string; codigo: string; creadaEn: Date; venceEn: Date }): Promise<'creada' | 'conflicto'>;
  /** `false` si ya no estaba pendiente. */
  resolver(id: string, estado: 'aprobada' | 'descartada', por: string, ahora: Date): Promise<boolean>;
}

/** Lo que cada caso de uso recibe dentro de la unidad de trabajo, todo ligado a la misma transacción y empresa. */
export interface ContextoPersonas {
  readonly personas: PersonasRepositoryPort;
  readonly solicitudes: SolicitudesRepositoryPort;
  readonly bitacora: BitacoraDeUnidad;
}

/** Puerto de salida: ejecuta `fn` en una unidad atómica ligada a UNA empresa (todo se confirma junto o se revierte junto). */
export interface UnidadDeTrabajoPersonasPort {
  ejecutar<T>(empresaId: EmpresaId, fn: (contexto: ContextoPersonas) => Promise<T>): Promise<T>;
}

export type PermisoDePersonas = 'personas.ver' | 'personas.gestionar';

/** ¿Puede esta persona hacer esto en esta empresa? Si no se puede decidir, debe fallar (nunca responder «sí»). */
export interface PermisoPersonasPort {
  puede(usuarioId: string, permiso: PermisoDePersonas, empresaId: EmpresaId): Promise<boolean>;
}
