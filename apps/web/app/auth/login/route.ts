import { crearDependencias, registrarEnServidor } from '../../../src/auth/dependencias';
import { crearManejadorLogin } from '../../../src/auth/manejadores';

// Siempre dinámica: cada ingreso lleva su propio state, nonce y verificador.
export const dynamic = 'force-dynamic';
export const GET = crearManejadorLogin(() => crearDependencias(process.env), registrarEnServidor);
