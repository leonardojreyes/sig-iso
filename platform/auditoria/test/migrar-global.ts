// Se ejecuta una vez antes de las pruebas: deja migrada la base de pruebas para las de integración (ver @sig/db/pruebas).
import { prepararBaseDePruebas } from '@sig/db/pruebas';
import type { TestProject } from 'vitest/node';

export default async function preparar(project: TestProject): Promise<void> {
  await prepararBaseDePruebas({ ...process.env, ...project.config.env });
}
