import { crearDependencias, registrarEnServidor } from '../../../src/auth/dependencias';
import { crearManejadorSesion } from '../../../src/auth/manejadores';

export const dynamic = 'force-dynamic';
export const GET = crearManejadorSesion(() => crearDependencias(process.env), registrarEnServidor);
