import { crearDependencias, registrarEnServidor } from '../../../src/auth/dependencias';
import { crearManejadorLogout } from '../../../src/auth/manejadores';

// Cerrar sesión cambia estado: solo POST (con verificación de Origin). Un GET responde 405.
export const dynamic = 'force-dynamic';
const manejador = crearManejadorLogout(() => crearDependencias(process.env), registrarEnServidor);
export const POST = manejador;
export const GET = manejador;
