# modules/ — reglas

Cada módulo: `src/{domain,application,infrastructure,interface}` y `src/index.ts` como única API pública.

- `domain`: entidades, objetos de valor, reglas. Sin imports de otras capas ni de frameworks (lo verifica `pnpm lint`).
- `application`: casos de uso y **puertos** (`*.port.ts`, con token `Symbol`). Sin NestJS.
- `infrastructure`: adaptadores (PostgreSQL, S3, IA). Todo acceso a datos fija la empresa (`SET LOCAL app.tenant_id`).
- `interface`: controladores NestJS, DTO con `@ApiProperty({ type })`, `@Inject(TOKEN)` explícito.
- Etiqueta Nx en `package.json`: `"nx": { "tags": ["type:module"] }`. Un módulo nunca importa de `apps/` ni de otro módulo salvo por su `index.ts`.
- Toda funcionalidad trae: prueba de dominio, prueba de caso de uso y **prueba de aislamiento entre empresas**.
- Plantilla de referencia: `modules/normas`.
