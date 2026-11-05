import { esEmpresaId } from '@sig/tenancy';
import { ACCIONES, ACTORES, CATALOGO, MOTIVOS, RESULTADOS, type AccionBitacora, type DefinicionAccion, type TipoValor } from './catalogo';
import { EventoBitacoraInvalidoError } from './errores';
import type { RegistroBitacora, ValorBitacora } from './tipos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OBJETO = /^[a-z_]+:[A-Za-z0-9._-]{1,100}$/;
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const HUELLA = /^[0-9a-f]{64}$/;
const ORIGEN = /^[A-Za-z0-9:_.-]{1,200}$/;
const TRAZA = /^[A-Za-z0-9_-]{1,64}$/;
const ENTERO_MAXIMO = 1_000_000_000;

const CAMPOS_EVENTO = new Set(['empresaId', 'actor', 'accion', 'objeto', 'objetoVersion', 'resultado', 'motivo', 'traceId', 'origenId', 'antes', 'despues']);
const CAMPOS_ACTOR = new Set(['tipo', 'usuarioId']);

const esObjetoPlano = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const valorValido = (valor: unknown, tipo: TipoValor): boolean => {
  if (typeof tipo === 'object') return typeof valor === 'string' && tipo.estado.includes(valor);
  switch (tipo) {
    case 'booleano':
      return typeof valor === 'boolean';
    case 'entero':
      return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0 && valor <= ENTERO_MAXIMO;
    case 'uuid':
      return typeof valor === 'string' && UUID.test(valor);
    case 'huella':
      return typeof valor === 'string' && HUELLA.test(valor);
    case 'version':
      return typeof valor === 'string' && VERSION.test(valor);
  }
};

const validarPresencia = (nombre: string, valor: unknown, regla: 'obligatorio' | 'opcional' | 'prohibido', problemas: string[]): boolean => {
  if (valor === undefined || valor === null) {
    if (regla === 'obligatorio') problemas.push(`${nombre} es obligatorio para esta acción`);
    return false;
  }
  if (regla === 'prohibido') {
    problemas.push(`${nombre} no se admite en esta acción`);
    return false;
  }
  return true;
};

const validarAntesDespues = (nombre: 'antes' | 'despues', valor: unknown, permitidas: DefinicionAccion['antes'], problemas: string[]): Record<string, ValorBitacora> | null => {
  if (valor === undefined) return null;
  if (!esObjetoPlano(valor)) {
    problemas.push(`${nombre} debe ser un objeto`);
    return null;
  }
  if (Object.keys(permitidas).length === 0) {
    problemas.push(`${nombre} no se admite en esta acción`);
    return null;
  }
  const limpio: Record<string, ValorBitacora> = {};
  let desconocidas = 0;
  for (const [clave, v] of Object.entries(valor)) {
    const tipo = permitidas[clave];
    if (tipo === undefined) {
      desconocidas++;
      continue;
    }
    if (valorValido(v, tipo)) limpio[clave] = v as ValorBitacora;
    else problemas.push(`${nombre}.${clave} tiene un valor que no es del tipo permitido`);
  }
  // Las claves desconocidas no se nombran: podrían ser el propio dato personal.
  if (desconocidas > 0) problemas.push(`${nombre} trae ${desconocidas} clave(s) no permitida(s) para esta acción`);
  return limpio;
};

/**
 * Valida un evento contra el catálogo y devuelve el registro normalizado e inmutable. Lanza `EventoBitacoraInvalidoError`
 * con TODOS los problemas encontrados (sin repetir valores).
 */
export const validarEvento = (entrada: unknown): RegistroBitacora => {
  const problemas: string[] = [];
  if (!esObjetoPlano(entrada)) throw new EventoBitacoraInvalidoError(['el evento debe ser un objeto']);

  if (Object.keys(entrada).some((k) => !CAMPOS_EVENTO.has(k))) problemas.push('el evento trae campos que no existen en el catálogo');

  const accion = entrada.accion;
  if (typeof accion !== 'string' || !(ACCIONES as readonly string[]).includes(accion)) {
    throw new EventoBitacoraInvalidoError([...problemas, 'accion no está en el catálogo']);
  }
  const def = CATALOGO[accion as AccionBitacora];

  // Actor
  const actor = entrada.actor;
  let actorTipo = '';
  let usuarioId: string | null = null;
  if (!esObjetoPlano(actor)) {
    problemas.push('actor debe ser un objeto');
  } else {
    if (Object.keys(actor).some((k) => !CAMPOS_ACTOR.has(k))) problemas.push('actor trae campos que no existen en el catálogo');
    if (typeof actor.tipo !== 'string' || !(ACTORES as readonly string[]).includes(actor.tipo)) problemas.push('actor.tipo no es válido');
    else if (!(def.actores as readonly string[]).includes(actor.tipo)) problemas.push('actor.tipo no está permitido para esta acción');
    else actorTipo = actor.tipo;
    if (actor.usuarioId !== undefined) {
      if (typeof actor.usuarioId === 'string' && UUID.test(actor.usuarioId)) usuarioId = actor.usuarioId.toLowerCase();
      else problemas.push('actor.usuarioId debe ser un UUID');
    }
    if (actorTipo === 'usuario' && usuarioId === null && actor.usuarioId === undefined) problemas.push('actor.usuarioId es obligatorio cuando el actor es un usuario');
  }

  // Empresa
  const empresa = entrada.empresaId;
  if (empresa === null || empresa === undefined) {
    if (def.empresa === 'obligatoria') problemas.push('empresaId es obligatoria para esta acción');
  } else if (def.empresa === 'prohibida') {
    problemas.push('empresaId no se admite en los hechos de plataforma');
  } else if (!esEmpresaId(empresa)) {
    problemas.push('empresaId no es un UUID válido');
  }

  // Resultado y motivo
  const resultado = entrada.resultado;
  if (typeof resultado !== 'string' || !(RESULTADOS as readonly string[]).includes(resultado)) problemas.push('resultado no es válido');
  else if (!(def.resultados as readonly string[]).includes(resultado)) problemas.push('resultado no está permitido para esta acción');

  const motivo = entrada.motivo;
  if (validarPresencia('motivo', motivo, def.motivo, problemas)) {
    if (typeof motivo !== 'string' || !(MOTIVOS as readonly string[]).includes(motivo)) problemas.push('motivo debe ser un código de la lista cerrada');
    else if (!(def.motivos as readonly string[]).includes(motivo)) problemas.push('motivo no está permitido para esta acción');
  }

  // Objeto, versión, trazabilidad
  const objeto = entrada.objeto;
  if (validarPresencia('objeto', objeto, def.objeto, problemas) && !(typeof objeto === 'string' && OBJETO.test(objeto))) problemas.push('objeto debe tener la forma tipo:identificador');

  const objetoVersion = entrada.objetoVersion;
  if (validarPresencia('objetoVersion', objetoVersion, def.objetoVersion, problemas) && !(typeof objetoVersion === 'string' && (VERSION.test(objetoVersion) || HUELLA.test(objetoVersion)))) {
    problemas.push('objetoVersion debe ser una versión (x.y.z) o una huella de 64 caracteres hexadecimales');
  }

  const origenId = entrada.origenId;
  if (origenId !== undefined && !(typeof origenId === 'string' && ORIGEN.test(origenId))) problemas.push('origenId no tiene un formato válido');
  const traceId = entrada.traceId;
  if (traceId !== undefined && !(typeof traceId === 'string' && TRAZA.test(traceId))) problemas.push('traceId no tiene un formato válido');

  const antes = validarAntesDespues('antes', entrada.antes, def.antes, problemas);
  const despues = validarAntesDespues('despues', entrada.despues, def.despues, problemas);

  if (problemas.length > 0) throw new EventoBitacoraInvalidoError(problemas);

  return Object.freeze({
    empresaId: (empresa ?? null) as RegistroBitacora['empresaId'],
    actorTipo: actorTipo as RegistroBitacora['actorTipo'],
    usuarioId,
    accion: accion as AccionBitacora,
    objeto: (objeto as string | undefined) ?? null,
    objetoVersion: (objetoVersion as string | undefined) ?? null,
    resultado: resultado as RegistroBitacora['resultado'],
    motivo: (motivo as RegistroBitacora['motivo'] | undefined) ?? null,
    traceId: (traceId as string | undefined) ?? null,
    origenId: (origenId as string | undefined) ?? null,
    antes: antes && Object.freeze(antes),
    despues: despues && Object.freeze(despues),
  }) as unknown as RegistroBitacora;
};
