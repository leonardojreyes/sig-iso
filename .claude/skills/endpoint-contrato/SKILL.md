---
name: endpoint-contrato
description: Agrega un endpoint a la API partiendo del contrato OpenAPI 3.1 (packages/contracts/openapi.yaml), regenera los tipos compartidos y lo implementa en apps/api con errores problem+json, permisos y orden de evaluación 401→403→400→404. Úsalo siempre que se cree o cambie una operación HTTP (regla 6, contrato primero).
---

# Skill: endpoint desde el contrato

## Cuándo usarlo

- Una operación HTTP nueva o un cambio de una existente (ruta, parámetros, respuestas, permisos).
- **El contrato va primero**: no escribas el controlador antes de que el contrato y su prueba existan.

## Convenciones del proyecto (ADR 027, ADR 029)

- **La empresa nunca es un parámetro:** sale solo del token verificado (`@Identidad() identidad` → `identidad.empresaId`). Ningún `X-Empresa`, `?empresa=` ni campo de cuerpo.
- Errores cerrados `application/problem+json` (`Problema`): 400, 401, 403, 404, 429, 500. Orden de evaluación: **401 → 403 → 400 → 404** (el permiso se decide antes de mirar el recurso). Un recurso de otra empresa responde **404 indistinguible** de uno que no existe; el filtro global registra el `acceso.cruzado` y el `acceso.denegado`.
- Permiso en el contrato con `x-permiso: <rol>` y en el caso de uso con `AutorizacionPort.puede(...)` (matriz en `platform/autorizacion`, rol guardado en `usuario.rol`).
- Respuestas con datos de la persona o de la empresa: `Cache-Control: no-store`. Esquemas con `additionalProperties: false`, `maxLength`, `pattern` y `format: uuid` donde corresponda.
- Un cambio de estado se registra en la bitácora **en la misma transacción** (`BitacoraPort`, regla 4). Nada de IP ni datos personales en el hecho.

## Pasos

1. **Contrato (`packages/contracts/openapi.yaml`):** agrega la ruta con `operationId` en camelCase, `tags`, descripción, parámetros, respuestas y `$ref` a los componentes de error y de caché existentes (`#/components/responses/NoAutenticado`, `LimiteExcedido`, `ErrorInterno`, `#/components/headers/CacheControlNoStore`…). Agrega los esquemas en `components/schemas`.
2. **Regenerar los tipos:** `pnpm --filter @sig/contracts generar` escribe `packages/contracts/src/generado/api.d.ts` (no se edita a mano). `pnpm --filter @sig/contracts generar:check` falla si quedó desactualizado y **el CI lo ejecuta**. Esos tipos son lo que consumen la API y la web (`@sig/contracts`); no hay otro cliente que generar.
3. **Caso de uso primero (TDD)** en el módulo correspondiente (skill `modulo-hexagonal`): prueba, caso de uso con puertos y, si cambia datos, bitácora en la misma unidad de trabajo.
4. **Controlador en `apps/api/src/<area>/`** (solo composición, sin lógica de negocio): `@Controller`, `@ApiTags`, `@ApiOperation({ operationId })` **igual al del contrato**, `@RespuestasProblema(...)` con los mismos códigos, DTO con `@ApiProperty({ type: ... })` explícito y `@Inject(TOKEN)` explícito (con tsx no hay metadatos de tipos). Regístralo en el módulo Nest del área y en `composicion.ts`. La guardia global es cerrada por omisión: solo `@Publico()` abre una ruta (y casi nada debe serlo).
5. **Conformidad:** `apps/api/src/conformidad-openapi.test.ts` compara el documento generado por Nest con el contrato (operaciones, parámetros, respuestas, permisos). Debe seguir en verde: si falla, el controlador o el contrato están mal.
6. **Pruebas de API** (patrón `apps/api/src/normas/normas.integration.test.ts` y `normas-bitacora.integration.test.ts`): token firmado en la prueba con `jose` y JWKS local; casos 401 sin token, 403 sin permiso, 400 por parámetro inválido, 404 cruzado entre empresas A y B, y la empresa del token manda aunque se envíe otra. Si falla el registro de un rechazo, la respuesta es 500 (no se traga el error).
7. **Web (si hay pantalla):** la consume desde el servidor de la web (`apps/web`), con los tipos de `@sig/contracts`, `cache: 'no-store'` y sin pasar el token al navegador (ADR 027).
8. **Cierre:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, `/review` (arquitecto, revisor-multiempresa, revisor-seguridad) y actualizar `docs/specs/<funcionalidad>/tasks.md`.

## Ejemplo (ilustrativo)

```yaml
# packages/contracts/openapi.yaml
/hallazgos/{id}:
  get:
    operationId: obtenerHallazgo
    summary: Un hallazgo de la empresa de quien consulta
    tags: [hallazgos]
    parameters:
      - {
          name: id,
          in: path,
          required: true,
          schema: { type: string, format: uuid, maxLength: 36 },
        }
    responses:
      "200":
        description: El hallazgo.
        headers:
          {
            Cache-Control: { $ref: "#/components/headers/CacheControlNoStore" },
          }
        content:
          {
            application/json:
              { schema: { $ref: "#/components/schemas/Hallazgo" } },
          }
      "401": { $ref: "#/components/responses/NoAutenticado" }
      "404": { $ref: "#/components/responses/NoEncontrado" } # también si es de otra empresa
      "429": { $ref: "#/components/responses/LimiteExcedido" }
      "500": { $ref: "#/components/responses/ErrorInterno" }
```

```ts
// apps/api/src/hallazgos/hallazgos.controller.ts
@Get('hallazgos/:id')
@ApiOperation({ operationId: 'obtenerHallazgo' })
@RespuestasProblema(400, 401, 404, 429, 500)
async obtener(@Identidad() identidad: IdentidadVerificada, @Param('id') id: string) {
  return this.hallazgo.ejecutar({ empresaId: identidad.empresaId, id }); // 404 si no existe o es de otra empresa
}
```

## Terminado cuando

- `generar:check`, la conformidad del contrato y las pruebas de API (incluida la de empresa cruzada) están en verde.
- El `operationId`, los códigos de respuesta y los permisos del controlador coinciden con el contrato.
