// Decoradores de documentación OpenAPI que no son propios de un controlador: la respuesta de error del contrato (Problema) y
// los parámetros de ruta y consulta. La prueba de conformidad compara lo que generan con packages/contracts/openapi.yaml.
import { applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiParam, ApiProperty, ApiQuery, ApiResponse, getSchemaPath } from '@nestjs/swagger';

export class ProblemaResponse {
  @ApiProperty({ type: String, enum: ['about:blank'], maxLength: 20 }) type!: string;
  @ApiProperty({ type: String, maxLength: 120 }) title!: string;
  @ApiProperty({ type: 'integer', minimum: 400, maximum: 599 }) status!: number;
  @ApiProperty({ type: String, enum: ['no_autenticado', 'sin_permiso', 'no_encontrado', 'parametro_invalido', 'conflicto', 'limite_excedido', 'error_interno'] }) codigo!: string;
}

const DESCRIPCIONES: Record<number, string> = {
  400: 'Un parámetro no cumple el formato o los límites indicados. No se repite el valor recibido.',
  401: 'Falta el token, está vencido, alterado o no trae empresa.',
  403: 'Sin permiso. No distingue si lo pedido existe.',
  404: 'No encontrado. Es la única respuesta para «no existe», «es de otra empresa» y «no adoptada».',
  409: 'El estado actual no permite la acción, o otra persona cambió la evaluación mientras se editaba.',
  429: 'Demasiadas solicitudes en poco tiempo. Se puede reintentar después de `Retry-After` segundos.',
  500: 'Error interno. Sin detalles de la solicitud.',
};

/** Declara las respuestas de error de la operación, todas con `application/problem+json` y el esquema cerrado Problema. */
export const RespuestasProblema = (...estados: number[]): MethodDecorator & ClassDecorator =>
  applyDecorators(
    ApiExtraModels(ProblemaResponse),
    ...estados.map((status) =>
      ApiResponse({
        status,
        description: DESCRIPCIONES[status] ?? 'Error',
        content: { 'application/problem+json': { schema: { $ref: getSchemaPath(ProblemaResponse) } } },
        ...(status === 429 ? { headers: { 'Retry-After': { description: 'Segundos que hay que esperar antes de volver a intentarlo.', schema: { type: 'integer', minimum: 1 } } } } : {}),
      }),
    ),
  ) as MethodDecorator & ClassDecorator;

/** Parámetro de ruta `id`: UUID en forma canónica (como `IdRuta` del contrato). */
export const ParametroIdRuta = (): MethodDecorator =>
  ApiParam({
    name: 'id',
    required: true,
    schema: { type: 'string', format: 'uuid', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$', maxLength: 36 },
  });

/** Filtros de `GET /requisitos` (iguales a los del contrato). */
export const ConsultaRequisitos = (): MethodDecorator =>
  applyDecorators(
    ApiQuery({ name: 'q', required: false, schema: { type: 'string', minLength: 1, maxLength: 80, pattern: '^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ .:-]+$' } }),
    ApiQuery({ name: 'capitulo', required: false, schema: { type: 'integer', minimum: 4, maximum: 10 } }),
    ApiQuery({ name: 'norma', required: false, schema: { type: 'string', minLength: 1, maxLength: 60, pattern: '^[A-Za-z0-9 :./-]+$' } }),
    ApiQuery({ name: 'tipo', required: false, schema: { type: 'string', enum: ['clausula', 'control'] } }),
  ) as MethodDecorator;

/** Respuesta 200 con una lista acotada (`maxItems` del contrato) de elementos del DTO indicado. */
export const RespuestaLista = (dto: new () => object, maxItems: number): MethodDecorator & ClassDecorator =>
  applyDecorators(ApiExtraModels(dto), ApiOkResponse({ schema: { type: 'array', maxItems, items: { $ref: getSchemaPath(dto) } } })) as MethodDecorator & ClassDecorator;
