// Casos de uso reales armados con los fakes que separan los datos por empresa, para las pruebas de la API de certificación.
import {
  AgregarMapeoUseCase, AprobarAlcanceUseCase, AprobarDeclaracionUseCase, ExportarDeclaracionUseCase, GeneradorDocumentoDocx, ListarVersionesDeclaracionUseCase, ObtenerDeclaracionUseCase, ObtenerVersionDeclaracionUseCase, CambiarControlUseCase, CrearControlUseCase, DescargarEvidenciaUseCase, EliminarEvidenciaUseCase, EvaluarEntradaUseCase, GuardarAlcanceUseCase,
  ListarAlcancesUseCase, ListarControlesUseCase, ListarCoberturaUseCase, ListarDiagnosticoUseCase, ListarEvidenciasUseCase, QuitarMapeoUseCase, ReemplazarEvidenciaUseCase, RetirarControlUseCase,
  SubirEvidenciaUseCase, type AlmacenArchivosPort,
  AvisoRetiroRiesgoUseCase, CambiarRiesgoUseCase, CrearRiesgoUseCase, DesvincularRiesgoControlUseCase, GuardarReferenciaUseCase, ListarMotivosUseCase, ListarReferenciasUseCase, ListarRiesgosUseCase, ObtenerRiesgoUseCase, PreverTratamientoUseCase, QuitarMotivoUseCase, QuitarReferenciaUseCase, QuitarTratamientoPrevistoUseCase, RegistrarMotivoUseCase, RetirarRiesgoUseCase, RiesgosDeUnControlUseCase, VincularRiesgoControlUseCase,
} from '@sig/certificacion';
import { crearAutorizacionFalsa, crearCatalogoFalso, crearUnidadFalsa, sha256Hex, type EstadoFalso } from '@sig/certificacion/prueba';
import { crearCasosAuditoria } from '../auditoria.casos.js';
import { crearCasosCriterios } from '../criterios.casos.js';
import { crearCasosActivos } from '../activos.casos.js';
import { crearCasosDocumentales } from '../documentos.casos.js';
import type { OpcionesCertificacionApi } from '../certificacion-api.module.js';

export const opcionesDePrueba = (p: { estado: EstadoFalso; almacen: AlmacenArchivosPort; reloj?: () => Date }): OpcionesCertificacionApi => {
  const autorizacion = crearAutorizacionFalsa(p.estado);
  const catalogo = crearCatalogoFalso(p.estado);
  const unidad = crearUnidadFalsa(p.estado);
  const reloj = p.reloj ?? (() => new Date('2026-11-10T12:00:00Z'));
  const nuevoId = () => crypto.randomUUID();
  return {
    alcances: new ListarAlcancesUseCase(unidad, autorizacion, catalogo),
    guardarAlcance: new GuardarAlcanceUseCase(unidad, autorizacion, catalogo, reloj),
    aprobarAlcance: new AprobarAlcanceUseCase(unidad, autorizacion, catalogo, reloj),
    diagnostico: new ListarDiagnosticoUseCase(unidad, autorizacion, catalogo),
    evaluar: new EvaluarEntradaUseCase(unidad, autorizacion, catalogo, reloj),
    listarControles: new ListarControlesUseCase(unidad, autorizacion, catalogo),
    crearControl: new CrearControlUseCase(unidad, autorizacion, reloj, nuevoId),
    cambiarControl: new CambiarControlUseCase(unidad, autorizacion, reloj),
    retirarControl: new RetirarControlUseCase(unidad, autorizacion, reloj),
    agregarMapeo: new AgregarMapeoUseCase(unidad, autorizacion, catalogo, reloj),
    quitarMapeo: new QuitarMapeoUseCase(unidad, autorizacion),
    listarEvidencias: new ListarEvidenciasUseCase(unidad, autorizacion, reloj),
    subirEvidencia: new SubirEvidenciaUseCase(unidad, autorizacion, p.almacen, reloj, nuevoId),
    reemplazarEvidencia: new ReemplazarEvidenciaUseCase(unidad, autorizacion, p.almacen, reloj, nuevoId),
    eliminarEvidencia: new EliminarEvidenciaUseCase(unidad, autorizacion, reloj),
    descargarEvidencia: new DescargarEvidenciaUseCase(unidad, autorizacion, p.almacen),
    cobertura: new ListarCoberturaUseCase(unidad, autorizacion, catalogo, reloj),
    declaracion: new ObtenerDeclaracionUseCase(unidad, autorizacion, catalogo, reloj),
    aprobarDeclaracion: new AprobarDeclaracionUseCase(unidad, autorizacion, catalogo, reloj, nuevoId),
    versionesDeclaracion: new ListarVersionesDeclaracionUseCase(unidad, autorizacion),
    versionDeclaracion: new ObtenerVersionDeclaracionUseCase(unidad, autorizacion),
    // El generador es el real (en memoria): así las pruebas de la API comprueban un Word de verdad.
    exportarDeclaracion: new ExportarDeclaracionUseCase(unidad, autorizacion, catalogo, new GeneradorDocumentoDocx(), reloj),
    listarRiesgos: new ListarRiesgosUseCase(unidad, autorizacion),
    crearRiesgo: new CrearRiesgoUseCase(unidad, autorizacion, reloj, nuevoId),
    obtenerRiesgo: new ObtenerRiesgoUseCase(unidad, autorizacion, catalogo),
    cambiarRiesgo: new CambiarRiesgoUseCase(unidad, autorizacion, reloj),
    avisarRetiroRiesgo: new AvisoRetiroRiesgoUseCase(unidad, autorizacion, catalogo),
    retirarRiesgo: new RetirarRiesgoUseCase(unidad, autorizacion, reloj),
    vincularRiesgoControl: new VincularRiesgoControlUseCase(unidad, autorizacion, reloj),
    desvincularRiesgoControl: new DesvincularRiesgoControlUseCase(unidad, autorizacion),
    preverTratamiento: new PreverTratamientoUseCase(unidad, autorizacion, catalogo, reloj),
    quitarTratamientoPrevisto: new QuitarTratamientoPrevistoUseCase(unidad, autorizacion),
    riesgosDeControl: new RiesgosDeUnControlUseCase(unidad, autorizacion),
    listarMotivos: new ListarMotivosUseCase(unidad, autorizacion),
    registrarMotivo: new RegistrarMotivoUseCase(unidad, autorizacion, catalogo, reloj),
    quitarMotivo: new QuitarMotivoUseCase(unidad, autorizacion),
    listarReferencias: new ListarReferenciasUseCase(unidad, autorizacion),
    guardarReferencia: new GuardarReferenciaUseCase(unidad, autorizacion, reloj),
    quitarReferencia: new QuitarReferenciaUseCase(unidad, autorizacion),
    documentos: crearCasosDocumentales(unidad, autorizacion, catalogo, p.almacen, reloj, nuevoId),
    activos: crearCasosActivos(unidad, autorizacion, reloj, nuevoId),
    criterios: crearCasosCriterios(unidad, autorizacion, reloj),
    auditoria: crearCasosAuditoria(unidad, autorizacion, catalogo, reloj, nuevoId, (texto) => sha256Hex(new TextEncoder().encode(texto)), new GeneradorDocumentoDocx()),
  };
};
