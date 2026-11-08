import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  HUELLAS_POR_PLATAFORMA,
  KEYCLOAK,
  elegirJre,
  formatearPlan,
  hashDeArchivo,
  instalarPaquete,
  rutaSegura,
  validarEntradas,
} from './keycloak-dev.mjs';

const sha = (texto) => createHash('sha256').update(texto).digest('hex');

let carpeta;
beforeEach(() => {
  carpeta = mkdtempSync(join(tmpdir(), 'kc-dev-'));
});
afterEach(() => {
  rmSync(carpeta, { recursive: true, force: true });
});

describe('tabla de versiones fijadas (ADR 025)', () => {
  it('fija Keycloak 26.8.2 con huella SHA-256 completa, tamaño y URL de GitHub', () => {
    expect(KEYCLOAK.version).toBe('26.8.2');
    expect(KEYCLOAK.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(KEYCLOAK.sha256).toBe('321ffee62ec28fab18fe885d8cd62cc814edce72a35cd062dc81b504c1a406b3');
    expect(KEYCLOAK.bytes).toBe(173_780_410);
    expect(KEYCLOAK.url).toBe('https://github.com/keycloak/keycloak/releases/download/26.8.2/keycloak-26.8.2.zip');
  });

  it('cada JRE es Temurin 21.0.13+9 con huella de 64 hex y URL oficial de Adoptium en GitHub', () => {
    for (const [plataforma, jre] of Object.entries(HUELLAS_POR_PLATAFORMA)) {
      expect(jre.sha256, plataforma).toMatch(/^[0-9a-f]{64}$/);
      expect(jre.url, plataforma).toMatch(
        /^https:\/\/github\.com\/adoptium\/temurin21-binaries\/releases\/download\/jdk-21\.0\.13%2B9\/OpenJDK21U-jre_/,
      );
      expect(jre.bytes, plataforma).toBeGreaterThan(30_000_000);
    }
    expect(HUELLAS_POR_PLATAFORMA['darwin-arm64'].sha256).toBe(
      '225bab0a09491ef06835488cd942f5d2befa9a0410a2484f0c8bbcf7506ec09a',
    );
  });
});

describe('elegirJre', () => {
  it('elige por sistema y arquitectura', () => {
    expect(elegirJre('darwin', 'arm64')).toBe(HUELLAS_POR_PLATAFORMA['darwin-arm64']);
    expect(elegirJre('win32', 'x64')).toBe(HUELLAS_POR_PLATAFORMA['win32-x64']);
  });
  it('falla de forma clara en una plataforma sin huella fijada', () => {
    expect(() => elegirJre('freebsd', 'x64')).toThrow(/plataforma no soportada: freebsd-x64/i);
  });
});

describe('hashDeArchivo', () => {
  it('calcula SHA-256 en streaming', async () => {
    const f = join(carpeta, 'a.bin');
    writeFileSync(f, 'hola');
    expect(await hashDeArchivo(f)).toBe(sha('hola'));
  });
});

describe('rutaSegura / validarEntradas (sin salir de la carpeta destino)', () => {
  it('acepta rutas relativas internas', () => {
    expect(rutaSegura('keycloak-26.8.2/bin/kc.sh')).toBe(true);
    expect(rutaSegura('./a/b')).toBe(true);
    expect(rutaSegura('a/../a/b')).toBe(true);
  });
  it.each([
    '../fuera',
    'a/../../fuera',
    '/etc/passwd',
    'C:\\Windows\\x',
    'C:/x',
    '\\\\srv\\x',
    'a\\..\\..\\x',
    '',
    'a\0b',
  ])('rechaza %j', (ruta) => {
    expect(rutaSegura(ruta)).toBe(false);
  });
  it('validarEntradas lanza con la primera entrada peligrosa y nombra la ruta', () => {
    expect(() => validarEntradas(['ok/a', 'ok/../../mala', 'ok/b'])).toThrow(/ok\/\.\.\/\.\.\/mala/);
    expect(() => validarEntradas(['ok/a', 'ok/b'])).not.toThrow();
  });
  it('un archivo sin entradas no es válido', () => {
    expect(() => validarEntradas([])).toThrow(/vacío/i);
  });
});

describe('instalarPaquete', () => {
  const crear = (contenido) => {
    const llamadas = { extraer: 0, descargar: 0, listar: 0 };
    const paquete = {
      nombre: 'prueba',
      bytes: contenido.length,
      sha256: sha(contenido),
      url: 'https://ejemplo.test/p.zip',
    };
    const dependencias = {
      descargar: async (_url, destino) => {
        llamadas.descargar += 1;
        writeFileSync(destino, contenido);
      },
      listar: async () => {
        llamadas.listar += 1;
        return ['p/bin/x'];
      },
      extraer: async (_archivo, destino) => {
        llamadas.extraer += 1;
        writeFileSync(join(destino, 'x'), 'listo');
      },
    };
    return { paquete, dependencias, llamadas };
  };

  it('con huella correcta descarga, extrae y deja la marca de versión', async () => {
    const { paquete, dependencias, llamadas } = crear('contenido bueno');
    const destino = join(carpeta, 'destino');
    await instalarPaquete({
      paquete,
      destino,
      descargas: join(carpeta, 'descargas'),
      ...dependencias,
    });
    expect(llamadas).toEqual({ descargar: 1, listar: 1, extraer: 1 });
    expect(readFileSync(join(destino, 'x'), 'utf8')).toBe('listo');
    expect(JSON.parse(readFileSync(join(destino, '.instalado.json'), 'utf8'))).toMatchObject({
      sha256: paquete.sha256,
    });
  });

  it('con huella incorrecta aborta, NO extrae, borra lo descargado y no crea el destino', async () => {
    const { paquete, dependencias, llamadas } = crear('contenido bueno');
    const malo = { ...paquete, sha256: sha('otra cosa') };
    const destino = join(carpeta, 'destino');
    const descargas = join(carpeta, 'descargas');
    await expect(instalarPaquete({ paquete: malo, destino, descargas, ...dependencias })).rejects.toThrow(
      /huella.*no coincide/i,
    );
    expect(llamadas.extraer).toBe(0);
    expect(llamadas.listar).toBe(0);
    expect(existsSync(destino)).toBe(false);
    expect(existsSync(join(descargas, 'prueba.descarga'))).toBe(false);
  });

  it('con tamaño distinto al fijado aborta antes de calcular y no extrae', async () => {
    const { paquete, dependencias, llamadas } = crear('contenido bueno');
    const destino = join(carpeta, 'destino');
    await expect(
      instalarPaquete({
        paquete: { ...paquete, bytes: 5 },
        destino,
        descargas: join(carpeta, 'd'),
        ...dependencias,
      }),
    ).rejects.toThrow(/tamaño/i);
    expect(llamadas.extraer).toBe(0);
    expect(existsSync(destino)).toBe(false);
  });

  it('con una entrada que sale de la carpeta aborta sin extraer', async () => {
    const { paquete, dependencias, llamadas } = crear('contenido bueno');
    const destino = join(carpeta, 'destino');
    await expect(
      instalarPaquete({
        paquete,
        destino,
        descargas: join(carpeta, 'd'),
        ...dependencias,
        listar: async () => ['p/ok', '../../fuera'],
      }),
    ).rejects.toThrow(/\.\.\/\.\.\/fuera/);
    expect(llamadas.extraer).toBe(0);
    expect(existsSync(destino)).toBe(false);
  });

  it('si ya está instalada la misma huella no vuelve a descargar', async () => {
    const { paquete, dependencias, llamadas } = crear('contenido bueno');
    const destino = join(carpeta, 'destino');
    const descargas = join(carpeta, 'descargas');
    await instalarPaquete({ paquete, destino, descargas, ...dependencias });
    const otra = await instalarPaquete({
      paquete,
      destino,
      descargas,
      ...dependencias,
    });
    expect(otra).toEqual({ yaInstalado: true });
    expect(llamadas.descargar).toBe(1);
  });

  it('si cambia la huella fijada (nueva versión) reinstala y reemplaza lo anterior', async () => {
    const uno = crear('version uno');
    const dos = crear('version dos');
    const destino = join(carpeta, 'destino');
    const descargas = join(carpeta, 'descargas');
    await instalarPaquete({
      paquete: uno.paquete,
      destino,
      descargas,
      ...uno.dependencias,
    });
    const resultado = await instalarPaquete({
      paquete: dos.paquete,
      destino,
      descargas,
      ...dos.dependencias,
    });
    expect(resultado).toEqual({ yaInstalado: false });
    expect(dos.llamadas.descargar).toBe(1);
    expect(JSON.parse(readFileSync(join(destino, '.instalado.json'), 'utf8')).sha256).toBe(dos.paquete.sha256);
  });

  it('tras un fallo no queda la carpeta temporal ni el archivo descargado', async () => {
    const { paquete, dependencias } = crear('contenido bueno');
    const destino = join(carpeta, 'destino');
    const descargas = join(carpeta, 'd');
    await expect(
      instalarPaquete({
        paquete,
        destino,
        descargas,
        ...dependencias,
        extraer: async (_archivo, carpetaTemporal) => {
          writeFileSync(join(carpetaTemporal, 'parcial'), 'a medias');
          throw new Error('interrumpido');
        },
      }),
    ).rejects.toThrow(/interrumpido/);
    expect(existsSync(`${destino}.tmp`)).toBe(false);
    expect(existsSync(destino)).toBe(false);
    expect(existsSync(join(descargas, 'prueba.descarga'))).toBe(false);
  });

  it('si la extracción falla no deja un destino a medias', async () => {
    const { paquete, dependencias } = crear('contenido bueno');
    const destino = join(carpeta, 'destino');
    await expect(
      instalarPaquete({
        paquete,
        destino,
        descargas: join(carpeta, 'd'),
        ...dependencias,
        extraer: async () => {
          throw new Error('disco lleno');
        },
      }),
    ).rejects.toThrow(/disco lleno/);
    expect(existsSync(destino)).toBe(false);
  });
});

describe('formatearPlan', () => {
  it('informa tamaños y total en MB antes de descargar', () => {
    const texto = formatearPlan([
      { nombre: 'Keycloak 26.8.2', bytes: 173_780_410, url: 'https://x/k.zip' },
      { nombre: 'JRE', bytes: 47_935_740, url: 'https://x/j.tar.gz' },
    ]);
    expect(texto).toMatch(/Keycloak 26\.8\.2.*165,7 MB/);
    expect(texto).toMatch(/JRE.*45,7 MB/);
    expect(texto).toMatch(/Total.*211,4 MB/);
  });
});
