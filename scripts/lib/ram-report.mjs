// Informe de memoria de la pila de desarrollo (PostgreSQL, Keycloak, OpenFGA, API y web). Solo Node: funciona igual en macOS,
// Linux y Windows. Lee los procesos con `ps` (macOS/Linux) o PowerShell (Windows) usando `execFile` con argumentos fijos.
//
// PRIVACIDAD: las líneas de comando pueden llevar contraseñas. Se usan SOLO para clasificar; nunca se imprimen ni se guardan
// en el resultado.
//
// LÍMITE: por defecto se mide RSS (memoria residente). La memoria compartida entre procesos (por ejemplo, PostgreSQL) se cuenta
// más de una vez, así que el total es una cota superior. En macOS el RSS SUBESTIMA los procesos inactivos (el sistema comprime
// su memoria: una JVM de ~430 MB aparece con ~10 MB), así que allí se usa `footprint` (phys_footprint, incluye la comprimida).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const ejecutar = promisify(execFile);

export const PUERTO_API = 3001;
export const PUERTO_WEB = 3000;

const binario = (nombre) => new RegExp(`(^|[/\\\\])${nombre}(\\.exe)?["']?(:|\\s|$)`, 'i');
const ES_POSTGRES = binario('postgres');
const ES_JAVA = binario('java');
const ES_OPENFGA = binario('openfga');
const ES_NODE = binario('(?:node|tsx|bun|deno)');
const PIDE_KEYCLOAK = /keycloak|quarkus-run/i;
const DE_LA_API = /apps[/\\]api|@sig\/api/i;
const DE_LA_WEB = /apps[/\\]web|@sig\/web|next-server|node_modules[/\\]next[/\\]/i;

/** Componentes de la pila, en el orden en que se muestran. */
export const COMPONENTES = [
  { id: 'postgresql', nombre: 'PostgreSQL' },
  { id: 'keycloak', nombre: 'Keycloak (JVM)' },
  { id: 'openfga', nombre: 'OpenFGA' },
  { id: 'api', nombre: 'API (NestJS)' },
  { id: 'web', nombre: 'Web (Next.js)' },
];

/** A qué componente de la pila pertenece un proceso por sí mismo (no por sus antecesores), o `null`. */
export const clasificar = ({ comando }, puertos = []) => {
  if (ES_POSTGRES.test(comando)) return 'postgresql';
  if (ES_JAVA.test(comando) && PIDE_KEYCLOAK.test(comando)) return 'keycloak';
  if (ES_OPENFGA.test(comando)) return 'openfga';
  if (DE_LA_API.test(comando)) return 'api';
  if (DE_LA_WEB.test(comando)) return 'web';
  if (ES_NODE.test(comando)) {
    if (puertos.includes(PUERTO_API)) return 'api';
    if (puertos.includes(PUERTO_WEB)) return 'web';
  }
  return null;
};

/** `ps -axo pid=,ppid=,rss=,command=` (macOS y Linux). */
export const parsearPs = (salida) => {
  const procesos = [];
  for (const linea of salida.split(/\r?\n/)) {
    const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*\S)\s*$/.exec(linea);
    if (m) procesos.push({ pid: Number(m[1]), ppid: Number(m[2]), rssKb: Number(m[3]), comando: m[4] });
  }
  return procesos;
};

const comoLista = (texto) => {
  try {
    const dato = JSON.parse(texto);
    if (Array.isArray(dato)) return dato;
    return dato !== null && typeof dato === 'object' ? [dato] : [];
  } catch {
    return [];
  }
};

/** `Get-CimInstance Win32_Process | ConvertTo-Json` (Windows). La memoria de trabajo llega en bytes. */
export const parsearWindows = (json) =>
  comoLista(json)
    .filter((p) => p && Number.isInteger(p.ProcessId))
    .map((p) => ({
      pid: p.ProcessId,
      ppid: Number.isInteger(p.ParentProcessId) ? p.ParentProcessId : 0,
      rssKb: typeof p.WorkingSetSize === 'number' ? Math.round(p.WorkingSetSize / 1024) : 0,
      comando: typeof p.CommandLine === 'string' && p.CommandLine ? p.CommandLine : String(p.Name ?? ''),
    }));

const agregarPuerto = (mapa, pid, puerto) => {
  if (!Number.isInteger(pid) || !Number.isInteger(puerto)) return;
  const lista = mapa.get(pid) ?? [];
  if (!lista.includes(puerto)) lista.push(puerto);
  mapa.set(pid, lista);
};

/** `lsof -nP -iTCP -sTCP:LISTEN -Fpn`: líneas `p<pid>` seguidas de `n<dirección:puerto>`. */
export const parsearLsof = (salida) => {
  const mapa = new Map();
  let pid = null;
  for (const linea of salida.split(/\r?\n/)) {
    if (linea.startsWith('p')) pid = Number(linea.slice(1));
    else if (linea.startsWith('n') && pid !== null) {
      const m = /:(\d+)$/.exec(linea);
      if (m) agregarPuerto(mapa, pid, Number(m[1]));
    }
  }
  return mapa;
};

/** `Get-NetTCPConnection -State Listen | Select OwningProcess,LocalPort | ConvertTo-Json` (Windows). */
export const parsearPuertosWindows = (json) => {
  const mapa = new Map();
  for (const f of comoLista(json)) if (f) agregarPuerto(mapa, f.OwningProcess, f.LocalPort);
  return mapa;
};

const OPCIONES = { maxBuffer: 64 * 1024 * 1024, timeout: 20_000, windowsHide: true };
const POWERSHELL = (orden) => ['-NoProfile', '-NonInteractive', '-Command', orden];

/** Procesos reales del sistema: `{ pid, ppid, rssKb, comando }`. */
export const listarProcesos = async () => {
  if (process.platform === 'win32') {
    const { stdout } = await ejecutar('powershell.exe', POWERSHELL('Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,WorkingSetSize,CommandLine | ConvertTo-Json -Compress'), OPCIONES);
    return parsearWindows(stdout);
  }
  const { stdout } = await ejecutar('ps', ['-axo', 'pid=,ppid=,rss=,command='], OPCIONES);
  return parsearPs(stdout);
};

/** Puertos en escucha por proceso. Si no se pueden leer (sin `lsof`, sin permisos) devuelve un mapa vacío: se clasifica solo por comando. */
export const puertosEnEscucha = async () => {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await ejecutar('powershell.exe', POWERSHELL('Get-NetTCPConnection -State Listen | Select-Object OwningProcess,LocalPort | ConvertTo-Json -Compress'), OPCIONES);
      return parsearPuertosWindows(stdout);
    }
    const { stdout } = await ejecutar('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpn'], OPCIONES);
    return parsearLsof(stdout);
  } catch {
    return new Map();
  }
};

/** Componente de cada proceso: el propio o el del antecesor más cercano que lo tenga. Devuelve `Map<pid, componente>` solo con los de la pila. */
const componentesPorPid = (procesos, puertos) => {
  const porPid = new Map(procesos.map((p) => [p.pid, p]));
  const propio = new Map(procesos.map((p) => [p.pid, clasificar(p, puertos.get(p.pid) ?? [])]));
  const resultado = new Map();
  for (const p of procesos) {
    let actual = p;
    let componente = null;
    const vistos = new Set();
    while (actual && !vistos.has(actual.pid)) {
      vistos.add(actual.pid);
      componente = propio.get(actual.pid) ?? null;
      if (componente) break;
      actual = porPid.get(actual.ppid);
    }
    if (componente) resultado.set(p.pid, componente);
  }
  return resultado;
};

/** Identificadores de los procesos que pertenecen a la pila. */
export const pidsDeLaPila = (procesos, puertos) => [...componentesPorPid(procesos, puertos).keys()];

/** Suma la memoria por componente. Cada proceso cuenta una sola vez: para el componente propio o el del antecesor más cercano que lo tenga. */
export const agregar = (procesos, puertos) => {
  const total = Object.fromEntries(COMPONENTES.map((c) => [c.id, { procesos: 0, rssKb: 0 }]));
  const porPid = new Map(procesos.map((p) => [p.pid, p]));
  for (const [pid, componente] of componentesPorPid(procesos, puertos)) {
    total[componente].procesos += 1;
    total[componente].rssKb += porPid.get(pid).rssKb;
  }
  return total;
};

/** Extrae `phys_footprint` (en KB) de la salida de `footprint -p <pid>`; `null` si no aparece o la unidad no se reconoce. */
export const parsearHuella = (salida) => {
  const m = /phys_footprint:\s+([\d.]+)\s*(B|KB|MB|GB)\b/.exec(salida);
  if (!m) return null;
  const factor = { B: 1 / 1024, KB: 1, MB: 1024, GB: 1024 * 1024 }[m[2]];
  return Math.round(Number(m[1]) * factor);
};

/** Huella real (KB) por pid con `footprint` de macOS; vacío en otras plataformas o si el pid no se puede leer (sin permisos, ya terminó). */
export const medirHuellas = async (pids) => {
  const huellas = new Map();
  if (process.platform !== 'darwin') return huellas;
  const LOTE = 8;
  for (let i = 0; i < pids.length; i += LOTE) {
    await Promise.all(
      pids.slice(i, i + LOTE).map(async (pid) => {
        try {
          const { stdout } = await ejecutar('footprint', ['-p', String(pid)], OPCIONES);
          const kb = parsearHuella(stdout);
          if (kb !== null) huellas.set(pid, kb);
        } catch {
          /* se conserva el RSS de ese proceso */
        }
      }),
    );
  }
  return huellas;
};

/** Sustituye el RSS por la huella medida donde exista. */
export const conHuella = (procesos, huellas) => procesos.map((p) => (huellas.has(p.pid) ? { ...p, rssKb: huellas.get(p.pid) } : p));

/** Resumen listo para mostrar: MB por componente, total y estado frente al presupuesto (`cerca` desde el 90 %). */
export const resumir = (agregado, { presupuestoMb, totalEquipoMb, metrica = 'rss' }) => {
  const componentes = COMPONENTES.map(({ id, nombre }) => ({
    id,
    nombre,
    procesos: agregado[id].procesos,
    mb: agregado[id].rssKb / 1024,
    enEjecucion: agregado[id].procesos > 0,
  }));
  const totalMb = componentes.reduce((s, c) => s + c.mb, 0);
  const porcentajePresupuesto = (totalMb / presupuestoMb) * 100;
  const estado = totalMb > presupuestoMb ? 'excedido' : totalMb >= presupuestoMb * 0.9 ? 'cerca' : 'dentro';
  return { componentes, totalMb, presupuestoMb, porcentajePresupuesto, estado, totalEquipoMb, metrica };
};

const MENSAJE = {
  dentro: 'dentro del presupuesto',
  cerca: 'cerca del presupuesto (desde el 90 %)',
  excedido: 'EXCEDE el presupuesto',
};

export const formatear = (r) => {
  const ancho = Math.max(...r.componentes.map((c) => c.nombre.length));
  const filas = r.componentes.map((c) =>
    c.enEjecucion ? `${c.nombre.padEnd(ancho)}  ${String(c.procesos).padStart(8)}  ${c.mb.toFixed(1).padStart(9)}` : `${c.nombre.padEnd(ancho)}  no está en ejecución`,
  );
  return [
    `Memoria de la pila de desarrollo (${r.metrica === 'huella' ? 'huella real, macOS' : 'RSS'})`,
    `${'Componente'.padEnd(ancho)}  ${'Procesos'.padStart(8)}  ${'MB'.padStart(9)}`,
    ...filas,
    `${'Total'.padEnd(ancho)}  ${r.totalMb.toFixed(1)} MB de ${r.presupuestoMb} MB (${r.porcentajePresupuesto.toFixed(1)} %): ${MENSAJE[r.estado]}`,
    `Memoria del equipo: ${(r.totalEquipoMb / 1024).toFixed(1)} GB`,
    r.metrica === 'huella'
      ? 'Nota: huella real de macOS (phys_footprint), incluye la memoria comprimida; los procesos sin permiso de lectura usan RSS.'
      : 'Nota: RSS cuenta varias veces la memoria compartida entre procesos; el total es una cota superior.',
  ].join('\n');
};

/** Argumentos: `--json` y `--presupuesto-gb <n>` (o `=n`), entre 0 y 512 GB. */
export const leerArgumentos = (argv) => {
  let json = false;
  let gb = 4;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') json = true;
    else if (a === '--presupuesto-gb' || a.startsWith('--presupuesto-gb=')) {
      const valor = a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[++i];
      const n = Number(valor);
      if (valor === undefined || valor === '' || !Number.isFinite(n) || n <= 0 || n > 512) throw new Error('--presupuesto-gb debe ser un número entre 0 y 512');
      gb = n;
    } else throw new Error(`Argumento no reconocido: ${a}`);
  }
  return { json, presupuestoMb: Math.round(gb * 1024) };
};
