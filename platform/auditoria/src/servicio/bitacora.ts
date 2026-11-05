import { validarEvento } from '../dominio/validacion';
import type { EventoBitacora } from '../dominio/tipos';
import type { BitacoraPort } from '../puertos/bitacora.port';

/** Punto único para registrar hechos: valida SIEMPRE contra el catálogo antes de llegar al puerto. */
export class Bitacora {
  constructor(private readonly puerto: BitacoraPort) {}

  async registrar(evento: EventoBitacora): Promise<void> {
    await this.puerto.registrar(validarEvento(evento));
  }
}
