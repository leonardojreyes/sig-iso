// pnpm ram:report — memoria (RSS) de PostgreSQL, Keycloak, OpenFGA, API y web, frente al presupuesto de ~4 GB (ADR 007).
// Opciones: --json (salida para máquinas) y --presupuesto-gb <n>. Solo Node; funciona igual en macOS, Linux y Windows.
import { totalmem } from 'node:os';
import { agregar, conHuella, formatear, leerArgumentos, listarProcesos, medirHuellas, pidsDeLaPila, puertosEnEscucha, resumir } from './lib/ram-report.mjs';

try {
  const { json, presupuestoMb } = leerArgumentos(process.argv.slice(2));
  const [lista, puertos] = await Promise.all([listarProcesos(), puertosEnEscucha()]);
  // En macOS el RSS subestima los procesos inactivos (memoria comprimida): se mide la huella real con `footprint`.
  const huellas = await medirHuellas(pidsDeLaPila(lista, puertos));
  const procesos = conHuella(lista, huellas);
  const metrica = huellas.size > 0 ? 'huella' : 'rss';
  const resumen = resumir(agregar(procesos, puertos), { presupuestoMb, totalEquipoMb: totalmem() / (1024 * 1024), metrica });
  console.log(json ? JSON.stringify(resumen, null, 2) : formatear(resumen));
} catch (error) {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
