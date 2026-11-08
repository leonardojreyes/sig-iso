// Composición de producción: arma el verificador de tokens, el registro de hechos y los casos de uso a partir del entorno.
import { Bitacora, BitacoraKysely } from '@sig/auditoria';
import type { AutorizacionPort } from '@sig/autorizacion';
import { crearJwksRemoto, TokenVerifierJose } from '@sig/autenticacion';
import { AutorizacionPostgres, GestorPools, leerUrls } from '@sig/db';
import { EmpresaKysely, ObtenerIdentidadUseCase, ObtenerMarcaUseCase, type EmpresaRepositoryPort } from '@sig/empresas';
import { AdoptarLibreriaUseCase, crearUnidadDeTrabajoNormas, ListarLibreriasUseCase, type FlagsPort, ListarRequisitosUseCase, ObtenerRequisitoUseCase, type ContextoAdopcion, type UnidadDeTrabajoPort } from '@sig/normas';
import type { OpcionesAutenticacion } from './autenticacion/autenticacion.module.js';
import { leerConfiguracionAuth, leerConfiguracionLimites, type Entorno } from './autenticacion/configuracion.js';
import type { RegistradorHechos } from './autenticacion/registrador-token-invalido.js';
import type { OpcionesEmpresaSesion } from './empresas/empresa-sesion.module.js';
import { leerConfiguracionFlags } from './flags/configuracion.js';
import { FlagsOpenFeature } from './flags/flags-openfeature.js';
import type { OpcionesNormasApi } from './normas/normas-api.module.js';

export interface Composicion {
  readonly autenticacion: OpcionesAutenticacion;
  readonly negocio: OpcionesEmpresaSesion;
  readonly normas: OpcionesNormasApi;
  readonly hechos: RegistradorHechos;
  readonly autorizacion: AutorizacionPort;
  readonly flags: FlagsPort;
}

/**
 * Las conexiones a la base de datos se abren la primera vez que se usan: si faltan las URLs, la API arranca (por ejemplo
 * para `/health`) y cualquier operación que las necesite falla con 500, nunca pasa en silencio.
 */
export const componerDesdeEntorno = (env: Entorno, dependencias: { readonly autorizacion?: AutorizacionPort } = {}): Composicion => {
  const config = leerConfiguracionAuth(env);
  const limites = leerConfiguracionLimites(env);
  const flags = new FlagsOpenFeature({ adopcionHabilitada: leerConfiguracionFlags(env).adopcionHabilitada });

  let pools: GestorPools | undefined;
  const obtenerPools = (): GestorPools => (pools ??= new GestorPools(leerUrls(env, ['app', 'plataforma']), { max: 4 }));
  let bitacora: Bitacora | undefined;
  const obtenerBitacora = (): Bitacora => (bitacora ??= new Bitacora(new BitacoraKysely({ app: obtenerPools().db('app'), plataforma: obtenerPools().db('plataforma') })));

  const hechos: RegistradorHechos = {
    registrar: async (evento) => obtenerBitacora().registrar(evento),
    registrarUnaVez: async (evento) => obtenerBitacora().registrarUnaVez(evento),
  };
  const repo: EmpresaRepositoryPort = {
    obtenerPropia: async (empresaId) => new EmpresaKysely(obtenerPools().db('app')).obtenerPropia(empresaId),
    obtenerPersona: async (empresaId, usuarioId) => new EmpresaKysely(obtenerPools().db('app')).obtenerPersona(empresaId, usuarioId),
  };
  // ADR 029: el rol de cada persona vive en la base (usuario.rol) y los permisos salen de la matriz del código. Se consulta con
  // el rol de la aplicación dentro de la empresa, así que la RLS impide usar el rol de una empresa en otra. Falla cerrada.
  const autorizacion: AutorizacionPort = dependencias.autorizacion ?? {
    puede: async (usuarioId, permiso, empresaId) => new AutorizacionPostgres(obtenerPools().db('app')).puede(usuarioId, permiso, empresaId),
    rolesDe: async (usuarioId, empresaId) => new AutorizacionPostgres(obtenerPools().db('app')).rolesDe(usuarioId, empresaId),
  };
  // Una unidad de trabajo por ejecución sobre el pool del rol de la aplicación (con la RLS aplicada).
  const unidad: UnidadDeTrabajoPort<ContextoAdopcion> = { ejecutar: async (empresaId, fn) => crearUnidadDeTrabajoNormas(obtenerPools().db('app')).ejecutar(empresaId, fn) };

  return {
    hechos,
    autorizacion,
    flags,
    autenticacion: {
      verificador: new TokenVerifierJose({ emisor: config.emisor, audiencia: config.audiencia, clienteAutorizado: config.clienteAutorizado, claves: crearJwksRemoto(config.jwksUrl) }),
      hechos,
      limites,
    },
    negocio: { identidades: new ObtenerIdentidadUseCase(repo, autorizacion), marcas: new ObtenerMarcaUseCase(repo), hechos },
    normas: {
      adoptar: new AdoptarLibreriaUseCase(unidad, autorizacion, () => new Date(), flags),
      librerias: new ListarLibreriasUseCase(unidad),
      requisitos: new ListarRequisitosUseCase(unidad),
      requisito: new ObtenerRequisitoUseCase(unidad),
    },
  };
};
