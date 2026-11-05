// Se ejecuta una vez antes de las pruebas: deja migrada la base de pruebas (sigiso_test) para las de integración.
// Sin URLs en el entorno (por ejemplo, un CI sin PostgreSQL) no hace nada y las pruebas de integración se omiten.
import type { TestProject } from 'vitest/node';
import { GestorPools, leerUrls, migrarAlUltimo } from '../src/index';

export default async function preparar(project: TestProject): Promise<void> {
  const env = { ...process.env, ...project.config.env };
  if (!env.DATABASE_URL_OWNER || !env.DATABASE_URL_TEST) return;
  const pools = new GestorPools(leerUrls(env, ['owner'], { prueba: true }), { max: 2 });
  try {
    await migrarAlUltimo(pools.db('owner'));
  } finally {
    await pools.cerrar();
  }
}
