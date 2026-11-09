// Cliente de la API de administración de Keycloak para leer eventos de usuario LOGIN_ERROR (ADR 025/027).
// Usa la cuenta de servicio `sigiso-events` (solo view-events). Devuelve únicamente la lista blanca de campos.
import { type EventoKeycloak, proyectarEvento } from "./proyeccion";

export class ErrorClienteEventos extends Error {
  constructor(readonly codigo: string) {
    super(`Error del cliente de eventos de Keycloak: ${codigo}`);
    this.name = "ErrorClienteEventos";
  }
}

export interface OpcionesClienteEventos {
  readonly baseUrl: string;
  readonly realm: string;
  readonly clienteId: string;
  readonly clienteSecreto: string;
  readonly fetchFn?: typeof fetch;
  readonly tamanoPagina?: number;
  readonly maxPaginas?: number;
  readonly ahora?: () => Date;
}

const MARGEN_TOKEN_MS = 30_000;
const ESPERA_MAXIMA_MS = 10_000;

const invalida = (motivo: string): never => {
  throw new Error(`Configuración inválida del cliente de eventos: ${motivo}`);
};

export class ClienteEventosKeycloak {
  private readonly base: string;
  private readonly realm: string;
  private readonly clienteId: string;
  private readonly clienteSecreto: string;
  private readonly fetchFn: typeof fetch;
  private readonly tamanoPagina: number;
  private readonly maxPaginas: number;
  private readonly ahora: () => Date;
  private token: { valor: string; vence: number } | null = null;

  constructor(o: OpcionesClienteEventos) {
    let url: URL | undefined;
    try {
      url = new URL(o.baseUrl);
    } catch {
      invalida("dirección");
    }
    if (
      url === undefined ||
      (url.protocol !== "http:" && url.protocol !== "https:")
    )
      invalida("dirección");
    if (
      url!.username !== "" ||
      url!.password !== "" ||
      url!.search !== "" ||
      url!.hash !== ""
    )
      invalida("dirección");
    if (!/^[A-Za-z0-9_-]+$/.test(o.realm)) invalida("realm");
    if (o.clienteId === "") invalida("cuenta de servicio");
    if (o.clienteSecreto === "") invalida("secreto");
    this.base = `${url!.origin}${url!.pathname.replace(/\/+$/, "")}`;
    this.realm = o.realm;
    this.clienteId = o.clienteId;
    this.clienteSecreto = o.clienteSecreto;
    this.fetchFn = o.fetchFn ?? fetch;
    this.tamanoPagina = o.tamanoPagina ?? 100;
    this.maxPaginas = o.maxPaginas ?? 50;
    this.ahora = o.ahora ?? (() => new Date());
  }

  async obtenerIntentosFallidos(desde: Date): Promise<EventoKeycloak[]> {
    const dia = desde.toISOString().slice(0, 10);
    const todos: EventoKeycloak[] = [];
    for (let pagina = 0; ; pagina += 1) {
      if (pagina >= this.maxPaginas)
        throw new ErrorClienteEventos("demasiadas_paginas");
      const filas = await this.pedirPagina(dia, pagina * this.tamanoPagina);
      for (const fila of filas) {
        const evento = proyectarEvento(fila);
        if (evento !== null && evento.time >= desde.getTime())
          todos.push(evento);
      }
      if (filas.length < this.tamanoPagina) break;
    }
    return todos.sort((a, b) => a.time - b.time);
  }

  private async llamar(url: string, init: RequestInit): Promise<Response> {
    try {
      return await this.fetchFn(url, {
        ...init,
        signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
      });
    } catch {
      throw new ErrorClienteEventos("red");
    }
  }

  private async pedirPagina(dia: string, primero: number): Promise<unknown[]> {
    const consulta = new URLSearchParams({
      type: "LOGIN_ERROR",
      dateFrom: dia,
      first: String(primero),
      max: String(this.tamanoPagina),
    });
    const url = `${this.base}/admin/realms/${this.realm}/events?${consulta.toString()}`;
    for (let intento = 0; intento < 2; intento += 1) {
      const token = await this.obtenerToken();
      const r = await this.llamar(url, {
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/json",
        },
      });
      if (r.status === 401 && intento === 0) {
        this.token = null;
        continue;
      }
      if (!r.ok) throw new ErrorClienteEventos(`http_${r.status}`);
      let cuerpo: unknown;
      try {
        cuerpo = await r.json();
      } catch {
        throw new ErrorClienteEventos("respuesta_invalida");
      }
      if (!Array.isArray(cuerpo))
        throw new ErrorClienteEventos("respuesta_invalida");
      return cuerpo;
    }
    throw new ErrorClienteEventos("http_401");
  }

  private async obtenerToken(): Promise<string> {
    const ahora = this.ahora().getTime();
    if (this.token !== null && ahora < this.token.vence - MARGEN_TOKEN_MS)
      return this.token.valor;
    const r = await this.llamar(
      `${this.base}/realms/${this.realm}/protocol/openid-connect/token`,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.clienteId,
          client_secret: this.clienteSecreto,
        }).toString(),
      },
    );
    if (!r.ok) throw new ErrorClienteEventos(`token_http_${r.status}`);
    let c: unknown;
    try {
      c = await r.json();
    } catch {
      throw new ErrorClienteEventos("token_invalido");
    }
    const t = c as { access_token?: unknown; expires_in?: unknown } | null;
    if (
      !t ||
      typeof t.access_token !== "string" ||
      t.access_token === "" ||
      typeof t.expires_in !== "number" ||
      !Number.isFinite(t.expires_in) ||
      t.expires_in <= 0
    ) {
      throw new ErrorClienteEventos("token_invalido");
    }
    this.token = { valor: t.access_token, vence: ahora + t.expires_in * 1000 };
    return t.access_token;
  }
}
