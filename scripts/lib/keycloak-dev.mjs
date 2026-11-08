// Instalación local de Keycloak y de su JRE (ADR 025). Solo Node; igual en macOS, Windows y Linux.
// Todo archivo descargado se verifica contra una huella SHA-256 fijada en este repositorio ANTES de extraerse.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const MB = 1024 * 1024;

export const KEYCLOAK = Object.freeze({
  nombre: 'Keycloak 26.8.2',
  version: '26.8.2',
  // Huella publicada por GitHub para el zip; cruzada con la .sha1 publicada por Keycloak (ADR 025).
  sha256: '321ffee62ec28fab18fe885d8cd62cc814edce72a35cd062dc81b504c1a406b3',
  bytes: 173_780_410,
  url: 'https://github.com/keycloak/keycloak/releases/download/26.8.2/keycloak-26.8.2.zip',
  archivo: 'keycloak-26.8.2.zip',
});

const BASE_JRE = 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.13%2B9/';
const jre = (archivo, sha256, bytes) =>
  Object.freeze({
    nombre: 'JRE Eclipse Temurin 21.0.13+9',
    version: '21.0.13+9',
    sha256,
    bytes,
    url: `${BASE_JRE}${archivo}`,
    archivo,
  });

// Huellas publicadas por Adoptium (API de assets) para cada plataforma soportada.
export const HUELLAS_POR_PLATAFORMA = Object.freeze({
  'darwin-arm64': jre(
    'OpenJDK21U-jre_aarch64_mac_hotspot_21.0.13_9.tar.gz',
    '225bab0a09491ef06835488cd942f5d2befa9a0410a2484f0c8bbcf7506ec09a',
    47_935_740,
  ),
  'darwin-x64': jre(
    'OpenJDK21U-jre_x64_mac_hotspot_21.0.13_9.tar.gz',
    'c909674b1c10c261b9a3fb7e9c0efebd303e33f88a4fe84be7135b5e2d711f89',
    41_902_098,
  ),
  'win32-x64': jre(
    'OpenJDK21U-jre_x64_windows_hotspot_21.0.13_9.zip',
    '2332c0b4cff6bed722da3567c91d5e47568bcba863fa4945d0a8d6fc76158628',
    49_106_397,
  ),
  'linux-x64': jre(
    'OpenJDK21U-jre_x64_linux_hotspot_21.0.13_9.tar.gz',
    'a535a1df9c6284d9618872984e026ae0352d1f7e9e0605425c0e6114f47351dd',
    52_181_297,
  ),
});

export const elegirJre = (sistema, arquitectura) => {
  const jreElegido = HUELLAS_POR_PLATAFORMA[`${sistema}-${arquitectura}`];
  if (!jreElegido) throw new Error(`Plataforma no soportada: ${sistema}-${arquitectura} (sin JRE con huella fijada).`);
  return jreElegido;
};

export const hashDeArchivo = async (ruta) => {
  const hash = createHash('sha256');
  await pipeline(createReadStream(ruta), hash);
  return hash.digest('hex');
};

// Una entrada de archivo es segura si es relativa y, normalizada, no sale de la carpeta destino.
export const rutaSegura = (ruta) => {
  if (typeof ruta !== 'string' || ruta === '' || ruta.includes('\0')) return false;
  if (ruta.startsWith('/') || ruta.startsWith('\\') || /^[A-Za-z]:/.test(ruta)) return false;
  let profundidad = 0;
  for (const parte of ruta.split(/[\\/]+/)) {
    if (parte === '' || parte === '.') continue;
    if (parte === '..') profundidad -= 1;
    else profundidad += 1;
    if (profundidad < 0) return false;
  }
  return true;
};

export const validarEntradas = (entradas) => {
  if (entradas.length === 0) throw new Error('El archivo está vacío: no se extrae.');
  const mala = entradas.find((entrada) => !rutaSegura(entrada));
  if (mala !== undefined) throw new Error(`Entrada insegura en el archivo (sale de la carpeta destino): ${mala}`);
};

const formatoMb = (bytes) => `${(bytes / MB).toFixed(1).replace('.', ',')} MB`;

export const formatearPlan = (paquetes) => {
  const lineas = paquetes.map((p) => `  - ${p.nombre}: ${formatoMb(p.bytes)}  (${p.url})`);
  const total = paquetes.reduce((suma, p) => suma + p.bytes, 0);
  return ['Se descargará:', ...lineas, `Total: ${formatoMb(total)}`].join('\n');
};

const leerMarca = async (destino) => {
  try {
    return JSON.parse(await readFile(join(destino, '.instalado.json'), 'utf8'));
  } catch {
    return null;
  }
};

// Descarga → comprueba tamaño y huella → valida las entradas → extrae en una carpeta temporal → mueve al destino.
// Si algo falla no queda nada a medias: ni el archivo descargado ni el destino.
export const instalarPaquete = async ({ paquete, destino, descargas, descargar, listar, extraer }) => {
  const marca = await leerMarca(destino);
  if (marca?.sha256 === paquete.sha256) return { yaInstalado: true };

  await mkdir(descargas, { recursive: true });
  const archivo = join(descargas, `${paquete.nombre.replace(/[^\w.-]+/g, '-').toLowerCase()}.descarga`);
  const temporal = `${destino}.tmp`;
  try {
    await rm(archivo, { force: true });
    await descargar(paquete.url, archivo);
    const { size } = await stat(archivo);
    if (size !== paquete.bytes) {
      throw new Error(
        `Tamaño inesperado de ${paquete.nombre}: ${size} bytes, se esperaban ${paquete.bytes}. No se extrae.`,
      );
    }
    const real = await hashDeArchivo(archivo);
    if (real !== paquete.sha256) {
      throw new Error(
        `La huella de ${paquete.nombre} no coincide (esperada ${paquete.sha256}, obtenida ${real}). No se extrae.`,
      );
    }
    validarEntradas(await listar(archivo));
    await rm(temporal, { recursive: true, force: true });
    await mkdir(temporal, { recursive: true });
    await extraer(archivo, temporal);
    await writeFile(
      join(temporal, '.instalado.json'),
      `${JSON.stringify({ nombre: paquete.nombre, version: paquete.version, sha256: paquete.sha256 }, null, 2)}\n`,
    );
    await rm(destino, { recursive: true, force: true });
    await mkdir(dirname(destino), { recursive: true });
    await rename(temporal, destino);
    return { yaInstalado: false };
  } finally {
    await rm(archivo, { force: true });
    await rm(temporal, { recursive: true, force: true });
  }
};

// --- Adaptadores reales (no se usan en las pruebas unitarias) ---

export const descargarConFetch = async (url, destino) => {
  const respuesta = await fetch(url, { redirect: 'follow' });
  if (!respuesta.ok || !respuesta.body) throw new Error(`Descarga fallida (${respuesta.status}): ${url}`);
  const final = new URL(respuesta.url);
  if (final.protocol !== 'https:') throw new Error(`La descarga terminó en un origen no HTTPS: ${respuesta.url}`);
  await pipeline(Readable.fromWeb(respuesta.body), createWriteStream(destino));
};

const ejecutar = (orden, args) =>
  new Promise((resolver, rechazar) => {
    const proceso = spawn(orden, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let salida = '';
    let error = '';
    proceso.stdout.on('data', (d) => (salida += d));
    proceso.stderr.on('data', (d) => (error += d));
    proceso.on('error', rechazar);
    proceso.on('close', (codigo) =>
      codigo === 0 ? resolver(salida) : rechazar(new Error(`${orden} terminó con código ${codigo}: ${error.trim()}`)),
    );
  });

// bsdtar (macOS y Windows 10+) lee zip y tar.gz. En Linux, GNU tar no lee zip: se usa unzip.
const usaUnzip = (archivo) => process.platform === 'linux' && archivo.endsWith('.zip');

export const listarEntradas = async (archivo) => {
  const salida = usaUnzip(archivo)
    ? await ejecutar('unzip', ['-Z1', archivo])
    : await ejecutar('tar', ['-tf', archivo]);
  return salida.split(/\r?\n/).filter((linea) => linea !== '');
};

export const extraerArchivo = async (archivo, destino) => {
  if (usaUnzip(archivo)) await ejecutar('unzip', ['-q', archivo, '-d', destino]);
  else await ejecutar('tar', ['-xf', archivo, '-C', destino]);
};
