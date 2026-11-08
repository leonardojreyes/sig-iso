import { crearDependencias, registrarEnServidor } from '../../../src/auth/dependencias';
import { crearManejadorCallback } from '../../../src/auth/manejadores';

export const dynamic = 'force-dynamic';
export const GET = crearManejadorCallback(() => crearDependencias(process.env), registrarEnServidor);
