import { HttpException } from '@nestjs/common';

/** Demasiadas solicitudes: responde 429 con `Retry-After` (segundos, entero, mínimo 1). No lleva datos de quien la provocó. */
export class LimiteExcedidoException extends HttpException {
  constructor(readonly reintentarEnSegundos: number) {
    super('Límite de solicitudes excedido', 429);
  }
}
