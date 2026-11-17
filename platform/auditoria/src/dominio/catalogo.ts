// Catálogo cerrado de lo que se puede registrar en la bitácora (ADR 028, spec del corte 0.6, §7).
// Cada acción declara quién puede hacerla, con qué resultado y motivo, sobre qué objeto y qué claves y valores admite en
// `antes`/`despues`. Todo es de vocabulario cerrado: no hay forma de colar texto libre ni datos personales.

export const ACCIONES = [
  'login.ok',
  'login.fallido',
  'logout',
  'sesion.expirada',
  'libreria.adoptada',
  'libreria.cargada',
  'empresa.cambiada',
  'marca.cambiada',
  'evaluacion.cambiada',
  'alcance.cambiado',
  'alcance.aprobado',
  'control.creado',
  'control.cambiado',
  'control.retirado',
  'mapeo.creado',
  'mapeo.eliminado',
  'evidencia.creada',
  'evidencia.reemplazada',
  'evidencia.eliminada',
  'evidencia.descargada',
  'evidencia.subida_rechazada',
  'declaracion.aprobada',
  'declaracion.exportada',
  'acceso.denegado',
  'acceso.cruzado',
  'acceso.solicitado',
  'acceso.rechazado',
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
  'tipo_no_permitido',
  'tamano_excedido',
  'firma_invalida',
  'codigo_no_permitido',
  'ya_cargada',
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
  // Librería propia subida desde la web (MVP, M6a). Solo código, versión, huella y conteos: nunca el contenido ni el texto de los errores.
  // Una persona que pertenece a varias empresas cambia la empresa activa de su sesión (ADR 035). Se registra en la empresa DESTINO.
  'empresa.cambiada': { ...nada, actores: ['usuario'], empresa: 'obligatoria', resultados: ['ok'], objeto: 'obligatorio' },
  // La empresa edita su marca (ADR 035, M6b-2). Solo QUÉ cambió (banderas), nunca el color ni la dirección del logo.
  'marca.cambiada': { ...nada, actores: ['usuario'], empresa: 'obligatoria', resultados: ['ok'], objeto: 'obligatorio', despues: { color_cambiado: 'booleano', logo_cambiado: 'booleano' } },
  'libreria.cargada': {
    ...nada,
    actores: ['usuario'],
    empresa: 'obligatoria',
    resultados: ['ok', 'rechazado'],
    motivo: 'opcional',
    motivos: ['tipo_no_permitido', 'tamano_excedido', 'formato_invalido', 'contenido_no_permitido', 'codigo_no_permitido', 'hash_distinto', 'ya_cargada'],
    objeto: 'obligatorio',
    objetoVersion: 'obligatorio',
    despues: { entradas: 'entero' },
  },
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
  // Evidencias con archivo (MVP, M4). El hecho lleva la HUELLA SHA-256 del archivo como versión del objeto (queda fijada en la cadena
  // inmutable); el título, el nombre del archivo y su contenido NUNCA van a la bitácora. El objeto es `evidencia:<uuid>` o, si se
  // rechaza una subida, el control `control:<codigo>`.
  'evidencia.creada': { ...nada, actores: ['usuario'], empresa: 'obligatoria', resultados: ['ok'], objeto: 'obligatorio', objetoVersion: 'obligatorio' },
  'evidencia.reemplazada': { ...nada, actores: ['usuario'], empresa: 'obligatoria', resultados: ['ok'], objeto: 'obligatorio', objetoVersion: 'obligatorio' },
  'evidencia.eliminada': { ...nada, actores: ['usuario'], empresa: 'obligatoria', resultados: ['ok'], objeto: 'obligatorio', objetoVersion: 'obligatorio' },
  'evidencia.descargada': { ...nada, actores: ['usuario'], empresa: 'obligatoria', resultados: ['ok'], objeto: 'obligatorio', objetoVersion: 'obligatorio' },
  'evidencia.subida_rechazada': { ...nada, actores: ['usuario'], empresa: 'obligatoria', resultados: ['rechazado'], motivo: 'obligatorio', motivos: ['tipo_no_permitido', 'tamano_excedido', 'firma_invalida'], objeto: 'obligatorio', objetoVersion: 'opcional' },
  // Declaración de Aplicabilidad (M5). La aprobación guarda solo el número de versión (objeto `declaracion:v<n>`) y los conteos; la
  // exportación fija la HUELLA SHA-256 del documento entregado (objeto `declaracion:v<n>` o `declaracion:borrador`). Ningún texto.
  'declaracion.aprobada': { ...nada, actores: ['usuario'], empresa: 'obligatoria', resultados: ['ok'], objeto: 'obligatorio', despues: { total: 'entero', aplican: 'entero', no_aplican: 'entero', sin_control: 'entero' } },
  'declaracion.exportada': { ...nada, actores: ['usuario'], empresa: 'obligatoria', resultados: ['ok'], objeto: 'obligatorio', objetoVersion: 'obligatorio' },
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
  // Personas (MVP, M7, ADR 036). La solicitud se nombra por su identificador (`solicitud:<uuid>`), nunca por su código; solo roles de la
  // lista cerrada y banderas: el nombre y el correo que escribe el administrador NUNCA van a la bitácora. Las hace una persona (quien pide
  // acceso y quien administra) o el mantenimiento.
  'acceso.solicitado': { ...nada, actores: ['usuario'], empresa: 'obligatoria', resultados: ['ok'], objeto: 'obligatorio' },
  'acceso.rechazado': { ...nada, actores: ['usuario'], empresa: 'obligatoria', resultados: ['ok'], objeto: 'obligatorio' },
  'rol.cambiado': { ...nada, actores: ['usuario', 'proceso', 'plataforma'], empresa: 'obligatoria', resultados: ['ok'], objeto: 'obligatorio', antes: { rol: { estado: ROLES } }, despues: { rol: { estado: ROLES } } },
  'usuario.alta': { ...nada, actores: ['usuario', 'proceso', 'plataforma'], empresa: 'obligatoria', resultados: ['ok'], objeto: 'obligatorio', despues: { rol: { estado: ROLES } } },
  'usuario.baja': { ...nada, actores: ['usuario', 'proceso', 'plataforma'], empresa: 'obligatoria', resultados: ['ok'], objeto: 'obligatorio', antes: { rol: { estado: ROLES } } },
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
