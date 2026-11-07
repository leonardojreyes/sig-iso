// Ayudas para las PRUEBAS DE INTEGRACIÓN de cualquier paquete que use la base de datos. No forma parte de la API de la aplicación.
import { leerUrls } from './configuracion';
import { migrarAlUltimo } from './migraciones';
import { GestorPools } from './pools';
import { hayBaseDePruebas } from './pruebas-env';

export { cargarUrlsDePrueba, hayBaseDePruebas } from './pruebas-env';

/** Deja migrada la base de pruebas (sigiso_test). Sin base configurada no hace nada. */
export const prepararBaseDePruebas = async (env: Readonly<Record<string, string | undefined>>): Promise<void> => {
  if (!hayBaseDePruebas(env)) return;
  const pools = new GestorPools(leerUrls(env, ['owner'], { prueba: true }), { max: 2 });
  try {
    await migrarAlUltimo(pools.db('owner'));
  } finally {
    await pools.cerrar();
  }
};
