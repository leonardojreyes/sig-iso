// API pública de @sig/normas-schema: esquema v2 de las librerías de normas y su validador (ADR 026).
export {
  validarLibreria,
  type AlcanceComun,
  type CodigoError,
  type CorrespondenciaNorma,
  type EntradaLibreria,
  type ErrorLibreria,
  type Libreria,
  type ReferenciaNorma,
  type ResultadoValidacion,
} from './validar';
export {
  contarFrases,
  detectarTextoNormativo,
  LIMITES,
  revisarContenido,
  revisarRespuestaIa,
  revisarTexto,
  type CampoTexto,
  type CodigoContenido,
  type CodigoTextoNormativo,
  type EntradaTextual,
  type HallazgoContenido,
} from './contenido';
