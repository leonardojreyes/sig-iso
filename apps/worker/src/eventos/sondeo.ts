// Sondeo de intentos fallidos de ingreso (H6.2): lee eventos de Keycloak desde el punto de control y los registra
// en la bitácora mediante el caso de uso RegistrarIntentoFallido (idempotente). Excepción temporal a la cola Valkey (ADR 025).
import {
  EventoIdentidadInvalidoError,
  type ResultadoIntento,
} from "@sig/auditoria";
import type { EventoKeycloak } from "./proyeccion";
import type { PuntoControlPort } from "./punto-control";

export interface AvisosSondeoPort {
  /** El último punto de control es más viejo que la retención de eventos de Keycloak: pudieron perderse eventos. */
  huecoDetectado(info: { ultimoPunto: number; ahora: number }): Promise<void>;
}

export interface DependenciasSondeo {
  readonly cliente: {
    obtenerIntentosFallidos(desde: Date): Promise<EventoKeycloak[]>;
  };
  readonly registrar: { ejecutar(evento: unknown): Promise<ResultadoIntento> };
  readonly puntoControl: PuntoControlPort;
  readonly avisos: AvisosSondeoPort;
  readonly ahora: () => Date;
  readonly solapeMs?: number;
  readonly retencionMs?: number;
  readonly ventanaInicialMs?: number;
}

export interface ResumenSondeo {
  readonly leidos: number;
  readonly registrados: number;
  readonly yaExistian: number;
  readonly ignorados: number;
  readonly invalidos: number;
  readonly hueco: boolean;
  readonly puntoControl: number | null;
}

const MIN = 60_000;
const DIA = 24 * 60 * MIN;

export const sondearIntentos = async (
  d: DependenciasSondeo,
): Promise<ResumenSondeo> => {
  const solape = d.solapeMs ?? 2 * MIN;
  const retencion = d.retencionMs ?? 7 * DIA;
  const ventana = d.ventanaInicialMs ?? DIA;
  const ahora = d.ahora().getTime();
  const previo = await d.puntoControl.leer();

  let hueco = false;
  let desde: number;
  if (previo === null) {
    desde = ahora - ventana;
  } else if (ahora - previo > retencion) {
    hueco = true;
    desde = ahora - retencion;
    try {
      await d.avisos.huecoDetectado({ ultimoPunto: previo, ahora });
    } catch {
      // un canal de avisos caído no debe impedir recuperar lo que Keycloak aún conserva
    }
  } else {
    desde = previo - solape;
  }

  const eventos = [
    ...(await d.cliente.obtenerIntentosFallidos(new Date(desde))),
  ].sort((a, b) => a.time - b.time);
  let registrados = 0;
  let yaExistian = 0;
  let ignorados = 0;
  let invalidos = 0;
  let punto = previo;
  const avanzar = async (hasta: number): Promise<void> => {
    if (punto === null || hasta > punto) {
      punto = hasta;
      await d.puntoControl.guardar(hasta);
    }
  };

  let ultimoProcesado: number | null = null;
  try {
    for (const evento of eventos) {
      try {
        const r = await d.registrar.ejecutar(evento);
        if (r === "registrado") registrados += 1;
        else if (r === "ya_existia") yaExistian += 1;
        else ignorados += 1;
      } catch (error) {
        if (!(error instanceof EventoIdentidadInvalidoError)) throw error;
        invalidos += 1;
      }
      ultimoProcesado = evento.time;
    }
  } finally {
    // Pase lo que pase se conserva lo ya procesado: un error transitorio no repite ni pierde trabajo.
    if (ultimoProcesado !== null) await avanzar(ultimoProcesado);
  }
  return {
    leidos: eventos.length,
    registrados,
    yaExistian,
    ignorados,
    invalidos,
    hueco,
    puntoControl: punto,
  };
};
