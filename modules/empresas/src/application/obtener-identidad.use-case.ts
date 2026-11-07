import type { Rol } from '@sig/autorizacion';
import { crearEmpresaId, type EmpresaId } from '@sig/tenancy';
import type { EmpresaRepositoryPort } from './empresa-repository.port.js';
import { EmpresaNoEncontradaError } from './obtener-marca.use-case.js';

/**
 * La cuenta del token ya no vale en esta empresa: no existe en ella o no tiene ningún rol (cuenta desactivada o movida).
 * No repite identificadores. La API la responde como 401.
 */
export class PersonaNoEncontradaError extends Error {
  constructor() {
    super('Persona no encontrada en la empresa');
    this.name = 'PersonaNoEncontradaError';
  }
}

/** Roles de una persona en una empresa. Lo cumple `AutorizacionPort` de platform/autorizacion. */
export interface RolesPort {
  rolesDe(usuarioId: string, empresaId: EmpresaId): Promise<readonly Rol[]>;
}

export interface IdentidadDto {
  readonly usuarioId: string;
  readonly nombre: string;
  readonly roles: readonly Rol[];
  /** Solo nombre y slug: el identificador interno de la empresa no se expone. */
  readonly empresa: { readonly slug: string; readonly nombre: string };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UUID_NULO = '00000000-0000-0000-0000-000000000000';

/** Quién es la persona del token, con sus roles y su empresa. Empresa y persona salen SOLO del token verificado. */
export class ObtenerIdentidadUseCase {
  constructor(
    private readonly repo: EmpresaRepositoryPort,
    private readonly roles: RolesPort,
  ) {}

  async ejecutar(entrada: { readonly empresaId: EmpresaId; readonly usuarioId: string }): Promise<IdentidadDto> {
    const empresaId = crearEmpresaId(entrada.empresaId);
    const usuarioId = typeof entrada.usuarioId === 'string' ? entrada.usuarioId.toLowerCase() : '';
    if (!UUID.test(usuarioId) || usuarioId === UUID_NULO) throw new Error('El identificador de la persona no es un UUID válido');

    const [empresa, persona, roles] = await Promise.all([
      this.repo.obtenerPropia(empresaId),
      this.repo.obtenerPersona(empresaId, usuarioId),
      this.roles.rolesDe(usuarioId, empresaId),
    ]);
    // Defensa en profundidad: aunque un repositorio no aislara, jamás se arma la identidad con datos de otra empresa o persona.
    if (empresa === null || empresa.id !== empresaId) throw new EmpresaNoEncontradaError();
    if (persona === null || persona.id !== usuarioId || roles.length === 0) throw new PersonaNoEncontradaError();
    return { usuarioId, nombre: persona.nombre, roles: [...roles], empresa: { slug: empresa.slug, nombre: empresa.nombre } };
  }
}
