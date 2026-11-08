import { HttpException } from '@nestjs/common';

/**
 * La persona está autenticada pero no puede hacer esto. Responde 403 `sin_permiso` y deja el hecho `acceso.denegado`
 * (H6.5). `objeto` (opcional, forma `tipo:identificador`) dice a qué se intentó acceder; no va en el mensaje ni en la respuesta.
 */
export class AccesoDenegadoException extends HttpException {
  constructor(readonly objeto?: string) {
    super('Acceso denegado', 403);
  }
}

/**
 * Se intentó acceder a algo de OTRA empresa. Responde un 404 idéntico al de un objeto inexistente y deja el hecho
 * `acceso.cruzado` (H6.10). `objeto` (opcional, forma `tipo:identificador`) no va en el mensaje ni en la respuesta.
 */
export class AccesoCruzadoException extends HttpException {
  constructor(readonly objeto?: string) {
    super('No encontrado', 404);
  }
}
