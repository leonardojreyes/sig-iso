// Roles (ADR 008) y matriz de permisos del corte 0.6. Cerrado por defecto: lo que no está en la matriz se niega.

/** Roles del dominio. En este corte solo `administrador_sig` y `colaborador` tienen permisos. */
export const ROLES = Object.freeze(['administrador_sig', 'dueno_proceso', 'auditor_interno', 'auditor_externo', 'colaborador', 'alta_direccion'] as const);
export type Rol = (typeof ROLES)[number];

/**
 * Permisos formales. `librerias.adoptar` es el `x-permiso` del contrato OpenAPI (POST /librerias/{id}/adopcion). `ia.usar` (paso 0.7,
 * Q1 del spec) permite pedir una explicación a la IA y elegir modelo; no concede nada más.
 */
export const PERMISOS = Object.freeze(['librerias.adoptar', 'librerias.ver', 'requisitos.ver', 'marca.ver', 'ia.usar'] as const);
export type Permiso = (typeof PERMISOS)[number];

const CONSULTA: readonly Permiso[] = Object.freeze(['librerias.ver', 'requisitos.ver', 'marca.ver', 'ia.usar']);

const MATRIZ: ReadonlyMap<Rol, readonly Permiso[]> = new Map<Rol, readonly Permiso[]>([
  ['administrador_sig', PERMISOS],
  ['colaborador', CONSULTA],
  // Los demás roles se definen con sus módulos (evaluación, auditoría...): hasta entonces no pueden nada.
  ['dueno_proceso', Object.freeze([])],
  ['auditor_interno', Object.freeze([])],
  ['auditor_externo', Object.freeze([])],
  ['alta_direccion', Object.freeze([])],
]);

export const esRol = (valor: unknown): valor is Rol => typeof valor === 'string' && (ROLES as readonly string[]).includes(valor);
export const esPermiso = (valor: unknown): valor is Permiso => typeof valor === 'string' && (PERMISOS as readonly string[]).includes(valor);

/** Permisos de un rol (lista inmutable). */
export const permisosDe = (rol: Rol): readonly Permiso[] => MATRIZ.get(rol) ?? Object.freeze([]);
