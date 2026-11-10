import { HttpException } from '@nestjs/common';
import { EmpresaNoEncontradaError, PersonaNoEncontradaError } from '@sig/empresas';
import { FuncionDeshabilitadaError, LibreriaNoEncontradaError, ParametroInvalidoError, RequisitoNoEncontradoError, SinPermisoError } from '@sig/normas';
import { ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError as ParametroInvalidoCertificacion, SinPermisoError as SinPermisoCertificacion } from '@sig/certificacion';
import { AccesoCruzadoException, AccesoDenegadoException } from './excepciones-acceso.js';

export type Clasificacion =
  /** Autenticada pero sin permiso: 403 y hecho `acceso.denegado`. */
  | { readonly tipo: 'denegado'; readonly objeto: string | null }
  /** Objeto de otra empresa: 404 indistinguible y hecho `acceso.cruzado`. */
  | { readonly tipo: 'cruzado'; readonly objeto: string | null }
  /** Cualquier otra cosa: solo se responde, con ese estado HTTP. */
  | { readonly tipo: 'http'; readonly estado: number };

/**
 * Decide qué hacer con una excepción. Las violaciones de reglas del dominio al LEER datos (por ejemplo, una fila corrupta) no
 * son culpa de quien llama, así que acaban en 500: la validación de lo que envía el cliente se hace antes, en la entrada.
 */
export const clasificarExcepcion = (e: unknown): Clasificacion => {
  if (e instanceof AccesoDenegadoException) return { tipo: 'denegado', objeto: e.objeto ?? null };
  if (e instanceof SinPermisoError) return { tipo: 'denegado', objeto: `accion:${e.permiso}` };
  if (e instanceof SinPermisoCertificacion) return { tipo: 'denegado', objeto: `accion:${e.permiso}` };
  if (e instanceof AccesoCruzadoException) return { tipo: 'cruzado', objeto: e.objeto ?? null };
  if (e instanceof HttpException) return e.getStatus() === 403 ? { tipo: 'denegado', objeto: null } : { tipo: 'http', estado: e.getStatus() };
  // Una función apagada por flag se presenta como inexistente: no revela que existe.
  if (e instanceof RequisitoNoEncontradoError || e instanceof LibreriaNoEncontradaError || e instanceof FuncionDeshabilitadaError) return { tipo: 'http', estado: 404 };
  if (e instanceof EmpresaNoEncontradaError || e instanceof PersonaNoEncontradaError) return { tipo: 'http', estado: 401 };
  if (e instanceof EntradaNoEncontradaError) return { tipo: 'http', estado: 404 };
  if (e instanceof ConflictoError) return { tipo: 'http', estado: 409 };
  if (e instanceof ParametroInvalidoError || e instanceof ParametroInvalidoCertificacion) return { tipo: 'http', estado: 400 };
  return { tipo: 'http', estado: 500 };
};
