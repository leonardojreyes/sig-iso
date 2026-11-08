import { SetMetadata } from '@nestjs/common';

export const PUBLICO = Symbol('PUBLICO');

/** Marca una ruta (o un controlador) como pública. TODO lo demás exige un token verificado: cerrado por omisión. */
export const Publico = (): MethodDecorator & ClassDecorator => SetMetadata(PUBLICO, true);
