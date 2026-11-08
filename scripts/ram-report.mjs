// pnpm ram:report — memoria (RSS) de PostgreSQL, Keycloak, OpenFGA, API y web, frente al presupuesto de ~4 GB (ADR 007).
// Opciones: --json (salida para máquinas) y --presupuesto-gb <n>. Solo Node; funciona igual en macOS, Linux y Windows.
import { totalmem } from 'node:os';
import { agregar, formatear, leerArgumentos, listarProcesos, puertosEnEscucha, resumir } from './lib/ram-report.mjs';

try {
  const { json, presupuestoMb } = leerArgumentos(process.argv.slice(2));
  const [procesos, puertos] = await Promise.all([listarProcesos(), puertosEnEscucha()]);
  const resumen = resumir(agregar(procesos, puertos), { presupuestoMb, totalEquipoMb: totalmem() / (1024 * 1024) });
  console.log(json ? JSON.stringify(resumen, null, 2) : formatear(resumen));
} catch (error) {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
