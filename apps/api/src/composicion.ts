// Composición de producción: arma el verificador de tokens, el registro de hechos y los casos de uso a partir del entorno.
import { Bitacora, BitacoraKysely } from '@sig/auditoria';
import type { AutorizacionPort } from '@sig/autorizacion';
import { crearJwksRemoto, TokenVerifierJose } from '@sig/autenticacion';
import { GestorPools, leerUrls } from '@sig/db';
import { EmpresaKysely, ObtenerIdentidadUseCase, ObtenerMarcaUseCase, type EmpresaRepositoryPort } from '@sig/empresas';
import { AdoptarLibreriaUseCase, crearUnidadDeTrabajoNormas, ListarLibreriasUseCase, ListarRequisitosUseCase, ObtenerRequisitoUseCase, type ContextoAdopcion, type UnidadDeTrabajoPort } from '@sig/normas';
import type { OpcionesAutenticacion } from './autenticacion/autenticacion.module.js';
import { leerConfiguracionAuth, type Entorno } from './autenticacion/configuracion.js';
import type { RegistradorHechos } from './autenticacion/registrador-token-invalido.js';
import type { OpcionesEmpresaSesion } from './empresas/empresa-sesion.module.js';
import type { OpcionesNormasApi } from './normas/normas-api.module.js';

/** Hasta que exista el adaptador de OpenFGA (tarea 9.3) la autorización falla cerrada: ni «sí» ni roles inventados. */
class AutorizacionNoConfigurada implements AutorizacionPort {
  puede(): Promise<boolean> {
    return Promise.reject(new Error('La autorización no está configurada: falta el adaptador de OpenFGA (tarea 9.3)'));
  }
  rolesDe(): Promise<never> {
    return Promise.reject(new Error('La autorización no está configurada: falta el adaptador de OpenFGA (tarea 9.3)'));
  }
}

export interface Composicion {
  readonly autenticacion: OpcionesAutenticacion;
  readonly negocio: OpcionesEmpresaSesion;
  readonly normas: OpcionesNormasApi;
  readonly hechos: RegistradorHechos;
  readonly autorizacion: AutorizacionPort;
}

/**
 * Las conexiones a la base de datos se abren la primera vez que se usan: si faltan las URLs, la API arranca (por ejemplo
 * para `/health`) y cualquier operación que las necesite falla con 500, nunca pasa en silencio.
 */
export const componerDesdeEntorno = (env: Entorno): Composicion => {
  const config = leerConfiguracionAuth(env);

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
  const autorizacion = new AutorizacionNoConfigurada();
  // Una unidad de trabajo por ejecución sobre el pool del rol de la aplicación (con la RLS aplicada).
  const unidad: UnidadDeTrabajoPort<ContextoAdopcion> = { ejecutar: async (empresaId, fn) => crearUnidadDeTrabajoNormas(obtenerPools().db('app')).ejecutar(empresaId, fn) };

  return {
    hechos,
    autorizacion,
    autenticacion: {
      verificador: new TokenVerifierJose({ emisor: config.emisor, audiencia: config.audiencia, clienteAutorizado: config.clienteAutorizado, claves: crearJwksRemoto(config.jwksUrl) }),
      hechos,
    },
    negocio: { identidades: new ObtenerIdentidadUseCase(repo, autorizacion), marcas: new ObtenerMarcaUseCase(repo), hechos },
    normas: {
      adoptar: new AdoptarLibreriaUseCase(unidad, autorizacion),
      librerias: new ListarLibreriasUseCase(unidad),
      requisitos: new ListarRequisitosUseCase(unidad),
      requisito: new ObtenerRequisitoUseCase(unidad),
    },
  };
};
