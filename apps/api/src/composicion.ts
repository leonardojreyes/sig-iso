// Composición de producción: arma el verificador de tokens, el registro de hechos y los casos de uso a partir del entorno.
import { createHash, randomUUID } from 'node:crypto';
import { Bitacora, BitacoraKysely } from '@sig/auditoria';
import type { AutorizacionPort } from '@sig/autorizacion';
import { crearJwksRemoto, TokenVerifierJose } from '@sig/autenticacion';
import { AutorizacionPostgres, GestorPools, leerUrls } from '@sig/db';
import { AvisoRetiroRiesgoUseCase, CambiarRiesgoUseCase, CrearRiesgoUseCase, DesvincularRiesgoControlUseCase, GuardarReferenciaUseCase, ListarMotivosUseCase, ListarReferenciasUseCase, ListarRiesgosUseCase, ObtenerRiesgoUseCase, PreverTratamientoUseCase, QuitarMotivoUseCase, QuitarReferenciaUseCase, QuitarTratamientoPrevistoUseCase, RegistrarMotivoUseCase, RetirarRiesgoUseCase, RiesgosDeUnControlUseCase, VincularRiesgoControlUseCase, AprobarDeclaracionUseCase, ExportarDeclaracionUseCase, GeneradorDocumentoDocx, ListarVersionesDeclaracionUseCase, ObtenerDeclaracionUseCase, ObtenerVersionDeclaracionUseCase, AgregarMapeoUseCase, AlmacenArchivosLocal, DescargarEvidenciaUseCase, EliminarEvidenciaUseCase, ListarCoberturaUseCase, ListarEvidenciasUseCase, ReemplazarEvidenciaUseCase, SubirEvidenciaUseCase, type AlmacenArchivosPort, AprobarAlcanceUseCase, CambiarControlUseCase, CrearControlUseCase, EvaluarEntradaUseCase, ListarControlesUseCase, QuitarMapeoUseCase, RetirarControlUseCase, GuardarAlcanceUseCase, ListarAlcancesUseCase, ListarDiagnosticoUseCase, crearUnidadDeTrabajoCertificacion, type ContextoCertificacion, type UnidadDeTrabajoPort as UnidadDeTrabajoCertificacionPort } from '@sig/certificacion';
import { AprobarSolicitudUseCase, CambiarRolUseCase as CambiarRolPersonaUseCase, crearUnidadDeTrabajoPersonas, DarDeBajaUseCase, DescartarSolicitudUseCase, ListarPersonasUseCase, SolicitarAccesoUseCase, type UnidadDeTrabajoPersonasPort, ActualizarMarcaUseCase, crearUnidadDeTrabajoMarca, CambiarEmpresaUseCase, EmpresaActivaKysely, EmpresaKysely, ListarMisEmpresasUseCase, ObtenerIdentidadUseCase, ObtenerMarcaUseCase, OlvidarEmpresaActivaUseCase, ResolverEmpresaActivaUseCase, type EmpresaActivaPort, type EmpresaRepositoryPort } from '@sig/empresas';
import { AdoptarLibreriaUseCase, CargarLibreriaUseCase, crearUnidadDeTrabajoCarga, LectorLibreriaYaml, type ContextoCarga, crearUnidadDeTrabajoNormas, ListarLibreriasUseCase, type FlagsPort, ListarRequisitosUseCase, ObtenerRequisitoUseCase, type ContextoAdopcion, type UnidadDeTrabajoPort } from '@sig/normas';
import { crearCasosAuditoria } from './certificacion/auditoria.casos.js';
import { crearCasosActivos } from './certificacion/activos.casos.js';
import { crearCasosDocumentales } from './certificacion/documentos.casos.js';
import type { OpcionesAutenticacion } from './autenticacion/autenticacion.module.js';
import { leerConfiguracionAuth, leerConfiguracionLimites, type Entorno } from './autenticacion/configuracion.js';
import type { RegistradorHechos } from './autenticacion/registrador-token-invalido.js';
import type { OpcionesEmpresaSesion } from './empresas/empresa-sesion.module.js';
import { leerConfiguracionFlags } from './flags/configuracion.js';
import { FlagsOpenFeature } from './flags/flags-openfeature.js';
import { CatalogoNormasAdapter } from './certificacion/catalogo-normas.adapter.js';
import type { OpcionesCertificacionApi } from './certificacion/certificacion-api.module.js';
import type { OpcionesNormasApi } from './normas/normas-api.module.js';
import type { OpcionesPersonasApi } from './personas/personas-api.module.js';

export interface Composicion {
  readonly autenticacion: OpcionesAutenticacion;
  readonly negocio: OpcionesEmpresaSesion;
  readonly normas: OpcionesNormasApi;
  readonly certificacion: OpcionesCertificacionApi;
  readonly personas: OpcionesPersonasApi;
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
  // ADR 035: la empresa activa de la sesión y las pertenencias de la persona viven fuera de la empresa de la petición (se consultan
  // ANTES de conocerla), por eso las atiende el rol de PLATAFORMA con permisos mínimos y no el de la aplicación.
  const empresaActiva: EmpresaActivaPort = {
    activaDe: async (...a) => new EmpresaActivaKysely(obtenerPools().db('plataforma')).activaDe(...a),
    empresasDe: async (...a) => new EmpresaActivaKysely(obtenerPools().db('plataforma')).empresasDe(...a),
    fijar: async (...a) => new EmpresaActivaKysely(obtenerPools().db('plataforma')).fijar(...a),
    limpiar: async (...a) => new EmpresaActivaKysely(obtenerPools().db('plataforma')).limpiar(...a),
  };
  // Una unidad de trabajo por ejecución sobre el pool del rol de la aplicación (con la RLS aplicada).
  const unidad: UnidadDeTrabajoPort<ContextoAdopcion> = { ejecutar: async (empresaId, fn) => crearUnidadDeTrabajoNormas(obtenerPools().db('app')).ejecutar(empresaId, fn) };

  const unidadCarga: UnidadDeTrabajoPort<ContextoCarga> = { ejecutar: async (empresaId, fn) => crearUnidadDeTrabajoCarga(obtenerPools().db('app')).ejecutar(empresaId, fn) };

  const librerias = new ListarLibreriasUseCase(unidad);
  const requisitos = new ListarRequisitosUseCase(unidad);
  const catalogo = new CatalogoNormasAdapter(librerias, requisitos);
  const unidadCertificacion: UnidadDeTrabajoCertificacionPort<ContextoCertificacion> = { ejecutar: async (empresaId, fn) => crearUnidadDeTrabajoCertificacion(obtenerPools().db('app')).ejecutar(empresaId, fn) };
  const reloj = (): Date => new Date();
  // Personas y solicitudes de acceso (ADR 036): una unidad de trabajo por ejecución sobre el pool de la aplicación (con la RLS aplicada).
  const unidadPersonas: UnidadDeTrabajoPersonasPort = { ejecutar: async (empresaId, fn) => crearUnidadDeTrabajoPersonas(obtenerPools().db('app')).ejecutar(empresaId, fn) };
  // El almacén de evidencias se abre al usarlo por primera vez: si falta `EVIDENCIAS_DIR`, la API arranca y solo la subida y la descarga
  // fallan (500, sin dar la ruta), nunca en silencio.
  let almacenLocal: AlmacenArchivosLocal | undefined;
  const obtenerAlmacen = (): AlmacenArchivosLocal => (almacenLocal ??= new AlmacenArchivosLocal(env['EVIDENCIAS_DIR'] ?? ''));
  const almacen: AlmacenArchivosPort = {
    guardarTemporal: (...a) => obtenerAlmacen().guardarTemporal(...a),
    abrirLector: (...a) => obtenerAlmacen().abrirLector(...a),
    confirmar: (...a) => obtenerAlmacen().confirmar(...a),
    descartar: (...a) => obtenerAlmacen().descartar(...a),
    abrir: (...a) => obtenerAlmacen().abrir(...a),
  };

  return {
    hechos,
    autorizacion,
    flags,
    autenticacion: {
      verificador: new TokenVerifierJose({ emisor: config.emisor, audiencia: config.audiencia, clienteAutorizado: config.clienteAutorizado, claves: crearJwksRemoto(config.jwksUrl) }),
      hechos,
      limites,
      empresaActiva: new ResolverEmpresaActivaUseCase(empresaActiva),
    },
    negocio: {
      identidades: new ObtenerIdentidadUseCase(repo, autorizacion),
      marcas: new ObtenerMarcaUseCase(repo),
      actualizarMarca: new ActualizarMarcaUseCase({ ejecutar: async (empresaId, fn) => crearUnidadDeTrabajoMarca(obtenerPools().db('app')).ejecutar(empresaId, fn) }, autorizacion),
      hechos,
      listarEmpresas: new ListarMisEmpresasUseCase(empresaActiva),
      cambiarEmpresa: new CambiarEmpresaUseCase(empresaActiva, hechos),
      olvidarEmpresa: new OlvidarEmpresaActivaUseCase(empresaActiva),
    },
    normas: {
      adoptar: new AdoptarLibreriaUseCase(unidad, autorizacion, () => new Date(), flags),
      cargar: new CargarLibreriaUseCase(unidadCarga, autorizacion, new LectorLibreriaYaml()),
      librerias,
      requisitos,
      requisito: new ObtenerRequisitoUseCase(unidad),
    },
    certificacion: {
      alcances: new ListarAlcancesUseCase(unidadCertificacion, autorizacion, catalogo),
      guardarAlcance: new GuardarAlcanceUseCase(unidadCertificacion, autorizacion, catalogo, reloj),
      aprobarAlcance: new AprobarAlcanceUseCase(unidadCertificacion, autorizacion, catalogo, reloj),
      diagnostico: new ListarDiagnosticoUseCase(unidadCertificacion, autorizacion, catalogo),
      evaluar: new EvaluarEntradaUseCase(unidadCertificacion, autorizacion, catalogo, reloj),
      listarControles: new ListarControlesUseCase(unidadCertificacion, autorizacion, catalogo),
      crearControl: new CrearControlUseCase(unidadCertificacion, autorizacion, reloj, () => randomUUID()),
      cambiarControl: new CambiarControlUseCase(unidadCertificacion, autorizacion, reloj),
      retirarControl: new RetirarControlUseCase(unidadCertificacion, autorizacion, reloj),
      agregarMapeo: new AgregarMapeoUseCase(unidadCertificacion, autorizacion, catalogo, reloj),
      quitarMapeo: new QuitarMapeoUseCase(unidadCertificacion, autorizacion),
      listarEvidencias: new ListarEvidenciasUseCase(unidadCertificacion, autorizacion, reloj),
      subirEvidencia: new SubirEvidenciaUseCase(unidadCertificacion, autorizacion, almacen, reloj, () => randomUUID()),
      reemplazarEvidencia: new ReemplazarEvidenciaUseCase(unidadCertificacion, autorizacion, almacen, reloj, () => randomUUID()),
      eliminarEvidencia: new EliminarEvidenciaUseCase(unidadCertificacion, autorizacion, reloj),
      descargarEvidencia: new DescargarEvidenciaUseCase(unidadCertificacion, autorizacion, almacen),
      cobertura: new ListarCoberturaUseCase(unidadCertificacion, autorizacion, catalogo, reloj),
      declaracion: new ObtenerDeclaracionUseCase(unidadCertificacion, autorizacion, catalogo, reloj),
      aprobarDeclaracion: new AprobarDeclaracionUseCase(unidadCertificacion, autorizacion, catalogo, reloj, () => randomUUID()),
      versionesDeclaracion: new ListarVersionesDeclaracionUseCase(unidadCertificacion, autorizacion),
      versionDeclaracion: new ObtenerVersionDeclaracionUseCase(unidadCertificacion, autorizacion),
      exportarDeclaracion: new ExportarDeclaracionUseCase(unidadCertificacion, autorizacion, catalogo, new GeneradorDocumentoDocx(), reloj),
      listarRiesgos: new ListarRiesgosUseCase(unidadCertificacion, autorizacion),
      crearRiesgo: new CrearRiesgoUseCase(unidadCertificacion, autorizacion, reloj, () => randomUUID()),
      obtenerRiesgo: new ObtenerRiesgoUseCase(unidadCertificacion, autorizacion, catalogo),
      cambiarRiesgo: new CambiarRiesgoUseCase(unidadCertificacion, autorizacion, reloj),
      avisarRetiroRiesgo: new AvisoRetiroRiesgoUseCase(unidadCertificacion, autorizacion, catalogo),
      retirarRiesgo: new RetirarRiesgoUseCase(unidadCertificacion, autorizacion, reloj),
      vincularRiesgoControl: new VincularRiesgoControlUseCase(unidadCertificacion, autorizacion, reloj),
      desvincularRiesgoControl: new DesvincularRiesgoControlUseCase(unidadCertificacion, autorizacion),
      preverTratamiento: new PreverTratamientoUseCase(unidadCertificacion, autorizacion, catalogo, reloj),
      quitarTratamientoPrevisto: new QuitarTratamientoPrevistoUseCase(unidadCertificacion, autorizacion),
      riesgosDeControl: new RiesgosDeUnControlUseCase(unidadCertificacion, autorizacion),
      listarMotivos: new ListarMotivosUseCase(unidadCertificacion, autorizacion),
      registrarMotivo: new RegistrarMotivoUseCase(unidadCertificacion, autorizacion, catalogo, reloj),
      quitarMotivo: new QuitarMotivoUseCase(unidadCertificacion, autorizacion),
      listarReferencias: new ListarReferenciasUseCase(unidadCertificacion, autorizacion),
      guardarReferencia: new GuardarReferenciaUseCase(unidadCertificacion, autorizacion, reloj),
      quitarReferencia: new QuitarReferenciaUseCase(unidadCertificacion, autorizacion),
      documentos: crearCasosDocumentales(unidadCertificacion, autorizacion, catalogo, almacen, reloj, () => randomUUID()),
      activos: crearCasosActivos(unidadCertificacion, autorizacion, reloj, () => randomUUID()),
      auditoria: crearCasosAuditoria(unidadCertificacion, autorizacion, catalogo, reloj, () => randomUUID(), (texto) => createHash('sha256').update(texto, 'utf8').digest('hex'), new GeneradorDocumentoDocx()),
    },
    personas: {
      solicitarAcceso: new SolicitarAccesoUseCase(unidadPersonas, (n) => crypto.getRandomValues(new Uint8Array(n)), () => randomUUID()),
      listarPersonas: new ListarPersonasUseCase(unidadPersonas, autorizacion),
      aprobarSolicitud: new AprobarSolicitudUseCase(unidadPersonas, autorizacion),
      descartarSolicitud: new DescartarSolicitudUseCase(unidadPersonas, autorizacion),
      cambiarRol: new CambiarRolPersonaUseCase(unidadPersonas, autorizacion),
      darDeBaja: new DarDeBajaUseCase(unidadPersonas, autorizacion),
      reloj,
    },
  };
};
