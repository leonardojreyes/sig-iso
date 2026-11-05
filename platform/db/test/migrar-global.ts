// Se ejecuta una vez antes de las pruebas: deja migrada la base de pruebas (sigiso_test) para las de integración.
// Sin URLs en el entorno (por ejemplo, un CI sin PostgreSQL) no hace nada y las pruebas de integración se omiten.
import type { TestProject } from 'vitest/node';
import { prepararBaseDePruebas } from '../src/pruebas';

export default async function preparar(project: TestProject): Promise<void> {
  await prepararBaseDePruebas({ ...process.env, ...project.config.env });
}
