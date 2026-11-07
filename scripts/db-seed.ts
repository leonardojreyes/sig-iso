// pnpm db:seed — siembra las dos empresas de prueba (A y B) con su administrador SIG y su colaborador. Idempotente.
// `--prueba` siembra la base de pruebas (DATABASE_URL_TEST); sin la opción, la de desarrollo. Solo corre contra una base local.
import { GestorPools, leerUrls } from '@sig/db';
import { DATOS_SIEMBRA, exigirBaseLocal } from './lib/datos-siembra.js';
import { sembrar } from './lib/siembra.js';

const prueba = process.argv.includes('--prueba');
let pools: GestorPools | undefined;
try {
  const urls = leerUrls(process.env, ['owner', 'app', 'plataforma'], { prueba });
  exigirBaseLocal(urls.owner!, process.env);
  pools = new GestorPools(urls, { max: 3 });
  const r = await sembrar({ owner: pools.db('owner'), app: pools.db('app'), plataforma: pools.db('plataforma') }, DATOS_SIEMBRA, 'siembra:datos-iniciales:v1');
  const base = prueba ? 'sigiso_test' : 'sigiso';
  console.log(
    r.empresasNuevas + r.usuariosNuevos === 0
      ? `Datos de prueba ya sembrados en ${base}: sin cambios.`
      : `Sembrado en ${base}: ${r.empresasNuevas} empresa(s) y ${r.usuariosNuevos} persona(s) nuevas.`,
  );
  console.log('\nCuentas de prueba (las contraseñas las genera keycloak-dev; los roles se aplican en OpenFGA):');
  for (const u of DATOS_SIEMBRA.usuarios) {
    const e = DATOS_SIEMBRA.empresas.find((x) => x.id === u.empresaId)!;
    console.log(`  ${u.alias.padEnd(8)} ${u.correo.padEnd(24)} ${e.slug.padEnd(10)} ${u.rol}`);
  }
} catch (error) {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await pools?.cerrar();
}
