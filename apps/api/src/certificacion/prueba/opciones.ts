// Casos de uso reales armados con los fakes que separan los datos por empresa, para las pruebas de la API de certificación.
import {
  AgregarMapeoUseCase, AprobarAlcanceUseCase, CambiarControlUseCase, CrearControlUseCase, DescargarEvidenciaUseCase, EliminarEvidenciaUseCase, EvaluarEntradaUseCase, GuardarAlcanceUseCase,
  ListarAlcancesUseCase, ListarControlesUseCase, ListarCoberturaUseCase, ListarDiagnosticoUseCase, ListarEvidenciasUseCase, QuitarMapeoUseCase, ReemplazarEvidenciaUseCase, RetirarControlUseCase,
  SubirEvidenciaUseCase, type AlmacenArchivosPort,
} from '@sig/certificacion';
import { crearAutorizacionFalsa, crearCatalogoFalso, crearUnidadFalsa, type EstadoFalso } from '@sig/certificacion/prueba';
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
  };
};
