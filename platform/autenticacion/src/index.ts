// API pública de platform/autenticacion: puerto del verificador de tokens, errores, extracción del Bearer y el adaptador de `jose`.
export { extraerBearer, TOKEN_MAX } from './bearer.js';
export { TokenInvalidoError, VerificadorNoDisponibleError, type MotivoTokenInvalido } from './dominio/errores.js';
export { TOKEN_VERIFIER, type IdentidadVerificada, type TokenVerifierPort } from './puertos/token-verifier.port.js';
export { crearJwksRemoto } from './infraestructura/jwks-remoto.js';
export { TokenVerifierJose, type OpcionesVerificador } from './infraestructura/token-verifier-jose.adapter.js';
