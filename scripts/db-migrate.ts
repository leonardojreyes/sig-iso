// pnpm db:migrate — aplica las migraciones SQL de platform/db/migrations con el rol dueño.
// `--prueba` migra la base de pruebas (DATABASE_URL_TEST); sin la opción, la base de desarrollo (DATABASE_URL_OWNER).
import { GestorPools, leerUrls, migrarAlUltimo } from '@sig/db';

const prueba = process.argv.includes('--prueba');
const pools = new GestorPools(leerUrls(process.env, ['owner'], { prueba }), { max: 2 });
try {
  const { aplicadas } = await migrarAlUltimo(pools.db('owner'));
  const base = prueba ? 'sigiso_test' : 'sigiso';
  console.log(aplicadas.length ? `Migraciones aplicadas en ${base}: ${aplicadas.join(', ')}` : `Sin migraciones pendientes en ${base}.`);
} catch (error) {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await pools.cerrar();
}
