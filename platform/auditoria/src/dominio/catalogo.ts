// Catálogo cerrado de lo que se puede registrar en la bitácora (ADR 028, spec del corte 0.6, §7).
// Cada acción declara quién puede hacerla, con qué resultado y motivo, sobre qué objeto y qué claves y valores admite en
// `antes`/`despues`. Todo es de vocabulario cerrado: no hay forma de colar texto libre ni datos personales.

export const ACCIONES = [
  'login.ok',
  'login.fallido',
  'logout',
  'sesion.expirada',
  'libreria.adoptada',
  'evaluacion.cambiada',
  'alcance.cambiado',
  'alcance.aprobado',
  'control.creado',
  'control.cambiado',
  'control.retirado',
  'mapeo.creado',
  'mapeo.eliminado',
  'acceso.denegado',
  'acceso.cruzado',
  'token.invalido',
  'catalogo.cargado',
  'rol.cambiado',
  'usuario.alta',
  'usuario.baja',
  'datos_iniciales.cargados',
  'bitacora.verificacion',
] as const;
export type AccionBitacora = (typeof ACCIONES)[number];

export const ACTORES = ['usuario', 'sistema', 'proceso', 'plataforma'] as const;
export type ActorTipo = (typeof ACTORES)[number];

export const RESULTADOS = ['ok', 'rechazado', 'error'] as const;
export type Resultado = (typeof RESULTADOS)[number];

/** Motivos: códigos de una lista cerrada. Nunca un texto escrito por alguien. */
export const MOTIVOS = [
  'credenciales_invalidas',
  'cuenta_inexistente',
  'cuenta_bloqueada',
  'sesion_inactiva',
  'ya_adoptada',
  'sin_permiso',
  'empresa_distinta',
  'token_vencido',
  'token_alterado',
  'sin_empresa',
  'carga_inicial',
  'hash_distinto',
  'formato_invalido',
  'contenido_no_permitido',
  'cadena_rota',
  'ancla_perdida',
  'secuencia_con_huecos',
  'huella_invalida',
  'enlace_roto',
  'error_no_clasificado',
] as const;
export type MotivoBitacora = (typeof MOTIVOS)[number];

export const ROLES = ['administrador_sig', 'dueno_proceso', 'auditor_interno', 'auditor_externo', 'colaborador', 'alta_direccion', 'ninguno'] as const;

/** Nombres de campo que nunca pueden aparecer en `antes`/`despues`: datos personales y secretos (se compara por palabras). */
export const CLAVES_PROHIBIDAS = ['nombre', 'apellido', 'correo', 'email', 'mail', 'ip', 'direccion', 'telefono', 'cedula', 'password', 'contrasena', 'clave', 'secreto', 'token', 'username', 'usuario_escrito'] as const;

/** Verdadero si alguna palabra del nombre de campo (separado por guion bajo) es una de las prohibidas. */
export const esClaveProhibida = (clave: string): boolean => {
  const palabras = clave.toLowerCase().split('_');
  return CLAVES_PROHIBIDAS.some((p) => palabras.includes(p) || clave.toLowerCase() === p);
};

/** Tipo de valor admitido: siempre cerrado (booleano, entero acotado, UUID, huella, versión, fecha ISO en UTC o un estado de una lista). */
export type TipoValor = 'booleano' | 'entero' | 'uuid' | 'huella' | 'version' | 'fecha' | { readonly estado: readonly string[] };

type Presencia = 'obligatorio' | 'opcional' | 'prohibido';

export interface DefinicionAccion {
  readonly actores: readonly ActorTipo[];
  readonly empresa: 'obligatoria' | 'prohibida' | 'opcional';
  readonly resultados: readonly Resultado[];
  readonly motivo: Presencia;
  readonly motivos: readonly MotivoBitacora[];
  readonly objeto: Presencia;
  readonly objetoVersion: Presencia;
  readonly antes: Readonly<Record<string, TipoValor>>;
  readonly despues: Readonly<Record<string, TipoValor>>;
}

const nada = { motivo: 'prohibido', motivos: [], objeto: 'prohibido', objetoVersion: 'prohibido', antes: {}, despues: {} } as const;

export const CATALOGO: Readonly<Record<AccionBitacora, DefinicionAccion>> = {
  'login.ok': { ...nada, actores: ['usuario'], empresa: 'obligatoria', resultados: ['ok'] },
  'login.fallido': { ...nada, actores: ['proceso', 'sistema'], empresa: 'opcional', resultados: ['rechazado'], motivo: 'obligatorio', motivos: ['credenciales_invalidas', 'cuenta_inexistente', 'cuenta_bloqueada', 'error_no_clasificado'], despues: { ocurrio_en: 'fecha' } },
  logout: { ...nada, actores: ['usuario'], empresa: 'obligatoria', resultados: ['ok'] },
  'sesion.expirada': { ...nada, actores: ['sistema', 'proceso'], empresa: 'obligatoria', resultados: ['ok'], motivo: 'obligatorio', motivos: ['sesion_inactiva'] },
  'libreria.adoptada': {
    ...nada,
    actores: ['usuario'],
    empresa: 'obligatoria',
    resultados: ['ok'],
    motivo: 'opcional',
    motivos: ['ya_adoptada'],
    objeto: 'obligatorio',
    objetoVersion: 'obligatorio',
    antes: { adoptada: 'booleano' },
    despues: { adoptada: 'booleano', entradas: 'entero' },
  },
  // Diagnóstico y alcance (MVP, M2). Solo estados y banderas: el comentario y el texto del alcance NUNCA van a la bitácora.
  'evaluacion.cambiada': {
    ...nada,
    actores: ['usuario'],
    empresa: 'obligatoria',
    resultados: ['ok'],
    objeto: 'obligatorio',
    antes: { estado: { estado: ['cumple', 'parcial', 'no_cumple', 'no_aplica', 'sin_evaluar'] } },
    despues: { estado: { estado: ['cumple', 'parcial', 'no_cumple', 'no_aplica'] } },
  },
  'alcance.cambiado': { ...nada, actores: ['usuario'], empresa: 'obligatoria', resultados: ['ok'], objeto: 'obligatorio', antes: { aprobado: 'booleano' }, despues: { aprobado: 'booleano' } },
  'alcance.aprobado': { ...nada, actores: ['usuario'], empresa: 'obligatoria', resultados: ['ok'], objeto: 'obligatorio' },
  // Controles de la empresa y mapeos (MVP, M3). Solo el hecho y el objeto (`control:<codigo>`, `mapeo:<codigo>.<id-estable>`): el nombre y la descripción NUNCA van a la bitácora.
  'control.creado': { ...nada, actores: ['usuario'], empresa: 'obligatoria', resultados: ['ok'], objeto: 'obligatorio' },
  'control.cambiado': { ...nada, actores: ['usuario'], empresa: 'obligatoria', resultados: ['ok'], objeto: 'obligatorio' },
  'control.retirado': { ...nada, actores: ['usuario'], empresa: 'obligatoria', resultados: ['ok'], objeto: 'obligatorio' },
  'mapeo.creado': { ...nada, actores: ['usuario'], empresa: 'obligatoria', resultados: ['ok'], objeto: 'obligatorio' },
  'mapeo.eliminado': { ...nada, actores: ['usuario'], empresa: 'obligatoria', resultados: ['ok'], objeto: 'obligatorio' },
  'acceso.denegado': { ...nada, actores: ['usuario'], empresa: 'obligatoria', resultados: ['rechazado'], motivo: 'obligatorio', motivos: ['sin_permiso'], objeto: 'opcional' },
  'acceso.cruzado': { ...nada, actores: ['usuario'], empresa: 'obligatoria', resultados: ['rechazado'], motivo: 'obligatorio', motivos: ['empresa_distinta'], objeto: 'opcional' },
  'token.invalido': { ...nada, actores: ['sistema'], empresa: 'opcional', resultados: ['rechazado'], motivo: 'obligatorio', motivos: ['token_vencido', 'token_alterado', 'sin_empresa'] },
  'catalogo.cargado': {
    ...nada,
    actores: ['plataforma'],
    empresa: 'prohibida',
    resultados: ['ok', 'rechazado'],
    motivo: 'opcional',
    motivos: ['carga_inicial', 'hash_distinto', 'formato_invalido', 'contenido_no_permitido'],
    objeto: 'obligatorio',
    objetoVersion: 'obligatorio',
    despues: { entradas: 'entero' },
  },
  'rol.cambiado': { ...nada, actores: ['proceso', 'plataforma'], empresa: 'obligatoria', resultados: ['ok'], objeto: 'obligatorio', antes: { rol: { estado: ROLES } }, despues: { rol: { estado: ROLES } } },
  'usuario.alta': { ...nada, actores: ['proceso', 'plataforma'], empresa: 'obligatoria', resultados: ['ok'], objeto: 'obligatorio' },
  'usuario.baja': { ...nada, actores: ['proceso', 'plataforma'], empresa: 'obligatoria', resultados: ['ok'], objeto: 'obligatorio' },
  'datos_iniciales.cargados': { ...nada, actores: ['plataforma'], empresa: 'prohibida', resultados: ['ok'], motivo: 'obligatorio', motivos: ['carga_inicial'], despues: { empresas: 'entero', usuarios: 'entero' } },
  'bitacora.verificacion': {
    ...nada,
    actores: ['sistema', 'plataforma'],
    empresa: 'prohibida',
    resultados: ['ok', 'error'],
    motivo: 'opcional',
    motivos: ['cadena_rota', 'ancla_perdida', 'secuencia_con_huecos', 'huella_invalida', 'enlace_roto'],
    despues: { problemas: 'entero' },
  },
};
